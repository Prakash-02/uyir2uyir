from datetime import timedelta
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import Field

from app.auth.dependencies import Actor, get_actor, require_hospital_actor
from app.clock.service import get_clock
from app.core.config import get_settings
from app.core.models import CamelModel
from app.core.store import TransactionStore, get_store
from app.matching.service import select_donors_for_request
from app.outreach.adapter import SimulatorAdapter
from app.outreach.service import dispatch_round_calls
from app.requests.models import (
    BloodGroup,
    BloodRequest,
    Component,
    RequestStatus,
    TimelineEvent,
)
from app.requests.transitions import IllegalTransition, apply_hospital_cancel

router = APIRouter(prefix="/requests", tags=["Requests"])


class CreateBloodRequestInput(CamelModel):
    blood_group: BloodGroup
    component: Component
    units_needed: int = Field(ge=1, le=6)
    patient_ref: str | None = None
    hospital_id: str | None = None
    hospital_name: str | None = None
    centre_id: str | None = None
    centre_name: str | None = None


class PublicStatus(CamelModel):
    id: str
    hospital_name: str
    blood_group: BloodGroup
    component: Component
    status: RequestStatus


@router.post("", response_model=BloodRequest, status_code=status.HTTP_201_CREATED)
async def create_request(
    payload: CreateBloodRequestInput,
    actor: Annotated[Actor, Depends(require_hospital_actor)],
) -> BloodRequest:
    """Hospital raises an urgent blood request.

    Creating a request immediately opens round 1 outreach:
    picks up to 5 compatible donors and dispatches calls.
    """
    settings = get_settings()
    store = get_store()
    clock = get_clock()
    now_dt = clock.now()
    now_iso = now_dt.isoformat()
    expires_iso = (now_dt + timedelta(hours=24)).isoformat()

    hospital_id = payload.hospital_id or actor.hospital_id or "hosp-sample-1"
    hosp = await store.get_hospital(hospital_id)
    hospital_name = payload.hospital_name or (hosp.name if hosp else "Sample General Hospital")
    centre_id = payload.centre_id or (
        hosp.centre_id if hosp and hosp.centre_id else "centre-sample-1"
    )
    centre = await store.get_centre(centre_id)
    centre_name = payload.centre_name or (
        centre.name if centre else "Central Blood Bank (Simulated)"
    )

    req_id = f"req-{uuid4().hex[:8]}"

    blood_request = BloodRequest(
        id=req_id,
        hospital_id=hospital_id,
        hospital_name=hospital_name,
        centre_id=centre_id,
        centre_name=centre_name,
        blood_group=payload.blood_group,
        component=payload.component,
        units_needed=payload.units_needed,
        status=RequestStatus.OPEN,
        accepted=0,
        on_the_way=0,
        round=1,
        created_at=now_iso,
        updated_at=now_iso,
        expires_at=expires_iso,
        is_simulated=settings.DATA_MODE == "demo",
        patient_ref=payload.patient_ref,
    )

    await store.save_request(blood_request)

    initial_event = TimelineEvent(
        id=f"evt-{uuid4().hex[:8]}",
        request_id=req_id,
        at=now_iso,
        kind="REQUEST_RAISED",
        text=f"Hospital raised urgent request for {blood_request.units_needed} units of {blood_request.blood_group} {blood_request.component}.",
    )
    await store.append_event(req_id, initial_event)

    # Immediately open round 1 outreach
    donors = await select_donors_for_request(store, blood_request, clock=clock, limit=5)
    adapter = SimulatorAdapter(store, clock=clock)
    await dispatch_round_calls(store, blood_request, donors, adapter, clock=clock)

    # Return refreshed request
    saved_req = await store.get_request(req_id)
    return saved_req or blood_request


@router.post("/{request_id}/cancel", response_model=BloodRequest)
async def cancel_request(
    request_id: str,
    actor: Annotated[Actor, Depends(require_hospital_actor)],
) -> BloodRequest:
    """Hospital cancels an active blood request.

    Transitions status to CANCELLED and stands down active outreach.
    """
    store = get_store()
    clock = get_clock()
    now_iso = clock.now_iso()

    async def _tx_cancel(tx: TransactionStore) -> BloodRequest:
        req = await tx.get_request(request_id)
        if not req:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Blood request '{request_id}' not found.",
            )

        active_calls = await tx.list_calls(request_id)

        try:
            result = apply_hospital_cancel(req, active_calls=active_calls, timestamp=now_iso)
        except IllegalTransition as e:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=str(e),
            ) from e

        await tx.save_request(result.request)
        for event in result.timeline_events:
            await tx.append_event(request_id, event)
        for oc in result.other_calls:
            await tx.save_call(request_id, oc)

        return result.request

    return await store.run_transaction(_tx_cancel)


@router.get("/{request_id}/status", response_model=PublicStatus)
async def get_request_status(
    request_id: str,
    _actor: Annotated[Actor, Depends(get_actor)],
) -> PublicStatus:
    """Public status endpoint stripping all private patient and donor data."""
    store = get_store()
    req = await store.get_request(request_id)
    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Blood request '{request_id}' not found.",
        )

    return PublicStatus(
        id=req.id,
        hospital_name=req.hospital_name,
        blood_group=req.blood_group,
        component=req.component,
        status=req.status,
    )
