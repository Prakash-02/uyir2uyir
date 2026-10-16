"""Twilio Media Streams two-way WebSocket handler for U2U automated phone calls.

Guarantees:
- WebSocket endpoint at WS /twilio/{mode}/stream/{call_id}.
- Rejects mode mismatches and invalid/expired stream tokens with immediate closure.
- Streams fixed Cloud Text-to-Speech audio in 8 kHz mu-law format (160 bytes per 20 ms frame).
- Sends 'opening' prompt, an 'opening_end' mark, then 'keypad_prompt' and 'keypad_prompt_end' mark.
- Listens for DTMF digits (1, 2, or 9) and applies transitions via transitions.py in a transaction.
- Plays matching closing audio and hangs up the call.
- After 20 seconds with no key press: marks call as NO_ANSWER and hangs up.
- Never stores or logs audio to disk.
"""

import asyncio
import base64
import json
import logging
from uuid import uuid4

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.ai.tts import synthesize_stream_audio
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
from app.voice.tokens import verify_and_consume_stream_token

logger = logging.getLogger("u2u.voice.stream")

router = APIRouter(prefix="/twilio", tags=["Twilio Media Streams"])

STREAM_TIMEOUT_SECONDS: float = 20.0


async def send_audio_frames(
    websocket: WebSocket,
    stream_sid: str,
    audio_bytes: bytes,
    frame_size: int = 160,
    chunk_delay: float = 0.0,
    stop_event: asyncio.Event | None = None,
) -> None:
    """Streams mu-law audio chunks of frame_size (default 160 bytes) as Twilio media messages."""
    for i in range(0, len(audio_bytes), frame_size):
        if stop_event and stop_event.is_set():
            break
        chunk = audio_bytes[i : i + frame_size]
        payload = base64.b64encode(chunk).decode("ascii")
        msg = {
            "event": "media",
            "streamSid": stream_sid,
            "media": {"payload": payload},
        }
        await websocket.send_text(json.dumps(msg))
        if chunk_delay > 0:
            await asyncio.sleep(chunk_delay)


async def send_mark(websocket: WebSocket, stream_sid: str, mark_name: str) -> None:
    """Sends a mark event to Twilio to track playback progress."""
    msg = {
        "event": "mark",
        "streamSid": stream_sid,
        "mark": {"name": mark_name},
    }
    await websocket.send_text(json.dumps(msg))


async def send_clear(websocket: WebSocket, stream_sid: str) -> None:
    """Sends a clear event to Twilio to interrupt currently playing audio."""
    msg = {
        "event": "clear",
        "streamSid": stream_sid,
    }
    await websocket.send_text(json.dumps(msg))


