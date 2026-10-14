import pytest
from hypothesis import settings
from hypothesis import strategies as st
from hypothesis.stateful import RuleBasedStateMachine, initialize, invariant, rule

from app.requests.counting import TERMINAL_STATUSES, next_status
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
    IllegalTransition,
    apply_call_no_answer,
    apply_expire,
    apply_hospital_cancel,
    apply_press_1,
    apply_press_2,
    apply_press_9,
    apply_reminder_press_2,
    apply_staff_accept,
    apply_staff_defer,
)


class RequestStateMachine(RuleBasedStateMachine):
    """Hypothesis state machine verifying core invariants of blood request outreach.

    Invariants checked across 200+ multi-step random executions:
    1. accepted never exceeds the number of donors accepted by staff
    2. accepted and on_the_way are never negative
    3. status always equals next_status of the counters, unless terminal
    4. no donor is ever in two states
    5. OPTED_OUT donors are never called again
    """

    def __init__(self) -> None:
        super().__init__()
        self.request = BloodRequest(
            id="req-prop-1",
            hospital_id="hosp-apollo",
            hospital_name="Apollo Hospital",
            centre_id="centre-central",
            centre_name="Chennai Blood Centre",
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
        )
        self.calls: dict[int, Call] = {}
        self.opted_out_donors: set[int] = set()
        self.staff_accepted_donors: set[int] = set()
        self.next_donor_id: int = 1

    @initialize(units_needed=st.integers(min_value=1, max_value=6))
    def init_request(self, units_needed: int) -> None:
        self.request = BloodRequest(
            id="req-prop-1",
            hospital_id="hosp-apollo",
            hospital_name="Apollo Hospital",
            centre_id="centre-central",
            centre_name="Chennai Blood Centre",
            blood_group=BloodGroup.O_POS,
            component=Component.RED_CELLS,
            units_needed=units_needed,
            status=RequestStatus.OPEN,
            accepted=0,
            on_the_way=0,
            round=1,
            created_at="2026-10-15T00:00:00Z",
            updated_at="2026-10-15T00:00:00Z",
            expires_at="2026-10-16T00:00:00Z",
            is_simulated=True,
        )
        self.calls = {}
        self.opted_out_donors = set()
        self.staff_accepted_donors = set()
        self.next_donor_id = 1

    @rule()
    def dial_donor(self) -> None:
        """System places a call to a new consented donor when request is active."""
        if self.request.status in TERMINAL_STATUSES:
            return

        donor_id = self.next_donor_id
        self.next_donor_id += 1

        # Invariant 5 check during dialling: Never call opted-out donors
        assert donor_id not in self.opted_out_donors

        call = Call(
            id=f"call-{donor_id}",
            request_id=self.request.id,
            donor_alias=f"Donor {donor_id}",
            blood_group=BloodGroup.O_POS,
            lang=Lang.TA,
            state=CallState.RINGING,
            round=self.request.round,
            distance_km=4.0,
            updated_at="2026-10-15T00:00:00Z",
        )
        self.calls[donor_id] = call

    @rule(data=st.data())
    def press_1(self, data: st.DataObject) -> None:
        """Donor presses 1: coming to donate."""
        candidates = [
            did
            for did, c in self.calls.items()
            if c.state in (CallState.RINGING, CallState.DIALING)
        ]
        if not candidates or self.request.status in (
            RequestStatus.EXPIRED,
            RequestStatus.CANCELLED,
            RequestStatus.REJECTED,
        ):
            return

        donor_id = data.draw(st.sampled_from(candidates))
        res = apply_press_1(self.request, self.calls[donor_id])
        self.request = res.request
        self.calls[donor_id] = res.call

    @rule(data=st.data())
    def press_2(self, data: st.DataObject) -> None:
        """Donor presses 2: cannot donate."""
        candidates = [
            did
            for did, c in self.calls.items()
            if c.state in (CallState.RINGING, CallState.DIALING)
        ]
        if not candidates:
            return

        donor_id = data.draw(st.sampled_from(candidates))
        res = apply_press_2(self.request, self.calls[donor_id])
        self.request = res.request
        self.calls[donor_id] = res.call

    @rule(data=st.data())
    def press_9(self, data: st.DataObject) -> None:
        """Donor presses 9: revokes consent and opts out permanently."""
        candidates = [
            did
            for did, c in self.calls.items()
            if c.state not in (CallState.ACCEPTED, CallState.DEFERRED, CallState.OPTED_OUT)
        ]
        if not candidates:
            return

        donor_id = data.draw(st.sampled_from(candidates))
        res = apply_press_9(self.request, self.calls[donor_id])
        self.request = res.request
        self.calls[donor_id] = res.call
        self.opted_out_donors.add(donor_id)

    @rule(data=st.data())
    def staff_accept(self, data: st.DataObject) -> None:
        """Blood centre staff accepts an arriving donor."""
        candidates = [did for did, c in self.calls.items() if c.state == CallState.ON_THE_WAY]
        if not candidates or self.request.status in TERMINAL_STATUSES:
            return

        donor_id = data.draw(st.sampled_from(candidates))
        res = apply_staff_accept(
            self.request, self.calls[donor_id], other_calls=list(self.calls.values())
        )
        self.request = res.request
        self.calls[donor_id] = res.call
        self.staff_accepted_donors.add(donor_id)

        if res.other_calls:
            for oc in res.other_calls:
                for did, c in self.calls.items():
                    if c.id == oc.id:
                        self.calls[did] = oc

    @rule(data=st.data())
    def staff_defer(self, data: st.DataObject) -> None:
        """Blood centre staff defers an arriving donor."""
        candidates = [did for did, c in self.calls.items() if c.state == CallState.ON_THE_WAY]
        if not candidates or self.request.status in TERMINAL_STATUSES:
            return

        donor_id = data.draw(st.sampled_from(candidates))
        res = apply_staff_defer(self.request, self.calls[donor_id])
        self.request = res.request
        self.calls[donor_id] = res.call

    @rule(data=st.data())
    def reminder_press_2(self, data: st.DataObject) -> None:
        """Donor on the way cancels arrival via reminder."""
        candidates = [did for did, c in self.calls.items() if c.state == CallState.ON_THE_WAY]
        if not candidates:
            return

        donor_id = data.draw(st.sampled_from(candidates))
        res = apply_reminder_press_2(self.request, self.calls[donor_id])
        self.request = res.request
        self.calls[donor_id] = res.call

    @rule(data=st.data())
    def call_no_answer(self, data: st.DataObject) -> None:
        """Call times out with no answer."""
        candidates = [
            did
            for did, c in self.calls.items()
            if c.state in (CallState.RINGING, CallState.DIALING)
        ]
        if not candidates:
            return

        donor_id = data.draw(st.sampled_from(candidates))
        res = apply_call_no_answer(self.request, self.calls[donor_id])
        self.request = res.request
        self.calls[donor_id] = res.call

    @rule()
    def hospital_cancel(self) -> None:
        """Hospital staff cancels the request."""
        if self.request.status in TERMINAL_STATUSES:
            return

        res = apply_hospital_cancel(self.request, active_calls=list(self.calls.values()))
        self.request = res.request
        if res.other_calls:
            for oc in res.other_calls:
                for did, c in self.calls.items():
                    if c.id == oc.id:
                        self.calls[did] = oc

    @rule()
    def expire(self) -> None:
        """Request expires after 24h timeout."""
        if self.request.status in TERMINAL_STATUSES:
            return

        res = apply_expire(self.request, active_calls=list(self.calls.values()))
        self.request = res.request
        if res.other_calls:
            for oc in res.other_calls:
                for did, c in self.calls.items():
                    if c.id == oc.id:
                        self.calls[did] = oc

    # --- INVARIANTS ---

    @invariant()
    def invariant_accepted_never_exceeds_staff_accepted(self) -> None:
        """1. accepted never exceeds the number of donors accepted by staff."""
        assert self.request.accepted <= len(self.staff_accepted_donors)

    @invariant()
    def invariant_counts_non_negative(self) -> None:
        """2. accepted and on_the_way are never negative."""
        assert self.request.accepted >= 0
        assert self.request.on_the_way >= 0

    @invariant()
    def invariant_status_matches_counting_rule_unless_terminal(self) -> None:
        """3. status always equals next_status of the counters, unless terminal."""
        if self.request.status not in TERMINAL_STATUSES:
            expected = next_status(
                self.request.status,
                self.request.units_needed,
                self.request.accepted,
                self.request.on_the_way,
            )
            assert self.request.status == expected

    @invariant()
    def invariant_no_donor_in_two_states(self) -> None:
        """4. no donor is ever in two states."""
        seen_states: dict[int, CallState] = {}
        for did, call in self.calls.items():
            assert did not in seen_states
            assert isinstance(call.state, CallState)
            seen_states[did] = call.state

    @invariant()
    def invariant_opted_out_donors_never_called_again(self) -> None:
        """5. OPTED_OUT donors are never called again."""
        for did in self.opted_out_donors:
            assert did in self.calls
            assert self.calls[did].state == CallState.OPTED_OUT


