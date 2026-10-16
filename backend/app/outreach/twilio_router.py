"""Twilio voice webhooks for U2U automated phone calls.

Endpoints:
- POST /twilio/{mode}/voice/{call_id}: Plays cached audio, gathers DTMF keypress (replayed once), hangs up.
- POST /twilio/{mode}/gather/{call_id}: Processes DTMF keypress (1, 2, or 9) via transitions.py.
- POST /twilio/{mode}/status/{call_id}: Handles call status callbacks (maps no-answer/busy/failed/completed without digit to NO_ANSWER).

Guarantees:
- Validates X-Twilio-Signature with twilio.request_validator against PUBLIC_BASE_URL.
- Rejects mode mismatches with 403 Forbidden.
- Deduplicates webhooks using create-only on webhookEvents/{CallSid}_{event}.
- Replies within 2 seconds.
"""

import logging
import uuid
from urllib.parse import parse_qsl, urlparse

from fastapi import APIRouter, HTTPException, Request, Response, status
from twilio.request_validator import RequestValidator

from app.clock.service import get_clock
from app.core.audit import record_audit
from app.core.config import get_settings
from app.core.store import TransactionStore, get_store
from app.matching.service import select_donors_for_request
from app.outreach.service import dispatch_round_calls, get_telephony_adapter
from app.requests.models import Call, CallState
from app.requests.transitions import (
    IllegalTransition,
    Intent,
    apply_call_no_answer,
    apply_press_1,
    apply_press_2,
    apply_press_9,
    apply_reminder_press_2,
)
from app.voice.tokens import create_stream_token

logger = logging.getLogger("u2u.outreach.webhooks")

router = APIRouter(prefix="/twilio", tags=["Twilio Webhooks"])


def _verify_twilio_signature(request: Request, body_params: dict[str, str]) -> None:
    """Validates X-Twilio-Signature against PUBLIC_BASE_URL (proxy-safe)."""
    settings = get_settings()
    auth_token = settings.TWILIO_AUTH_TOKEN or ""
    validator = RequestValidator(auth_token)

    # Cloud Run sits behind GFE reverse proxy; rebuild exact public URL using PUBLIC_BASE_URL
    base_url = settings.PUBLIC_BASE_URL.rstrip("/")
    path = request.url.path
    full_url = f"{base_url}{path}"
    if request.url.query:
        full_url = f"{full_url}?{request.url.query}"

    signature = request.headers.get("X-Twilio-Signature", "")
    if not validator.validate(full_url, body_params, signature):
        logger.warning("Twilio signature validation failed for URL: %s", full_url)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid Twilio signature.",
        )


async def _extract_post_params(request: Request) -> dict[str, str]:
    """Extracts form urlencoded parameters safely without requiring python-multipart."""
    try:
        raw_body = await request.body()
        return dict(parse_qsl(raw_body.decode("utf-8")))
    except Exception:
        return {}


def _verify_mode(mode: str) -> None:
    """Rejects webhooks where path mode does not match DATA_MODE with 403 Forbidden."""
    settings = get_settings()
    if mode != settings.DATA_MODE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Data mode mismatch: URL path has '{mode}', server active mode is '{settings.DATA_MODE}'.",
        )


@router.post("/{mode}/voice/{call_id}")
async def twilio_voice_webhook(mode: str, call_id: str, request: Request) -> Response:
    """Returns TwiML to play the cached audio and gather DTMF keypress (replayed once)."""
    _verify_mode(mode)

    params = await _extract_post_params(request)
    _verify_twilio_signature(request, params)

    call_sid = params.get("CallSid", "unknown")
    store = get_store()
    clock = get_clock()
    now_iso = clock.now_iso()

    # Deduplicate on webhookEvents/{CallSid}_voice
    event_key = f"{call_sid}_voice"
    created = await store.create_webhook_event(
        event_key,
        {
            "callId": call_id,
            "callSid": call_sid,
            "event": "voice",
            "at": now_iso,
        },
    )
    if not created:
        return Response(content="<Response/>", media_type="application/xml")

    token = await create_stream_token(store, call_id)

    settings = get_settings()
    base_url = settings.PUBLIC_BASE_URL.rstrip("/")
    parsed = urlparse(base_url)
    host = parsed.netloc or parsed.path.lstrip("/")
    if not host:
        host = base_url.replace("https://", "").replace("http://", "")

    stream_url = f"wss://{host}/twilio/{mode}/stream/{call_id}"

    twiml = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        "<Response>\n"
        "    <Connect>\n"
        f'        <Stream url="{stream_url}">\n'
        f'            <Parameter name="token" value="{token}" />\n'
        "        </Stream>\n"
        "    </Connect>\n"
        "</Response>"
    )
    return Response(content=twiml, media_type="application/xml")


