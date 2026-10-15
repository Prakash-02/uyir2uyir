import asyncio
import os
from datetime import UTC, datetime

import pytest

from app.core.entities import Centre, Donor, Hospital
from app.core.store_firestore import FirestoreStore
from app.core.store_memory import MemoryStore
from app.requests.models import (
    BloodGroup,
    BloodRequest,
    Call,
    CallState,
    Component,
    Lang,
    RequestStatus,
)
from app.requests.transitions import (
    apply_press_1,
    apply_reminder_press_2,
    apply_staff_accept,
    apply_staff_defer,
)


def _now() -> str:
    return datetime.now(UTC).isoformat()


@pytest.fixture
def memory_store() -> MemoryStore:
    store = MemoryStore(data_mode="demo")
    store.reset()
    return store


async def test_memory_store_basic_crud(memory_store: MemoryStore) -> None:
    """Verifies basic entity CRUD and list filters on MemoryStore."""
    # Hospitals
    hosp = Hospital(
        id="hosp-1",
        name="Apollo Hospital",
        centre_id="c-1",
        area="Greams Road",
        city="Chennai",
    )
    await memory_store.save_hospital(hosp)
    fetched_hosp = await memory_store.get_hospital("hosp-1")
    assert fetched_hosp is not None
    assert fetched_hosp.name == "Apollo Hospital"
    assert fetched_hosp.is_simulated is True

    # Centres
    centre = Centre(
        id="c-1",
        name="Chennai Central Blood Centre",
        area="Central",
        city="Chennai",
    )
    await memory_store.save_centre(centre)
    fetched_centre = await memory_store.get_centre("c-1")
    assert fetched_centre is not None
    assert fetched_centre.name == "Chennai Central Blood Centre"

    # Donors
    donor = Donor(
        id="d-1",
        alias="Donor A1",
        blood_group=BloodGroup.O_POS,
        lang=Lang.TA,
        area="Adyar",
    )
    await memory_store.save_donor(donor)
    fetched_donor = await memory_store.get_donor("d-1")
    assert fetched_donor is not None
    assert fetched_donor.alias == "Donor A1"

    # Config
    await memory_store.set_config("app", {"weatherAlert": True})
    conf = await memory_store.get_config("app")
    assert conf is not None
    assert conf["weatherAlert"] is True


async def test_memory_store_requests_and_calls_listing(memory_store: MemoryStore) -> None:
    """Verifies listing requests by hospitalId/centreId and calls under a request."""
    req1 = BloodRequest(
        id="req-1",
        hospital_id="hosp-1",
        hospital_name="Apollo Hospital",
        centre_id="c-1",
        centre_name="Chennai Central",
        blood_group=BloodGroup.O_POS,
        component=Component.RED_CELLS,
        units_needed=2,
        status=RequestStatus.OPEN,
        accepted=0,
        on_the_way=0,
        round=1,
        created_at=_now(),
        updated_at=_now(),
        expires_at=_now(),
        is_simulated=True,
    )
    req2 = BloodRequest(
        id="req-2",
        hospital_id="hosp-2",
        hospital_name="Fortis Hospital",
        centre_id="c-1",
        centre_name="Chennai Central",
        blood_group=BloodGroup.A_POS,
        component=Component.PLATELETS_SDP,
        units_needed=1,
        status=RequestStatus.OPEN,
        accepted=0,
        on_the_way=0,
        round=1,
        created_at=_now(),
        updated_at=_now(),
        expires_at=_now(),
        is_simulated=True,
    )
    await memory_store.save_request(req1)
    await memory_store.save_request(req2)

    by_hosp1 = await memory_store.list_requests_by_hospital("hosp-1")
    assert len(by_hosp1) == 1
    assert by_hosp1[0].id == "req-1"

    by_c1 = await memory_store.list_requests_by_centre("c-1")
    assert len(by_c1) == 2

    # Calls under req-1
    call1 = Call(
        id="call-1",
        request_id="req-1",
        donor_alias="Donor A1",
        blood_group=BloodGroup.O_POS,
        lang=Lang.TA,
        state=CallState.RINGING,
        round=1,
        distance_km=2.5,
        updated_at=_now(),
    )
    await memory_store.save_call("req-1", call1)
    calls = await memory_store.list_calls("req-1")
    assert len(calls) == 1
    assert calls[0].id == "call-1"


