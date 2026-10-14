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
    Intent,
    apply_press_1,
    apply_reminder_press_2,
    apply_staff_accept,
    apply_staff_defer,
)


def _make_call(
    call_id: str,
    alias: str,
    request_id: str = "req-story-1",
    round_num: int = 1,
    state: CallState = CallState.RINGING,
) -> Call:
    return Call(
        id=call_id,
        request_id=request_id,
        donor_alias=alias,
        blood_group=BloodGroup.O_POS,
        lang=Lang.TA,
        state=state,
        round=round_num,
        eta_minutes=20,
        distance_km=3.2,
        updated_at="2026-10-15T00:00:00Z",
    )


def test_u2u_brief_section_7_demo_story_replay() -> None:
    """Replays the exact demo story from U2U_BRIEF.md Section 7.

    N = 2 units of O+ red cells.
    Thresholds: pause at covered 3, reopen below 2, fulfil at accepted 2.
    Path: OPEN -> PAUSED -> (stays PAUSED) -> OPEN -> FULFILLED.
    Donors D and E must end as LATE_ACCEPT.
    Final state: FULFILLED with accepted = 2.
    """
    observed_statuses: list[RequestStatus] = []

    # Step 1: Hospital raises request for N = 2 units O+ RED_CELLS.
    # Round 1 calls 5 donors (A to E). Status is OPEN.
    req = BloodRequest(
        id="req-story-1",
        hospital_id="hosp-apollo",
        hospital_name="Apollo Greams",
        centre_id="centre-central",
        centre_name="Chennai Central",
        blood_group=BloodGroup.O_POS,
        component=Component.RED_CELLS,
        units_needed=2,
        status=RequestStatus.OPEN,
        accepted=0,
        on_the_way=0,
        round=1,
        created_at="2026-10-15T00:00:00Z",
        updated_at="2026-10-15T00:00:00Z",
        expires_at="2026-10-16T00:00:00Z",
        is_simulated=True,
        patient_ref="IP-8841",
    )
    observed_statuses.append(req.status)
    assert req.status == RequestStatus.OPEN
    assert req.accepted == 0
    assert req.on_the_way == 0

    call_a = _make_call("c-a", "Donor A")
    call_b = _make_call("c-b", "Donor B")
    call_c = _make_call("c-c", "Donor C")
    call_d = _make_call("c-d", "Donor D")
    call_e = _make_call("c-e", "Donor E")

    # Step 2: A, B and C press 1.
    # A presses 1
    res_a = apply_press_1(req, call_a)
    req, call_a = res_a.request, res_a.call
    assert call_a.state == CallState.ON_THE_WAY
    assert req.on_the_way == 1
    assert req.status == RequestStatus.OPEN

    # B presses 1
    res_b = apply_press_1(req, call_b)
    req, call_b = res_b.request, res_b.call
    assert call_b.state == CallState.ON_THE_WAY
    assert req.on_the_way == 2
    assert req.status == RequestStatus.OPEN

    # C presses 1 -> covered = 3 (N+1 reached) -> PAUSED
    res_c = apply_press_1(req, call_c)
    req, call_c = res_c.request, res_c.call
    assert call_c.state == CallState.ON_THE_WAY
    assert req.on_the_way == 3
    assert req.status == RequestStatus.PAUSED
    observed_statuses.append(req.status)

    # D presses 1 too late (while PAUSED) -> becomes LATE_ACCEPT
    res_d = apply_press_1(req, call_d)
    req, call_d = res_d.request, res_d.call
    assert call_d.state == CallState.LATE_ACCEPT
    assert Intent.PLAY_ENOUGH_MESSAGE in res_d.side_effects
    assert req.status == RequestStatus.PAUSED
    assert req.on_the_way == 3  # unchanged

    # E presses 1 too late (while PAUSED) -> becomes LATE_ACCEPT
    res_e = apply_press_1(req, call_e)
    req, call_e = res_e.request, res_e.call
    assert call_e.state == CallState.LATE_ACCEPT
    assert Intent.PLAY_ENOUGH_MESSAGE in res_e.side_effects
    assert req.status == RequestStatus.PAUSED
    assert req.on_the_way == 3  # unchanged

    # Step 3: Staff accept A and defer B.
    # Staff clinically accept A
    res_staff_a = apply_staff_accept(req, call_a)
    req, call_a = res_staff_a.request, res_staff_a.call
    assert call_a.state == CallState.ACCEPTED
    assert req.accepted == 1
    assert req.on_the_way == 2
    assert req.status == RequestStatus.PAUSED  # covered = 1+2 = 3 >= 3

    # Staff clinically defer B
    res_staff_b = apply_staff_defer(req, call_b, return_date="2026-11-15")
    req, call_b = res_staff_b.request, res_staff_b.call
    assert call_b.state == CallState.DEFERRED
    assert req.accepted == 1
    assert req.on_the_way == 1  # only donor C remains en route
    # covered = 1+1 = 2 (in gap zone 2 <= cov < 3) -> stays PAUSED
    assert req.status == RequestStatus.PAUSED

    # Step 4: C, while on the way, presses 2 on a reminder call and cancels.
    # covered becomes 1 (below N = 2) -> REOPENS
    res_rem_c = apply_reminder_press_2(req, call_c)
    req, call_c = res_rem_c.request, res_rem_c.call
    assert call_c.state == CallState.CANCELLED
    assert req.accepted == 1
    assert req.on_the_way == 0
    assert req.status == RequestStatus.OPEN
    assert Intent.START_ROUND in res_rem_c.side_effects
    observed_statuses.append(req.status)

    # Step 5: Round 2 dispatched (call F, G, H, I, J).
    # Donor F presses 1
    call_f = _make_call("c-f", "Donor F", round_num=2)
    call_g = _make_call("c-g", "Donor G", round_num=2)
    call_h = _make_call("c-h", "Donor H", round_num=2)

    res_f = apply_press_1(req, call_f)
    req, call_f = res_f.request, res_f.call
    assert call_f.state == CallState.ON_THE_WAY
    assert req.accepted == 1
    assert req.on_the_way == 1
    assert req.status == RequestStatus.OPEN

    # Staff clinically accept F -> accepted = 2 (>= N) -> FULFILLED!
    # Remaining round 2 ringing calls (G, H) become CANCELLED
    other_calls = [call_g, call_h]
    res_staff_f = apply_staff_accept(req, call_f, other_calls=other_calls)
    req, call_f = res_staff_f.request, res_staff_f.call
    assert call_f.state == CallState.ACCEPTED
    assert req.accepted == 2
    assert req.on_the_way == 0
    assert req.status == RequestStatus.FULFILLED
    observed_statuses.append(req.status)

    # Check side effects and cancelled calls
    assert Intent.THANK_AND_STAND_DOWN in res_staff_f.side_effects
    cancelled_others = {c.id: c.state for c in res_staff_f.other_calls}
    assert cancelled_others["c-g"] == CallState.CANCELLED
    assert cancelled_others["c-h"] == CallState.CANCELLED

    # Summary verification required by prompt:
    # 1. Passed through PAUSED, then OPEN, and ended FULFILLED
    assert RequestStatus.PAUSED in observed_statuses
    assert RequestStatus.OPEN in observed_statuses
    assert observed_statuses[-1] == RequestStatus.FULFILLED

    # 2. Final accepted count is 2
    assert req.accepted == 2

    # 3. Donors D and E are LATE_ACCEPT
    assert call_d.state == CallState.LATE_ACCEPT
    assert call_e.state == CallState.LATE_ACCEPT