@router.post("/{mode}/gather/{call_id}")
async def twilio_gather_webhook(mode: str, call_id: str, request: Request) -> Response:
    """Processes DTMF keypress (1, 2, or 9) from Twilio <Gather>."""
    _verify_mode(mode)

    params = await _extract_post_params(request)
    _verify_twilio_signature(request, params)

    call_sid = params.get("CallSid", "unknown")
    digits = params.get("Digits", "").strip()

    store = get_store()
    clock = get_clock()
    now_iso = clock.now_iso()

    # Deduplicate on webhookEvents/{CallSid}_gather
    event_key = f"{call_sid}_gather"
    created = await store.create_webhook_event(
        event_key,
        {
            "callId": call_id,
            "callSid": call_sid,
            "event": "gather",
            "digits": digits,
            "at": now_iso,
        },
    )
    if not created:
        # Duplicate gather: return immediately without re-applying transition
        return Response(content="<Response><Hangup/></Response>", media_type="application/xml")

    # Verify digits: 1, 2, or 9
    if digits not in ("1", "2", "9"):
        return Response(content="<Response><Hangup/></Response>", media_type="application/xml")

    parts = call_id.split("_", 2)
    if len(parts) < 3:
        return Response(content="<Response><Hangup/></Response>", media_type="application/xml")

    request_id = parts[0]
    donor_id = parts[2]
    should_dispatch_round = False

    async def _tx_handle_gather(tx: TransactionStore) -> Call | None:
        nonlocal should_dispatch_round
        req = await tx.get_request(request_id)
        if not req:
            return None

        call = await tx.get_call(request_id, call_id)
        if not call:
            return None

        # Idempotency check: if already processed
        if digits == "1" and call.state in (CallState.ON_THE_WAY, CallState.LATE_ACCEPT):
            return call
        if digits == "2" and call.state in (CallState.DECLINED, CallState.CANCELLED):
            return call
        if digits == "9" and call.state == CallState.OPTED_OUT:
            return call

        try:
            if digits == "1":
                result = apply_press_1(req, call, timestamp=now_iso)
            elif digits == "2":
                if call.state == CallState.ON_THE_WAY:
                    result = apply_reminder_press_2(req, call, timestamp=now_iso)
                else:
                    result = apply_press_2(req, call, timestamp=now_iso)
            elif digits == "9":
                result = apply_press_9(req, call, timestamp=now_iso)
                # Opt out donor permanently
                donor = await tx.get_donor(donor_id)
                if donor:
                    updated_donor = donor.model_copy(
                        update={"consent_urgent": False, "active": False}
                    )
                    await tx.save_donor(updated_donor)

                # Record consent withdrawal event
                lang_val = call.lang.value if hasattr(call.lang, "value") else str(call.lang)
                await tx.append_consent_event(
                    donor_id,
                    {
                        "id": f"c-evt-{uuid.uuid4().hex[:8]}",
                        "donorId": donor_id,
                        "purpose": "urgent_contact",
                        "granted": False,
                        "action": "WITHDRAW",
                        "noticeVersion": "v1",
                        "language": lang_val,
                        "channel": "ivr",
                        "at": now_iso,
                    },
                )

                # Record audit entry
                await record_audit(
                    tx,
                    actor_uid=donor_id,
                    role="donor",
                    action="opt-out",
                    target_id=donor_id,
                    before_status="ACTIVE",
                    after_status="WITHDRAWN",
                )
            else:
                return call
        except IllegalTransition as e:
            logger.warning("Illegal transition in Twilio gather for call %s: %s", call_id, e)
            return call

        updated_request = result.request
        if Intent.START_ROUND in result.side_effects:
            new_round = updated_request.round + 1
            updated_request = updated_request.model_copy(
                update={"round": new_round, "updated_at": now_iso}
            )
            should_dispatch_round = True

        await tx.save_request(updated_request)
        if result.call:
            await tx.save_call(request_id, result.call)

        for event in result.timeline_events:
            await tx.append_event(request_id, event)

        for oc in result.other_calls:
            await tx.save_call(request_id, oc)

        return result.call

    await store.run_transaction(_tx_handle_gather)

    if should_dispatch_round:
        refreshed_req = await store.get_request(request_id)
        if refreshed_req:
            donors = await select_donors_for_request(store, refreshed_req, clock=clock, limit=5)
            adapter = await get_telephony_adapter(store, clock=clock)
            await dispatch_round_calls(store, refreshed_req, donors, adapter, clock=clock)

    return Response(content="<Response><Hangup/></Response>", media_type="application/xml")


@router.post("/{mode}/status/{call_id}")
async def twilio_status_webhook(mode: str, call_id: str, request: Request) -> Response:
    """Handles status callback from Twilio; maps no-answer, busy, failed, or completed without digit to NO_ANSWER."""
    _verify_mode(mode)

    params = await _extract_post_params(request)
    _verify_twilio_signature(request, params)

    call_sid = params.get("CallSid", "unknown")
    call_status = params.get("CallStatus", "").lower()

    store = get_store()
    clock = get_clock()
    now_iso = clock.now_iso()

    # Deduplicate on webhookEvents/{CallSid}_status_{call_status}
    event_key = f"{call_sid}_status_{call_status}"
    created = await store.create_webhook_event(
        event_key,
        {
            "callId": call_id,
            "callSid": call_sid,
            "status": call_status,
            "at": now_iso,
        },
    )
    if not created:
        return Response(content="<Response/>", media_type="application/xml")

    parts = call_id.split("_", 2)
    if len(parts) < 3:
        return Response(content="<Response/>", media_type="application/xml")

    request_id = parts[0]

    # Map no-answer, busy, failed, or completed (without digit) to NO_ANSWER
    should_map_no_answer = call_status in ("no-answer", "busy", "failed", "completed")

    if should_map_no_answer:

        async def _tx_handle_status(tx: TransactionStore) -> None:
            req = await tx.get_request(request_id)
            if not req:
                return

            call = await tx.get_call(request_id, call_id)
            if not call:
                return

            # Only transition if call is still in RINGING or DIALING state
            if call.state in (CallState.RINGING, CallState.DIALING):
                try:
                    result = apply_call_no_answer(req, call, timestamp=now_iso)
                    if result.call:
                        await tx.save_call(request_id, result.call)
                    for event in result.timeline_events:
                        await tx.append_event(request_id, event)
                except IllegalTransition as e:
                    logger.warning("Illegal transition in Twilio status: %s", e)

        await store.run_transaction(_tx_handle_status)

    return Response(content="<Response/>", media_type="application/xml")