async def test_memory_store_transaction_rollback_on_error(memory_store: MemoryStore) -> None:
    """Verifies that exceptions inside run_transaction abort pending mutations."""
    req = BloodRequest(
        id="req-roll",
        hospital_id="hosp-1",
        hospital_name="Apollo Hospital",
        centre_id="c-1",
        centre_name="Chennai Central",
        blood_group=BloodGroup.O_POS,
        component=Component.RED_CELLS,
        units_needed=2,
        status=RequestStatus.OPEN,
        accepted=0,
        on_the_way=0,
        round=1,
        created_at=_now(),
        updated_at=_now(),
        expires_at=_now(),
        is_simulated=True,
    )
    await memory_store.save_request(req)

    with pytest.raises(ValueError, match="Simulated transaction error"):

        async def _failing_tx(tx):
            r = await tx.get_request("req-roll")
            assert r is not None
            r_updated = r.model_copy(update={"accepted": 1})
            await tx.save_request(r_updated)
            raise ValueError("Simulated transaction error")

        await memory_store.run_transaction(_failing_tx)

    # State must be unchanged
    stored_req = await memory_store.get_request("req-roll")
    assert stored_req is not None
    assert stored_req.accepted == 0


async def test_domain_story_replayed_through_transactions(memory_store: MemoryStore) -> None:
    """Replays the Section 7 demo story (2 units O+ red cells) through store.run_transaction.

    Verifies:
    - Step 1: Request OPEN, 5 donors called (A..E)
    - Step 2: A, B, C press 1 -> covered reaches 3 (N+1) -> PAUSED
              D, E press 1 late -> LATE_ACCEPT
    - Step 3: Staff accept A & defer B -> request remains PAUSED
    - Step 4: C cancels arrival -> covered drops to 1 (< N) -> REOPENS to OPEN
    - Step 5: Round 2 donor F presses 1 and is staff accepted -> FULFILLED (accepted=2)
    """
    req_id = "req-story-tx"

    # Step 1: Initial request
    initial_req = BloodRequest(
        id=req_id,
        hospital_id="hosp-1",
        hospital_name="Sample General Hospital",
        centre_id="centre-1",
        centre_name="Central Blood Bank",
        blood_group=BloodGroup.O_POS,
        component=Component.RED_CELLS,
        units_needed=2,
        status=RequestStatus.OPEN,
        accepted=0,
        on_the_way=0,
        round=1,
        created_at=_now(),
        updated_at=_now(),
        expires_at=_now(),
        is_simulated=True,
    )
    await memory_store.save_request(initial_req)

    donor_aliases = ["Donor A", "Donor B", "Donor C", "Donor D", "Donor E"]
    for i, alias in enumerate(donor_aliases, start=1):
        call = Call(
            id=f"c-{i}",
            request_id=req_id,
            donor_alias=alias,
            blood_group=BloodGroup.O_POS,
            lang=Lang.TA,
            state=CallState.RINGING,
            round=1,
            distance_km=2.0 + i,
            updated_at=_now(),
        )
        await memory_store.save_call(req_id, call)

    # Step 2: A, B, C press 1 in separate transactions
    for i in [1, 2, 3]:

        async def _press_1(tx, call_id=f"c-{i}"):
            req = await tx.get_request(req_id)
            call = await tx.get_call(req_id, call_id)
            res = apply_press_1(req, call)
            await tx.save_request(res.request)
            await tx.save_call(req_id, res.call)
            for evt in res.timeline_events:
                await tx.append_event(req_id, evt)

        await memory_store.run_transaction(_press_1)

    req_after_c = await memory_store.get_request(req_id)
    assert req_after_c is not None
    assert req_after_c.status == RequestStatus.PAUSED
    assert req_after_c.on_the_way == 3

    # D and E press 1 late while PAUSED
    for i in [4, 5]:

        async def _late_press_1(tx, call_id=f"c-{i}"):
            req = await tx.get_request(req_id)
            call = await tx.get_call(req_id, call_id)
            res = apply_press_1(req, call)
            await tx.save_request(res.request)
            await tx.save_call(req_id, res.call)
            for evt in res.timeline_events:
                await tx.append_event(req_id, evt)

        await memory_store.run_transaction(_late_press_1)

    call_d = await memory_store.get_call(req_id, "c-4")
    call_e = await memory_store.get_call(req_id, "c-5")
    assert call_d.state == CallState.LATE_ACCEPT
    assert call_e.state == CallState.LATE_ACCEPT

    # Step 3: Staff accept A and defer B
    async def _staff_accept_a(tx):
        req = await tx.get_request(req_id)
        call = await tx.get_call(req_id, "c-1")
        res = apply_staff_accept(req, call)
        await tx.save_request(res.request)
        await tx.save_call(req_id, res.call)
        for evt in res.timeline_events:
            await tx.append_event(req_id, evt)

    await memory_store.run_transaction(_staff_accept_a)

    async def _staff_defer_b(tx):
        req = await tx.get_request(req_id)
        call = await tx.get_call(req_id, "c-2")
        res = apply_staff_defer(req, call, return_date="2026-11-15")
        await tx.save_request(res.request)
        await tx.save_call(req_id, res.call)
        for evt in res.timeline_events:
            await tx.append_event(req_id, evt)

    await memory_store.run_transaction(_staff_defer_b)

    req_step3 = await memory_store.get_request(req_id)
    assert req_step3.status == RequestStatus.PAUSED
    assert req_step3.accepted == 1
    assert req_step3.on_the_way == 1  # Only C remains en route

    # Step 4: C cancels via reminder -> drops coverage below N -> REOPENS to OPEN
    async def _reminder_cancel_c(tx):
        req = await tx.get_request(req_id)
        call = await tx.get_call(req_id, "c-3")
        res = apply_reminder_press_2(req, call)
        await tx.save_request(res.request)
        await tx.save_call(req_id, res.call)
        for evt in res.timeline_events:
            await tx.append_event(req_id, evt)

    await memory_store.run_transaction(_reminder_cancel_c)

    req_step4 = await memory_store.get_request(req_id)
    assert req_step4.status == RequestStatus.OPEN
    assert req_step4.on_the_way == 0
    assert req_step4.accepted == 1

    # Step 5: Round 2 dispatched (Call F). F presses 1, staff accepts F -> FULFILLED
    call_f = Call(
        id="c-f",
        request_id=req_id,
        donor_alias="Donor F",
        blood_group=BloodGroup.O_POS,
        lang=Lang.TA,
        state=CallState.RINGING,
        round=2,
        distance_km=4.5,
        updated_at=_now(),
    )
    call_g = Call(
        id="c-g",
        request_id=req_id,
        donor_alias="Donor G",
        blood_group=BloodGroup.O_POS,
        lang=Lang.TA,
        state=CallState.RINGING,
        round=2,
        distance_km=5.0,
        updated_at=_now(),
    )
    await memory_store.save_call(req_id, call_f)
    await memory_store.save_call(req_id, call_g)

    # F presses 1
    async def _press_1_f(tx):
        req = await tx.get_request(req_id)
        call = await tx.get_call(req_id, "c-f")
        res = apply_press_1(req, call)
        await tx.save_request(res.request)
        await tx.save_call(req_id, res.call)

    await memory_store.run_transaction(_press_1_f)

    # Staff accepts F
    async def _staff_accept_f(tx):
        req = await tx.get_request(req_id)
        call = await tx.get_call(req_id, "c-f")
        all_calls = await tx.list_calls(req_id)
        res = apply_staff_accept(req, call, other_calls=all_calls)
        await tx.save_request(res.request)
        await tx.save_call(req_id, res.call)
        for oc in res.other_calls:
            await tx.save_call(req_id, oc)
        for evt in res.timeline_events:
            await tx.append_event(req_id, evt)

    await memory_store.run_transaction(_staff_accept_f)

    # Final verification
    final_req = await memory_store.get_request(req_id)
    assert final_req is not None
    assert final_req.status == RequestStatus.FULFILLED
    assert final_req.accepted == 2
    assert final_req.on_the_way == 0

    # Ringing call G must be cancelled on fulfillment
    final_g = await memory_store.get_call(req_id, "c-g")
    assert final_g.state == CallState.CANCELLED

    # Events timeline check
    events = await memory_store.list_events(req_id)
    assert len(events) >= 5