@router.websocket("/{mode}/stream/{call_id}")
async def twilio_media_stream_websocket(
    websocket: WebSocket,
    mode: str,
    call_id: str,
) -> None:
    """Two-way audio WebSocket connecting Twilio Media Stream to U2U telephony engine."""
    await websocket.accept()

    settings = get_settings()
    store = get_store()
    clock = get_clock()

    # 1. Reject mode mismatch immediately
    if mode != settings.DATA_MODE:
        logger.warning(
            "WebSocket rejected: mode '%s' does not match server active mode '%s'",
            mode,
            settings.DATA_MODE,
        )
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Parse call ID: requestId_round_donorId
    parts = call_id.split("_", 2)
    if len(parts) < 3:
        logger.warning("WebSocket rejected: malformed callId '%s'", call_id)
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    request_id = parts[0]
    donor_id = parts[2]

    stream_sid: str | None = None
    call_sid: str | None = None
    verified = False
    dtmf_handled = asyncio.Event()
    stop_playback = asyncio.Event()
    timeout_task: asyncio.Task[None] | None = None
    prompt_playing_task: asyncio.Task[None] | None = None

    async def _handle_no_key_timeout(timeout_secs: float | None = None) -> None:
        """Applies NO_ANSWER transition if no DTMF key is pressed within timeout."""
        effective_timeout = timeout_secs if timeout_secs is not None else STREAM_TIMEOUT_SECONDS
        try:
            await asyncio.sleep(effective_timeout)
            if not dtmf_handled.is_set():
                logger.info(
                    "No DTMF received after %.1fs for call %s; transitioning to NO_ANSWER",
                    effective_timeout,
                    call_id,
                )
                now_iso = clock.now_iso()

                async def _tx_no_answer(tx: TransactionStore) -> None:
                    req = await tx.get_request(request_id)
                    if not req:
                        return
                    c = await tx.get_call(request_id, call_id)
                    if not c or c.state not in (CallState.RINGING, CallState.DIALING):
                        return
                    try:
                        res = apply_call_no_answer(req, c, timestamp=now_iso)
                        if res.call:
                            await tx.save_call(request_id, res.call)
                        for ev in res.timeline_events:
                            await tx.append_event(request_id, ev)
                    except IllegalTransition:
                        pass

                await store.run_transaction(_tx_no_answer)
                stop_playback.set()
                if stream_sid:
                    await send_clear(websocket, stream_sid)
                await websocket.close()
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.debug("Timeout watcher exception for call %s: %s", call_id, e)

    try:
        while True:
            text_data = await websocket.receive_text()
            try:
                data = json.loads(text_data)
            except Exception:
                continue

            event_type = data.get("event")

            # A. Connected event
            if event_type == "connected":
                logger.debug("Twilio stream connected for call %s", call_id)
                continue

            # B. Start event: validates token and starts opening audio playback
            if event_type == "start":
                start_data = data.get("start", {})
                stream_sid = start_data.get("streamSid") or data.get("streamSid", "")
                call_sid = start_data.get("callSid")
                logger.debug(
                    "Twilio stream start: streamSid=%s callSid=%s for call %s",
                    stream_sid,
                    call_sid,
                    call_id,
                )
                custom_params = start_data.get("customParameters", {})
                token = custom_params.get("token", "")

                # Verify and single-use consume stream token
                is_valid = await verify_and_consume_stream_token(store, call_id, token)
                if not is_valid:
                    logger.warning("Closing stream: invalid or expired token for call %s", call_id)
                    await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                    return

                verified = True

                # Retrieve request and call details for template synthesis
                req = await store.get_request(request_id)
                call_obj = await store.get_call(request_id, call_id)
                app_conf = await store.get_config("app") or {}
                weather_alert = bool(app_conf.get("weatherAlert", False))

                lang = "ta"
                if call_obj and hasattr(call_obj, "lang"):
                    lang = (
                        call_obj.lang.value
                        if hasattr(call_obj.lang, "value")
                        else str(call_obj.lang)
                    )

                bg = req.blood_group if req else "O+"
                comp = req.component if req else "whole blood"
                centre = (
                    (req.centre_name if req else None)
                    or (req.hospital_name if req else None)
                    or "Blood Centre"
                )

                # Synthesize opening and keypad prompt audio (8 kHz mu-law, cached in-memory)
                opening_audio = await synthesize_stream_audio(
                    "opening",
                    lang=lang,
                    blood_group=bg,
                    component=comp,
                    centre_name=centre,
                    weather_alert=weather_alert,
                    output_format="mulaw_8k",
                )
                keypad_audio = await synthesize_stream_audio(
                    "keypad_prompt",
                    lang=lang,
                    output_format="mulaw_8k",
                )

                async def _play_prompts_and_start_timeout(
                    target_stream_sid: str,
                    target_opening: bytes,
                    target_keypad: bytes,
                ) -> None:
                    try:
                        # 1. Send opening audio in 160-byte frames
                        await send_audio_frames(
                            websocket,
                            target_stream_sid,
                            target_opening,
                            stop_event=stop_playback,
                        )
                        if not stop_playback.is_set():
                            await send_mark(websocket, target_stream_sid, "opening_end")

                        # 2. Send keypad prompt audio in 160-byte frames
                        await send_audio_frames(
                            websocket,
                            target_stream_sid,
                            target_keypad,
                            stop_event=stop_playback,
                        )
                        if not stop_playback.is_set():
                            await send_mark(websocket, target_stream_sid, "keypad_prompt_end")

                        # 3. Start 20s timeout watcher after prompts
                        nonlocal timeout_task
                        if not stop_playback.is_set():
                            timeout_task = asyncio.create_task(_handle_no_key_timeout())
                    except Exception as e:
                        logger.debug("Prompt playback interrupted or failed: %s", e)

                if stream_sid:
                    prompt_playing_task = asyncio.create_task(
                        _play_prompts_and_start_timeout(stream_sid, opening_audio, keypad_audio)
                    )
                continue

            # C. DTMF keypress event
            if event_type == "dtmf":
                if not verified:
                    await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
                    return

                dtmf_info = data.get("dtmf", {})
                digit = str(dtmf_info.get("digit", "")).strip()
                if digit not in ("1", "2", "9"):
                    continue

                # Interrupt playback and cancel timeout
                stop_playback.set()
                if timeout_task and not timeout_task.done():
                    timeout_task.cancel()
                if prompt_playing_task and not prompt_playing_task.done():
                    prompt_playing_task.cancel()

                if stream_sid:
                    await send_clear(websocket, stream_sid)

                # Set handled event to prevent timeout race
                dtmf_handled.set()

                now_iso = clock.now_iso()
                should_dispatch_round = False
                chosen_closing = "closing_cant"

                def _build_dtmf_handler(d: str, ts: str):
                    async def _handler(tx: TransactionStore) -> Call | None:
                        nonlocal should_dispatch_round, chosen_closing
                        req = await tx.get_request(request_id)
                        if not req:
                            return None
                        call = await tx.get_call(request_id, call_id)
                        if not call:
                            return None

                        # Idempotency check: if DTMF was already processed
                        if d == "1" and call.state in (CallState.ON_THE_WAY, CallState.LATE_ACCEPT):
                            chosen_closing = (
                                "closing_enough"
                                if call.state == CallState.LATE_ACCEPT
                                else "closing_coming"
                            )
                            return call
                        if d == "2" and call.state in (CallState.DECLINED, CallState.CANCELLED):
                            chosen_closing = "closing_cant"
                            return call
                        if d == "9" and call.state == CallState.OPTED_OUT:
                            chosen_closing = "closing_stop"
                            return call

                        try:
                            if d == "1":
                                result = apply_press_1(req, call, timestamp=ts)
                                if Intent.PLAY_ENOUGH_MESSAGE in result.side_effects:
                                    chosen_closing = "closing_enough"
                                else:
                                    chosen_closing = "closing_coming"
                            elif d == "2":
                                chosen_closing = "closing_cant"
                                if call.state == CallState.ON_THE_WAY:
                                    result = apply_reminder_press_2(req, call, timestamp=ts)
                                else:
                                    result = apply_press_2(req, call, timestamp=ts)
                            elif d == "9":
                                chosen_closing = "closing_stop"
                                result = apply_press_9(req, call, timestamp=ts)

                                donor = await tx.get_donor(donor_id)
                                if donor:
                                    updated_donor = donor.model_copy(
                                        update={"consent_urgent": False, "active": False}
                                    )
                                    await tx.save_donor(updated_donor)

                                lang_val = (
                                    call.lang.value
                                    if hasattr(call.lang, "value")
                                    else str(call.lang)
                                )
                                await tx.append_consent_event(
                                    donor_id,
                                    {
                                        "id": f"c-evt-{uuid4().hex[:8]}",
                                        "donorId": donor_id,
                                        "purpose": "urgent_contact",
                                        "granted": False,
                                        "action": "WITHDRAW",
                                        "noticeVersion": "v1",
                                        "language": lang_val,
                                        "channel": "phone_keypad",
                                        "at": ts,
                                    },
                                )
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
                            logger.warning(
                                "Illegal transition in stream for call %s: %s", call_id, e
                            )
                            return call

                        updated_request = result.request
                        if Intent.START_ROUND in result.side_effects:
                            new_round = updated_request.round + 1
                            updated_request = updated_request.model_copy(
                                update={"round": new_round, "updated_at": ts}
                            )
                            should_dispatch_round = True

                        await tx.save_request(updated_request)
                        if result.call:
                            await tx.save_call(request_id, result.call)
                        for ev in result.timeline_events:
                            await tx.append_event(request_id, ev)
                        for oc in result.other_calls:
                            await tx.save_call(request_id, oc)

                        return result.call

                    return _handler

                final_call = await store.run_transaction(_build_dtmf_handler(digit, now_iso))

                # If round needs to be dispatched after reopening
                if should_dispatch_round:
                    refreshed_req = await store.get_request(request_id)
                    if refreshed_req:
                        donors = await select_donors_for_request(
                            store, refreshed_req, clock=clock, limit=5
                        )
                        adapter = await get_telephony_adapter(store, clock=clock)
                        await dispatch_round_calls(
                            store, refreshed_req, donors, adapter, clock=clock
                        )

                # Synthesize and stream the matching closing audio
                call_lang = "ta"
                if final_call and hasattr(final_call, "lang"):
                    call_lang = (
                        final_call.lang.value
                        if hasattr(final_call.lang, "value")
                        else str(final_call.lang)
                    )

                closing_audio = await synthesize_stream_audio(
                    chosen_closing,
                    lang=call_lang,
                    output_format="mulaw_8k",
                )

                if stream_sid:
                    await send_audio_frames(websocket, stream_sid, closing_audio)
                    await send_mark(websocket, stream_sid, f"{chosen_closing}_end")

                # Close the WebSocket so Twilio ends the call
                await websocket.close()
                return

            # D. Stop event
            if event_type == "stop":
                logger.debug("Twilio stream stopped for call %s", call_id)
                stop_playback.set()
                if timeout_task and not timeout_task.done():
                    timeout_task.cancel()
                if prompt_playing_task and not prompt_playing_task.done():
                    prompt_playing_task.cancel()
                return

    except WebSocketDisconnect:
        logger.debug("Twilio stream disconnected for call %s", call_id)
    except Exception as e:
        logger.warning("Twilio stream exception for call %s: %s", call_id, e)
    finally:
        stop_playback.set()
        if timeout_task and not timeout_task.done():
            timeout_task.cancel()
        if prompt_playing_task and not prompt_playing_task.done():
            prompt_playing_task.cancel()
