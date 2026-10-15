from datetime import datetime, timedelta
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Header, HTTPException, status

from app.clock.service import Clock, get_clock
from app.core.config import get_settings
from app.core.store import Store, TransactionStore, get_store
from app.matching.service import select_donors_for_request
from app.outreach.adapter import SimulatorAdapter
from app.outreach.service import dispatch_round_calls
from app.requests.models import CallState, RequestStatus, TimelineEvent
from app.requests.transitions import apply_call_no_answer, apply_expire

router = APIRouter(prefix="/internal", tags=["Internal"])

FINISHED_CALL_STATES = frozenset(
    {
        CallState.ACCEPTED,
        CallState.DEFERRED,
        CallState.DECLINED,
        CallState.NO_ANSWER,
        CallState.OPTED_OUT,
        CallState.LATE_ACCEPT,
        CallState.CANCELLED,
    }
)


def _verify_internal_token(
    internal_token: str | None,
    x_internal_token: str | None,
    authorization: str | None,
) -> None:
    settings = get_settings()
    expected = settings.INTERNAL_TOKEN

    token = internal_token or x_internal_token
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization[7:].strip()

    # 1. Local or configured shared secret match (used in unit tests and local dev)
    if token and token == expected:
        return

    # 2. Google Cloud Scheduler OIDC token verification in the cloud
    if authorization and authorization.startswith("Bearer "):
        bearer_token = authorization[7:].strip()
        try:
            from google.auth.transport import requests as google_requests
            from google.oauth2 import id_token

            expected_audience = settings.PUBLIC_BASE_URL.rstrip("/")
            claims = id_token.verify_oauth2_token(
                bearer_token,
                google_requests.Request(),
                audience=expected_audience,
            )

            expected_email = settings.SCHEDULER_SERVICE_ACCOUNT
            if not expected_email and settings.GOOGLE_CLOUD_PROJECT:
                expected_email = (
                    f"sa-scheduler@{settings.GOOGLE_CLOUD_PROJECT}.iam.gserviceaccount.com"
                )

            token_email = claims.get("email")
            if expected_email and token_email != expected_email:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail=(
                        f"OIDC token email '{token_email}' does not match expected "
                        f"scheduler service account '{expected_email}'."
                    ),
                )
            return
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Invalid OIDC token: {exc}",
            ) from exc

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid or missing internal token or OIDC credentials.",
    )


async def _expire_request_if_needed(store: Store, req_id: str, now_iso: str) -> bool:
    """Expires a request past expiresAt inside a transaction."""
    did_expire = False

    async def _tx_expire(tx: TransactionStore) -> None:
        nonlocal did_expire
        current_req = await tx.get_request(req_id)
        if current_req and current_req.status in (
            RequestStatus.OPEN,
            RequestStatus.PAUSED,
            RequestStatus.AWAITING_HOSPITAL,
        ):
            active_calls = await tx.list_calls(req_id)
            res = apply_expire(current_req, active_calls=active_calls, timestamp=now_iso)
            await tx.save_request(res.request)
            for evt in res.timeline_events:
                await tx.append_event(req_id, evt)
            for oc in res.other_calls:
                await tx.save_call(req_id, oc)
            did_expire = True

    await store.run_transaction(_tx_expire)
    return did_expire


async def _advance_request_round(
    store: Store,
    req_id: str,
    expected_round: int,
    timed_out: bool,
    now_iso: str,
    clock: Clock,
) -> bool:
    """Guarded advancement of a request to the next outreach round."""
    advanced_new_round: int | None = None

    async def _tx_advance(tx: TransactionStore) -> None:
        nonlocal advanced_new_round
        current_req = await tx.get_request(req_id)
        # Guard: status is OPEN, round matches
        if (
            not current_req
            or current_req.status != RequestStatus.OPEN
            or current_req.round != expected_round
        ):
            return

        # If round timed out, mark remaining un-finished calls as NO_ANSWER
        if timed_out:
            round_calls = await tx.list_calls(req_id)
            for c in round_calls:
                if c.round == current_req.round and c.state in (
                    CallState.QUEUED,
                    CallState.DIALING,
                    CallState.RINGING,
                ):
                    res = apply_call_no_answer(current_req, c, timestamp=now_iso)
                    if res.call:
                        await tx.save_call(req_id, res.call)
                    for evt in res.timeline_events:
                        await tx.append_event(req_id, evt)

        new_round = current_req.round + 1
        updated = current_req.model_copy(update={"round": new_round, "updated_at": now_iso})
        await tx.save_request(updated)

        event = TimelineEvent(
            id=f"evt-{uuid4().hex[:8]}",
            request_id=req_id,
            at=now_iso,
            kind="ROUND_OPENED",
            text=f"Opened call round {new_round}.",
        )
        await tx.append_event(req_id, event)
        advanced_new_round = new_round

    await store.run_transaction(_tx_advance)

    if advanced_new_round is not None:
        # Dispatch calls after transaction commit
        refreshed = await store.get_request(req_id)
        if refreshed:
            next_donors = await select_donors_for_request(store, refreshed, clock=clock, limit=5)
            adapter = SimulatorAdapter(store, clock=clock)
            await dispatch_round_calls(store, refreshed, next_donors, adapter, clock=clock)
        return True

    return False


