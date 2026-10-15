import asyncio
from datetime import timedelta
from uuid import uuid4

from app.auth.constants import DEMO_STORY_REQUEST_ID
from app.clock.service import Clock, SimulationClock, get_clock
from app.core.config import get_settings
from app.core.store import Store, TransactionStore, get_store
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
from app.requests.transitions import (
    apply_press_1,
    apply_reminder_press_2,
    apply_staff_accept,
    apply_staff_defer,
)


async def run_story(
    store: Store | None = None,
    clock: Clock | None = None,
    step_delay_seconds: float = 0.5,
    req_id: str | None = None,
) -> BloodRequest:
    """Plays steps 1 to 5 of the demo story from U2U_BRIEF.md section 7.

    N = 2, so pause at covered 3, reopen below 2, fulfil at accepted 2.
    1. Hospital raises a request for 2 units of O+ red cells. Round 1 calls 5 donors (A to E). Status: OPEN.
    2. A, B, C press 1 -> covered is 3 (N+1) -> PAUSES. D and E press 1 -> LATE_ACCEPT.
    3. Staff accepts A and defers B -> accepted = 1, onTheWay = 1 (C), covered = 2 -> stays PAUSED.
    4. C cancels en route (pressed 2) -> covered = 1 (< N) -> REOPENS. Round 2 calls next 5 donors.
    5. F presses 1, staff accepts F -> accepted = 2 (N) -> FULFILLED!

    Calls service and transition functions (never writes raw documents directly).
    Advances simulated clock at each step to produce real timeline intervals.
    """
    current_store = store or get_store()
    current_clock = clock or get_clock()
    settings = get_settings()

    now_dt = current_clock.now()
    now_iso = current_clock.now_iso()
    expires_iso = (now_dt + timedelta(hours=24)).isoformat()

    hosp = await current_store.get_hospital("hosp-sample-1")
    hospital_name = hosp.name if hosp else "Sample General Hospital, Chennai"
    centre_id = hosp.centre_id if hosp and hosp.centre_id else "centre-sample-1"
    centre = await current_store.get_centre(centre_id)
    centre_name = centre.name if centre else "Central Blood Bank, Egmore (Simulated)"

    req_id = req_id or DEMO_STORY_REQUEST_ID

    # Clean up previous calls and events if re-running on the same request ID
    old_calls = await current_store.list_calls(req_id)
    if old_calls:
        if hasattr(current_store, "_calls") and isinstance(current_store._calls, dict):
            current_store._calls[req_id] = {}
        if hasattr(current_store, "client") and hasattr(current_store.client, "collection"):
            for oc in old_calls:
                await (
                    current_store.client.collection("requests")
                    .document(req_id)
                    .collection("calls")
                    .document(oc.id)
                    .delete()
                )

    old_events = await current_store.list_events(req_id)
    if old_events:
        if hasattr(current_store, "_events") and isinstance(current_store._events, dict):
            current_store._events[req_id] = []
        if hasattr(current_store, "client") and hasattr(current_store.client, "collection"):
            for oe in old_events:
                await (
                    current_store.client.collection("requests")
                    .document(req_id)
                    .collection("events")
                    .document(oe.id)
                    .delete()
                )

    # Reset daily calls and donor donation dates so demo story is repeatable
    if settings.DATA_MODE == "demo":
        await current_store.set_config(
            "daily_calls",
            {"count": 0, "date": current_clock.now().date().isoformat(), "isSimulated": True},
        )
        all_donors = await current_store.list_donors()
        for d in all_donors:
            if d.last_donation_date is not None:
                await current_store.save_donor(d.model_copy(update={"last_donation_date": None}))

    # --- Step 1: Hospital raises request ---
    req = BloodRequest(
        id=req_id,
        hospital_id="hosp-sample-1",
        hospital_name=hospital_name,
        centre_id=centre_id,
        centre_name=centre_name,
        blood_group=BloodGroup.O_POS,
        component=Component.RED_CELLS,
        units_needed=2,
        status=RequestStatus.OPEN,
        accepted=0,
        on_the_way=0,
        round=1,
        created_at=now_iso,
        updated_at=now_iso,
        expires_at=expires_iso,
        is_simulated=settings.DATA_MODE == "demo",
        patient_ref="IP-DEMO-STORY",
    )
    await current_store.save_request(req)

    evt1 = TimelineEvent(
        id=f"evt-{uuid4().hex[:8]}",
        request_id=req_id,
        at=now_iso,
        kind="STORY_STEP",
        text="Story step 1: Hospital raises urgent request for 2 units of O+ RED_CELLS. Round 1 calls 5 donors (A to E). Status: OPEN.",
    )
    await current_store.append_event(req_id, evt1)

    donors_r1 = await select_donors_for_request(current_store, req, clock=current_clock, limit=5)
    adapter = SimulatorAdapter(current_store, clock=current_clock)
    await dispatch_round_calls(current_store, req, donors_r1, adapter, clock=current_clock)

    if step_delay_seconds > 0:
        await asyncio.sleep(step_delay_seconds)

    # Advance clock 2 minutes for step 2
    if isinstance(current_clock, SimulationClock):
        current_clock.advance_seconds(120)
    now_iso = current_clock.now_iso()

    # --- Step 2: A, B, C press 1 -> covered reaches 3 (N+1) -> PAUSES. D, E press 1 -> LATE_ACCEPT ---
    calls_r1 = await current_store.list_calls(req_id)
    sorted_r1 = sorted(calls_r1, key=lambda c: c.distance_km)

    for c in sorted_r1[:3]:

        async def _press_1_tx(tx: TransactionStore, call_obj=c) -> None:
            r = await tx.get_request(req_id)
            call_live = await tx.get_call(req_id, call_obj.id)
            if r and call_live:
                res = apply_press_1(r, call_live, timestamp=now_iso)
                await tx.save_request(res.request)
                if res.call:
                    await tx.save_call(req_id, res.call)
                for e in res.timeline_events:
                    await tx.append_event(req_id, e)

        await current_store.run_transaction(_press_1_tx)

    # D and E press 1 too late (LATE_ACCEPT)
    for c in sorted_r1[3:5]:

        async def _press_late_tx(tx: TransactionStore, call_obj=c) -> None:
            r = await tx.get_request(req_id)
            call_live = await tx.get_call(req_id, call_obj.id)
            if r and call_live:
                res = apply_press_1(r, call_live, timestamp=now_iso)
                await tx.save_request(res.request)
                if res.call:
                    await tx.save_call(req_id, res.call)
                for e in res.timeline_events:
                    await tx.append_event(req_id, e)

        await current_store.run_transaction(_press_late_tx)

    evt2 = TimelineEvent(
        id=f"evt-{uuid4().hex[:8]}",
        request_id=req_id,
        at=now_iso,
        kind="STORY_STEP",
        text="Story step 2: Donors A, B, C press 1 (covered reaches 3, N+1). Request PAUSES. Donors D and E press 1 too late (LATE_ACCEPT).",
    )
    await current_store.append_event(req_id, evt2)

    if step_delay_seconds > 0:
        await asyncio.sleep(step_delay_seconds)

    # Advance clock 4 minutes for step 3
    if isinstance(current_clock, SimulationClock):
        current_clock.advance_seconds(240)
    now_iso = current_clock.now_iso()
    today_date = current_clock.now().date().isoformat()

    # --- Step 3: Staff accept A and defer B ---
    call_a = sorted_r1[0]
    call_b = sorted_r1[1]

    async def _tx_accept_a(tx: TransactionStore) -> None:
        r = await tx.get_request(req_id)
        ca = await tx.get_call(req_id, call_a.id)
        other_calls = await tx.list_calls(req_id)
        donor_a_id = call_a.id.split("_")[-1]
        donor_a = await tx.get_donor(donor_a_id)

        if r and ca:
            res = apply_staff_accept(r, ca, other_calls=other_calls, timestamp=now_iso)
            await tx.save_request(res.request)
            if res.call:
                await tx.save_call(req_id, res.call)
            for e in res.timeline_events:
                await tx.append_event(req_id, e)
            if donor_a:
                await tx.save_donor(donor_a.model_copy(update={"last_donation_date": today_date}))

    await current_store.run_transaction(_tx_accept_a)

    async def _tx_defer_b(tx: TransactionStore) -> None:
        r = await tx.get_request(req_id)
        cb = await tx.get_call(req_id, call_b.id)
        if r and cb:
            res = apply_staff_defer(r, cb, return_date=None, timestamp=now_iso)
            await tx.save_request(res.request)
            if res.call:
                await tx.save_call(req_id, res.call)
            for e in res.timeline_events:
                await tx.append_event(req_id, e)

    await current_store.run_transaction(_tx_defer_b)

    evt3 = TimelineEvent(
        id=f"evt-{uuid4().hex[:8]}",
        request_id=req_id,
        at=now_iso,
        kind="STORY_STEP",
        text="Story step 3: Staff accepts Donor A and defers Donor B. Accepted = 1, on the way = 1 (Donor C). Covered = 2. Request stays PAUSED.",
    )
    await current_store.append_event(req_id, evt3)

    if step_delay_seconds > 0:
        await asyncio.sleep(step_delay_seconds)

    # Advance clock 3 minutes for step 4
    if isinstance(current_clock, SimulationClock):
        current_clock.advance_seconds(180)
    now_iso = current_clock.now_iso()

    # --- Step 4: Donor C cancels en route (pressed 2) -> covered = 1 (< N) -> REOPENS ---
    call_c = sorted_r1[2]

    async def _tx_cancel_c(tx: TransactionStore) -> None:
        r = await tx.get_request(req_id)
        cc = await tx.get_call(req_id, call_c.id)
        if r and cc:
            res = apply_reminder_press_2(r, cc, timestamp=now_iso)
            new_r = res.request.model_copy(update={"round": 2})
            await tx.save_request(new_r)
            if res.call:
                await tx.save_call(req_id, res.call)
            for e in res.timeline_events:
                await tx.append_event(req_id, e)

    await current_store.run_transaction(_tx_cancel_c)

    # Dispatch round 2
    req_r2 = await current_store.get_request(req_id)
    if req_r2:
        donors_r2 = await select_donors_for_request(
            current_store, req_r2, clock=current_clock, limit=5
        )
        await dispatch_round_calls(current_store, req_r2, donors_r2, adapter, clock=current_clock)

    evt4 = TimelineEvent(
        id=f"evt-{uuid4().hex[:8]}",
        request_id=req_id,
        at=now_iso,
        kind="STORY_STEP",
        text="Story step 4: Donor C cancels (pressed 2). Covered drops to 1 (< N). Request REOPENS! Automated dialer dispatches Round 2.",
    )
    await current_store.append_event(req_id, evt4)

    if step_delay_seconds > 0:
        await asyncio.sleep(step_delay_seconds)

    # Advance clock 5 minutes for step 5
    if isinstance(current_clock, SimulationClock):
        current_clock.advance_seconds(300)
    now_iso = current_clock.now_iso()
    today_date = current_clock.now().date().isoformat()

    # --- Step 5: Donor F (first of round 2) presses 1, staff accepts F -> FULFILLED! ---
    calls_all = await current_store.list_calls(req_id)
    round_2_calls = [c for c in calls_all if c.round == 2]
    call_f = round_2_calls[0] if round_2_calls else None

    if call_f:
        # F presses 1
        async def _tx_press_f(tx: TransactionStore) -> None:
            r = await tx.get_request(req_id)
            cf = await tx.get_call(req_id, call_f.id)
            if r and cf:
                res = apply_press_1(r, cf, timestamp=now_iso)
                await tx.save_request(res.request)
                if res.call:
                    await tx.save_call(req_id, res.call)
                for e in res.timeline_events:
                    await tx.append_event(req_id, e)

        await current_store.run_transaction(_tx_press_f)

        # Staff accepts F
        async def _tx_accept_f(tx: TransactionStore) -> None:
            r = await tx.get_request(req_id)
            cf = await tx.get_call(req_id, call_f.id)
            all_calls_now = await tx.list_calls(req_id)
            donor_f_id = call_f.id.split("_")[-1]
            donor_f = await tx.get_donor(donor_f_id)

            if r and cf:
                res = apply_staff_accept(r, cf, other_calls=all_calls_now, timestamp=now_iso)
                await tx.save_request(res.request)
                if res.call:
                    await tx.save_call(req_id, res.call)
                for e in res.timeline_events:
                    await tx.append_event(req_id, e)
                for oc in res.other_calls:
                    await tx.save_call(req_id, oc)
                if donor_f:
                    await tx.save_donor(
                        donor_f.model_copy(update={"last_donation_date": today_date})
                    )

        await current_store.run_transaction(_tx_accept_f)

    evt5 = TimelineEvent(
        id=f"evt-{uuid4().hex[:8]}",
        request_id=req_id,
        at=now_iso,
        kind="STORY_STEP",
        text="Story step 5: Donor F presses 1, staff accepts Donor F. Accepted reaches 2 (Target reached). Request FULFILLED!",
    )
    await current_store.append_event(req_id, evt5)

    final_req = await current_store.get_request(req_id)
    assert final_req is not None
    assert final_req.status == RequestStatus.FULFILLED
    return final_req
