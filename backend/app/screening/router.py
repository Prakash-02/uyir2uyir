from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth.dependencies import Actor, require_staff_actor
from app.clock.service import get_clock
from app.core.models import CamelModel
from app.core.store import TransactionStore, get_store
from app.requests.models import Call
from app.requests.transitions import (
    IllegalTransition,
    apply_staff_accept,
    apply_staff_defer,
)

router = APIRouter(prefix="/calls", tags=["Screening"])


class DeferCallRequest(CamelModel):
    return_date: str | None = None


@router.post("/{call_id}/accept", response_model=Call)
async def accept_call(
    call_id: str,
    actor: Annotated[Actor, Depends(require_staff_actor)],
) -> Call:
    """Blood centre staff accepts an arriving donor after clinical screening.

    Transitions call to ACCEPTED; increments request.accepted.
    Updates donor's lastDonationDate to current date.
    """
    parts = call_id.split("_", 2)
    if len(parts) < 3:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Malformed call ID: '{call_id}'.",
        )

    request_id = parts[0]
    donor_id = parts[2]
    store = get_store()
    clock = get_clock()
    now_iso = clock.now_iso()
    today_date = clock.now().date().isoformat()

    async def _tx_accept(tx: TransactionStore) -> Call:
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

        other_calls = await tx.list_calls(request_id)

        try:
            result = apply_staff_accept(req, call, other_calls=other_calls, timestamp=now_iso)
        except IllegalTransition as e:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(e),
            ) from e

        # Save request and calls
        await tx.save_request(result.request)
        if result.call:
            await tx.save_call(request_id, result.call)

        for event in result.timeline_events:
            await tx.append_event(request_id, event)

        for oc in result.other_calls:
            await tx.save_call(request_id, oc)

        # Update donor's last donation date
        donor = await tx.get_donor(donor_id)
        if donor:
            updated_donor = donor.model_copy(update={"last_donation_date": today_date})
            await tx.save_donor(updated_donor)

        assert result.call is not None
        return result.call

    return await store.run_transaction(_tx_accept)


@router.post("/{call_id}/defer", response_model=Call)
async def defer_call(
    call_id: str,
    payload: DeferCallRequest | None = None,
    actor: Annotated[Actor, Depends(require_staff_actor)] = None,  # type: ignore
) -> Call:
    """Blood centre staff defers an arriving donor (e.g. low hemoglobin).

    Transitions call to DEFERRED; decrements request.on_the_way.
    Reopens request if covered units drop below needed.
    """
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
    return_date = payload.return_date if payload else None

    async def _tx_defer(tx: TransactionStore) -> Call:
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

        try:
            result = apply_staff_defer(req, call, return_date=return_date, timestamp=now_iso)
        except IllegalTransition as e:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(e),
            ) from e

        await tx.save_request(result.request)
        if result.call:
            await tx.save_call(request_id, result.call)

        for event in result.timeline_events:
            await tx.append_event(request_id, event)

        assert result.call is not None
        return result.call

    return await store.run_transaction(_tx_defer)