@router.post("/tick")
async def internal_tick(
    internal_token: Annotated[str | None, Header(alias="INTERNAL_TOKEN")] = None,
    x_internal_token: Annotated[str | None, Header(alias="X-Internal-Token")] = None,
    authorization: Annotated[str | None, Header(alias="Authorization")] = None,
) -> dict[str, str | int]:
    """1-minute clock ticker for request expiration sweeps and round progression.

    Rules:
    - Protected by shared header INTERNAL_TOKEN.
    - Takes a 50-second lease in locks/tick. If lease is already held, returns 200 immediately.
    - Sweeps active requests and expires any past expiresAt.
    - Opens next round if all calls in current round finished OR round timeout has passed.
    - Round timeout: 180s (3 min) standard, 300s (5 min) if weather alert is on.
    - Guards each round advancement with 'status is OPEN, round matches'.
    """
    _verify_internal_token(internal_token, x_internal_token, authorization)

    store = get_store()
    clock = get_clock()
    now_dt = clock.now()
    now_iso = clock.now_iso()

    # 1. Acquire 50-second lease on locks/tick
    lock = await store.get_lock("tick")
    if lock and lock.get("leaseUntil"):
        try:
            lease_until = datetime.fromisoformat(lock["leaseUntil"])
            if lease_until > now_dt:
                return {"status": "skipped", "reason": "lease_held"}
        except ValueError:
            pass

    # Acquire lease
    new_lease_until = (now_dt + timedelta(seconds=50)).isoformat()
    await store.set_lock(
        "tick",
        {
            "leaseUntil": new_lease_until,
            "acquiredAt": now_iso,
            "holder": "tick-worker",
        },
    )

    # 2. Determine round timeout based on config/app.weatherAlert
    app_conf = await store.get_config("app") or {}
    weather_alert = bool(app_conf.get("weatherAlert", False))
    round_timeout_seconds = 300 if weather_alert else 180

    all_requests = await store.list_all_requests()
    expired_count = 0
    rounds_opened = 0

    for req in all_requests:
        # A. Expiration sweep
        if (
            req.status
            in (
                RequestStatus.OPEN,
                RequestStatus.PAUSED,
                RequestStatus.AWAITING_HOSPITAL,
            )
            and req.expires_at <= now_iso
        ):
            did_expire = await _expire_request_if_needed(store, req.id, now_iso)
            if did_expire:
                expired_count += 1
            continue

        # B. Round progression
        if req.status == RequestStatus.OPEN:
            calls = await store.list_calls(req.id)
            current_round_calls = [c for c in calls if c.round == req.round]

            all_finished = len(current_round_calls) > 0 and all(
                c.state in FINISHED_CALL_STATES for c in current_round_calls
            )

            # Calculate elapsed time for current round
            timed_out = False
            if current_round_calls:
                try:
                    round_start_str = min(c.updated_at for c in current_round_calls)
                    round_start_dt = datetime.fromisoformat(round_start_str)
                    elapsed = (now_dt - round_start_dt).total_seconds()
                    timed_out = elapsed >= round_timeout_seconds
                except ValueError:
                    timed_out = False
            else:
                try:
                    req_updated_dt = datetime.fromisoformat(req.updated_at)
                    elapsed = (now_dt - req_updated_dt).total_seconds()
                    timed_out = elapsed >= round_timeout_seconds
                except ValueError:
                    timed_out = False

            if all_finished or timed_out:
                advanced = await _advance_request_round(
                    store=store,
                    req_id=req.id,
                    expected_round=req.round,
                    timed_out=timed_out,
                    now_iso=now_iso,
                    clock=clock,
                )
                if advanced:
                    rounds_opened += 1

    return {
        "status": "ok",
        "expired": expired_count,
        "roundsOpened": rounds_opened,
    }
