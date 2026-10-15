from typing import Literal

from fastapi import APIRouter, HTTPException, status

from app.clock.service import get_clock
from app.core.config import get_settings
from app.core.models import CamelModel
from app.core.store import TransactionStore, get_store
from app.requests.models import Call, CallState
from app.requests.transitions import (
    IllegalTransition,
    apply_press_1,
    apply_press_2,
    apply_press_9,
)

router = APIRouter(prefix="/sim", tags=["Simulator"])


class PressKeyRequest(CamelModel):
    key: Literal["1", "2", "9"]


@router.post("/calls/{call_id}/press", response_model=Call)
async def sim_press_key(call_id: str, payload: PressKeyRequest) -> Call:
    """Simulator DTMF keypress webhook (demo mode only).

    Supported keys:
    - 1: Donor is on the way (or late accept if request paused/fulfilled).
    - 2: Donor declined.
    - 9: Donor revoked consent / opted out.

    Enforces idempotency for duplicate presses.
    Returns 404 in live mode.
    """
    settings = get_settings()
    if settings.DATA_MODE != "demo":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Simulator endpoints are not available in live data mode.",
        )

    # Call ID format: f"{requestId}_{round}_{donorId}"
    parts = call_id.split("_", 2)
    if len(parts) < 3:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Malformed call ID: '{call_id}'.",
        )

    request_id = parts[0]
    store = get_store()
    clock = get_clock()
    now_iso = clock.now_iso()

    async def _tx_handle_press(tx: TransactionStore) -> Call:
        req = await tx.get_request(request_id)
        if not req:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Blood request '{request_id}' not found.",
            )

        call = await tx.get_call(request_id, call_id)
        if not call:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Call '{call_id}' not found under request '{request_id}'.",
            )

        # Idempotency checks: duplicate presses return current call unchanged
        if payload.key == "1" and call.state in (CallState.ON_THE_WAY, CallState.LATE_ACCEPT):
            return call
        if payload.key == "2" and call.state == CallState.DECLINED:
            return call
        if payload.key == "9" and call.state == CallState.OPTED_OUT:
            return call

        try:
            if payload.key == "1":
                result = apply_press_1(req, call, timestamp=now_iso)
            elif payload.key == "2":
                result = apply_press_2(req, call, timestamp=now_iso)
            elif payload.key == "9":
                result = apply_press_9(req, call, timestamp=now_iso)
                # Opt out donor permanently in database
                donor_id = parts[2]
                donor = await tx.get_donor(donor_id)
                if donor:
                    updated_donor = donor.model_copy(
                        update={"consent_urgent": False, "active": False}
                    )
                    await tx.save_donor(updated_donor)
            else:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Unsupported key: '{payload.key}'.",
                )
        except IllegalTransition as e:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(e),
            ) from e

        # Persist updated request and call
        await tx.save_request(result.request)
        if result.call:
            await tx.save_call(request_id, result.call)

        for event in result.timeline_events:
            await tx.append_event(request_id, event)

        for oc in result.other_calls:
            await tx.save_call(request_id, oc)

        assert result.call is not None
        return result.call

    return await store.run_transaction(_tx_handle_press)