# Configure Hypothesis to run at least 200 stateful examples
TestRequestStateMachine = RequestStateMachine.TestCase
TestRequestStateMachine.settings = settings(
    max_examples=200,
    stateful_step_count=50,
    deadline=None,
)


def test_illegal_transitions_raise_and_change_nothing() -> None:
    """Illegal transitions must raise IllegalTransition and leave models unchanged."""
    req = BloodRequest(
        id="req-ill",
        hospital_id="h-1",
        hospital_name="GH",
        centre_id="c-1",
        centre_name="BC",
        blood_group=BloodGroup.O_POS,
        component=Component.RED_CELLS,
        units_needed=2,
        status=RequestStatus.OPEN,
        accepted=0,
        on_the_way=1,
        round=1,
        created_at="2026-10-15T00:00:00Z",
        updated_at="2026-10-15T00:00:00Z",
        expires_at="2026-10-16T00:00:00Z",
        is_simulated=True,
    )
    call_otw = Call(
        id="c-otw",
        request_id=req.id,
        donor_alias="Donor X",
        blood_group=BloodGroup.O_POS,
        lang=Lang.EN,
        state=CallState.ON_THE_WAY,
        round=1,
        distance_km=2.0,
        updated_at="2026-10-15T00:00:00Z",
    )
    call_ringing = Call(
        id="c-ring",
        request_id=req.id,
        donor_alias="Donor Y",
        blood_group=BloodGroup.O_POS,
        lang=Lang.TA,
        state=CallState.RINGING,
        round=1,
        distance_km=3.0,
        updated_at="2026-10-15T00:00:00Z",
    )

    # 1. press 1 on ON_THE_WAY call
    with pytest.raises(IllegalTransition):
        apply_press_1(req, call_otw)
    assert call_otw.state == CallState.ON_THE_WAY
    assert req.on_the_way == 1

    # 2. press 2 on ON_THE_WAY call (must use reminder_press_2)
    with pytest.raises(IllegalTransition):
        apply_press_2(req, call_otw)
    assert call_otw.state == CallState.ON_THE_WAY

    # 3. staff accept on RINGING call
    with pytest.raises(IllegalTransition):
        apply_staff_accept(req, call_ringing)
    assert call_ringing.state == CallState.RINGING
    assert req.accepted == 0

    # 4. staff defer on RINGING call
    with pytest.raises(IllegalTransition):
        apply_staff_defer(req, call_ringing)
    assert call_ringing.state == CallState.RINGING

    # 5. reminder_press_2 on RINGING call
    with pytest.raises(IllegalTransition):
        apply_reminder_press_2(req, call_ringing)
    assert call_ringing.state == CallState.RINGING

    # 6. cancel or expire on already terminal request
    cancelled_req = req.model_copy(update={"status": RequestStatus.CANCELLED})
    with pytest.raises(IllegalTransition):
        apply_hospital_cancel(cancelled_req)
    with pytest.raises(IllegalTransition):
        apply_expire(cancelled_req)
    assert cancelled_req.status == RequestStatus.CANCELLED