@pytest.mark.emulator
@pytest.mark.skipif(
    not os.getenv("FIRESTORE_EMULATOR_HOST"),
    reason="Firestore emulator not running (FIRESTORE_EMULATOR_HOST not set)",
)
async def test_concurrent_press_1_firestore_emulator() -> None:
    """Tests 10 concurrent press 1 transactions against the Firestore emulator.

    Checks that transaction retries handle concurrency cleanly and the pause rule
    (covered >= N + 1) holds under high contention:
    - N = 2 units needed
    - Exactly 3 calls become ON_THE_WAY
    - Exactly 7 calls become LATE_ACCEPT
    - Request ends in PAUSED status with on_the_way == 3
    """
    store = FirestoreStore(
        data_mode="demo",
        database="u2u-demo",
        project="u2u-emulator-test",
    )

    req_id = "req-concurrent-emu"
    req = BloodRequest(
        id=req_id,
        hospital_id="hosp-emu",
        hospital_name="Emulator Hospital",
        centre_id="centre-emu",
        centre_name="Emulator Centre",
        blood_group=BloodGroup.O_POS,
        component=Component.RED_CELLS,
        units_needed=2,
        status=RequestStatus.OPEN,
        accepted=0,
        on_the_way=0,
        round=1,
        created_at=_now(),
        updated_at=_now(),
        expires_at=_now(),
        is_simulated=True,
    )
    await store.save_request(req)

    # Seed 10 ringing calls
    for i in range(1, 11):
        call = Call(
            id=f"c-emu-{i}",
            request_id=req_id,
            donor_alias=f"Donor {i}",
            blood_group=BloodGroup.O_POS,
            lang=Lang.TA,
            state=CallState.RINGING,
            round=1,
            distance_km=3.0,
            updated_at=_now(),
        )
        await store.save_call(req_id, call)

    # Concurrently execute 10 press 1 transactions
    async def _execute_press_1(call_id: str) -> None:
        async def _tx(tx):
            r = await tx.get_request(req_id)
            c = await tx.get_call(req_id, call_id)
            # Read all calls if potentially pausing/fulfilling
            res = apply_press_1(r, c)
            await tx.save_request(res.request)
            await tx.save_call(req_id, res.call)
            for evt in res.timeline_events:
                await tx.append_event(req_id, evt)

        await store.run_transaction(_tx)

    tasks = [_execute_press_1(f"c-emu-{i}") for i in range(1, 11)]
    await asyncio.gather(*tasks)

    # Verify pause rule holds
    final_req = await store.get_request(req_id)
    assert final_req is not None
    assert final_req.status == RequestStatus.PAUSED
    assert final_req.on_the_way == 3

    calls = await store.list_calls(req_id)
    on_the_way_calls = [c for c in calls if c.state == CallState.ON_THE_WAY]
    late_accept_calls = [c for c in calls if c.state == CallState.LATE_ACCEPT]

    assert len(on_the_way_calls) == 3
    assert len(late_accept_calls) == 7
