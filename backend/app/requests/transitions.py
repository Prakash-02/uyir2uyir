"""Pure transition functions for request and call lifecycles.

Enforces:
- Press 1 while PAUSED or FULFILLED becomes LATE_ACCEPT.
- Press 9 becomes OPTED_OUT and emits a WITHDRAW_CONSENT intent.
- Fulfil makes remaining RINGING calls CANCELLED and emits a thank-you for every ON_THE_WAY donor.
- Illegal transitions raise IllegalTransition and change nothing.
"""

from dataclasses import dataclass, field
from enum import StrEnum
from uuid import uuid4

from app.requests.counting import next_status
from app.requests.models import BloodRequest, Call, CallState, RequestStatus, TimelineEvent


class Intent(StrEnum):
    """Side effect intents emitted by state transitions to be fulfilled by outer services."""

    PLACE_CALL = "PLACE_CALL"
    PLAY_ENOUGH_MESSAGE = "PLAY_ENOUGH_MESSAGE"
    START_ROUND = "START_ROUND"
    THANK_AND_STAND_DOWN = "THANK_AND_STAND_DOWN"
    WITHDRAW_CONSENT = "WITHDRAW_CONSENT"


class IllegalTransition(Exception):
    """Raised when an event is invalid for current request or call state."""

    pass


@dataclass(frozen=True)
class TransitionResult:
    """Immutable result of applying a transition event."""

    request: BloodRequest
    call: Call | None
    timeline_events: list[TimelineEvent] = field(default_factory=list)
    side_effects: list[Intent] = field(default_factory=list)
    other_calls: list[Call] = field(default_factory=list)


def _gen_event_id() -> str:
    return f"evt-{uuid4().hex[:8]}"


def apply_press_1(
    request: BloodRequest, call: Call, timestamp: str = "2026-10-15T00:00:00Z"
) -> TransitionResult:
    """Donor presses 1 ('Coming to donate').

    - If request is OPEN: call becomes ON_THE_WAY; counters updated; request may PAUSE.
    - If request is PAUSED or FULFILLED: call becomes LATE_ACCEPT; counters unchanged.
    """
    if call.state not in (CallState.RINGING, CallState.DIALING):
        raise IllegalTransition(
            f"Cannot press 1 on call {call.id} in state '{call.state}'. Expected RINGING or DIALING."
        )

    if request.status in (RequestStatus.EXPIRED, RequestStatus.CANCELLED, RequestStatus.REJECTED):
        raise IllegalTransition(
            f"Cannot process press 1 on request {request.id} in terminal status '{request.status}'."
        )

    # Press 1 while PAUSED or FULFILLED becomes LATE_ACCEPT
    if request.status in (RequestStatus.PAUSED, RequestStatus.FULFILLED):
        new_call = call.model_copy(update={"state": CallState.LATE_ACCEPT, "updated_at": timestamp})
        event = TimelineEvent(
            id=_gen_event_id(),
            request_id=request.id,
            at=timestamp,
            kind="LATE_ACCEPT",
            text=f"{call.donor_alias} pressed 1 too late; thanked (request {request.status.lower()}).",
        )
        return TransitionResult(
            request=request,
            call=new_call,
            timeline_events=[event],
            side_effects=[Intent.PLAY_ENOUGH_MESSAGE],
        )

    if request.status == RequestStatus.AWAITING_HOSPITAL:
        raise IllegalTransition("Cannot press 1 while request is awaiting hospital confirmation.")

    # Request is OPEN
    new_call = call.model_copy(update={"state": CallState.ON_THE_WAY, "updated_at": timestamp})
    new_on_the_way = request.on_the_way + 1
    new_status = next_status(request.status, request.units_needed, request.accepted, new_on_the_way)

    new_request = request.model_copy(
        update={
            "on_the_way": new_on_the_way,
            "status": new_status,
            "updated_at": timestamp,
        }
    )

    events = [
        TimelineEvent(
            id=_gen_event_id(),
            request_id=request.id,
            at=timestamp,
            kind="DONOR_ON_THE_WAY",
            text=f"{call.donor_alias} pressed 1 and is on the way.",
        )
    ]

    if new_status == RequestStatus.PAUSED:
        events.append(
            TimelineEvent(
                id=_gen_event_id(),
                request_id=request.id,
                at=timestamp,
                kind="REQUEST_PAUSED",
                text=f"Request paused: {new_on_the_way + request.accepted} covered (N+1 reached).",
            )
        )

    return TransitionResult(
        request=new_request,
        call=new_call,
        timeline_events=events,
        side_effects=[],
    )


def apply_press_2(
    request: BloodRequest, call: Call, timestamp: str = "2026-10-15T00:00:00Z"
) -> TransitionResult:
    """Donor presses 2 ('Cannot donate / unsafe roads')."""
    if call.state not in (CallState.RINGING, CallState.DIALING):
        raise IllegalTransition(
            f"Cannot press 2 on call {call.id} in state '{call.state}'. Expected RINGING or DIALING."
        )

    new_call = call.model_copy(update={"state": CallState.DECLINED, "updated_at": timestamp})
    event = TimelineEvent(
        id=_gen_event_id(),
        request_id=request.id,
        at=timestamp,
        kind="DONOR_DECLINED",
        text=f"{call.donor_alias} pressed 2 (declined).",
    )
    return TransitionResult(
        request=request,
        call=new_call,
        timeline_events=[event],
        side_effects=[],
    )


def apply_press_9(
    request: BloodRequest, call: Call, timestamp: str = "2026-10-15T00:00:00Z"
) -> TransitionResult:
    """Donor presses 9 ('Revoke consent / stop calling me').

    Transitions call to OPTED_OUT and emits WITHDRAW_CONSENT intent.
    """
    if call.state in (CallState.ACCEPTED, CallState.DEFERRED, CallState.OPTED_OUT):
        raise IllegalTransition(
            f"Cannot press 9 on call {call.id} already in terminal state '{call.state}'."
        )

    new_call = call.model_copy(update={"state": CallState.OPTED_OUT, "updated_at": timestamp})
    events = [
        TimelineEvent(
            id=_gen_event_id(),
            request_id=request.id,
            at=timestamp,
            kind="DONOR_OPTED_OUT",
            text=f"{call.donor_alias} pressed 9 to opt out and permanently revoked consent.",
        )
    ]
    side_effects = [Intent.WITHDRAW_CONSENT]

    # If donor was en route, decrement on_the_way and recheck status
    if call.state == CallState.ON_THE_WAY:
        new_on_the_way = max(0, request.on_the_way - 1)
        new_status = next_status(
            request.status, request.units_needed, request.accepted, new_on_the_way
        )
        new_request = request.model_copy(
            update={
                "on_the_way": new_on_the_way,
                "status": new_status,
                "updated_at": timestamp,
            }
        )
        if request.status == RequestStatus.PAUSED and new_status == RequestStatus.OPEN:
            side_effects.append(Intent.START_ROUND)
            events.append(
                TimelineEvent(
                    id=_gen_event_id(),
                    request_id=request.id,
                    at=timestamp,
                    kind="REQUEST_REOPENED",
                    text=f"Request reopened: covered dropped to {new_on_the_way + request.accepted} (below {request.units_needed}).",
                )
            )
        return TransitionResult(
            request=new_request,
            call=new_call,
            timeline_events=events,
            side_effects=side_effects,
        )

    return TransitionResult(
        request=request,
        call=new_call,
        timeline_events=events,
        side_effects=side_effects,
    )


def apply_staff_accept(
    request: BloodRequest,
    call: Call,
    other_calls: list[Call] | None = None,
    timestamp: str = "2026-10-15T00:00:00Z",
) -> TransitionResult:
    """Blood centre staff clinically screens and accepts an arriving donor.

    Transitions call to ACCEPTED; increments accepted count.
    If request reaches fulfillment (accepted >= N):
    - status becomes FULFILLED.
    - remaining RINGING/DIALING/QUEUED calls become CANCELLED.
    - emits THANK_AND_STAND_DOWN intent for anyone on the way.
    """
    if call.state != CallState.ON_THE_WAY:
        raise IllegalTransition(
            f"Cannot accept donor {call.donor_alias} in call state '{call.state}'. Donor must be ON_THE_WAY."
        )

    if request.status in (
        RequestStatus.FULFILLED,
        RequestStatus.EXPIRED,
        RequestStatus.CANCELLED,
        RequestStatus.REJECTED,
    ):
        raise IllegalTransition(
            f"Cannot accept donor on request {request.id} in status '{request.status}'."
        )

    new_call = call.model_copy(update={"state": CallState.ACCEPTED, "updated_at": timestamp})
    new_accepted = request.accepted + 1
    new_on_the_way = max(0, request.on_the_way - 1)
    new_status = next_status(request.status, request.units_needed, new_accepted, new_on_the_way)

    new_request = request.model_copy(
        update={
            "accepted": new_accepted,
            "on_the_way": new_on_the_way,
            "status": new_status,
            "updated_at": timestamp,
        }
    )

    events = [
        TimelineEvent(
            id=_gen_event_id(),
            request_id=request.id,
            at=timestamp,
            kind="DONOR_ACCEPTED",
            text=f"Staff clinically accepted {call.donor_alias} ({new_accepted} of {request.units_needed} units).",
        )
    ]
    side_effects: list[Intent] = []
    updated_other_calls: list[Call] = []

    if new_status == RequestStatus.FULFILLED:
        side_effects.append(Intent.THANK_AND_STAND_DOWN)
        events.append(
            TimelineEvent(
                id=_gen_event_id(),
                request_id=request.id,
                at=timestamp,
                kind="REQUEST_FULFILLED",
                text=f"Request fulfilled: all {request.units_needed} units accepted by blood centre staff.",
            )
        )
        if other_calls:
            for oc in other_calls:
                if oc.id == call.id:
                    continue
                if oc.state in (CallState.RINGING, CallState.DIALING, CallState.QUEUED):
                    updated_other_calls.append(
                        oc.model_copy(
                            update={"state": CallState.CANCELLED, "updated_at": timestamp}
                        )
                    )
                else:
                    updated_other_calls.append(oc)

    return TransitionResult(
        request=new_request,
        call=new_call,
        timeline_events=events,
        side_effects=side_effects,
        other_calls=updated_other_calls,
    )


def apply_staff_defer(
    request: BloodRequest,
    call: Call,
    return_date: str | None = None,
    timestamp: str = "2026-10-15T00:00:00Z",
) -> TransitionResult:
    """Blood centre staff defers an arriving donor (e.g. low haemoglobin, temporary travel)."""
    if call.state != CallState.ON_THE_WAY:
        raise IllegalTransition(
            f"Cannot defer donor {call.donor_alias} in call state '{call.state}'. Donor must be ON_THE_WAY."
        )

    if request.status in (
        RequestStatus.FULFILLED,
        RequestStatus.EXPIRED,
        RequestStatus.CANCELLED,
        RequestStatus.REJECTED,
    ):
        raise IllegalTransition(
            f"Cannot defer donor on request {request.id} in status '{request.status}'."
        )

    new_call = call.model_copy(update={"state": CallState.DEFERRED, "updated_at": timestamp})
    new_on_the_way = max(0, request.on_the_way - 1)
    new_status = next_status(request.status, request.units_needed, request.accepted, new_on_the_way)

    new_request = request.model_copy(
        update={
            "on_the_way": new_on_the_way,
            "status": new_status,
            "updated_at": timestamp,
        }
    )

    defer_text = f"Staff deferred {call.donor_alias}."
    if return_date:
        defer_text += f" Return date scheduled: {return_date}."

    events = [
        TimelineEvent(
            id=_gen_event_id(),
            request_id=request.id,
            at=timestamp,
            kind="DONOR_DEFERRED",
            text=defer_text,
        )
    ]
    side_effects: list[Intent] = []

    if request.status == RequestStatus.PAUSED and new_status == RequestStatus.OPEN:
        side_effects.append(Intent.START_ROUND)
        events.append(
            TimelineEvent(
                id=_gen_event_id(),
                request_id=request.id,
                at=timestamp,
                kind="REQUEST_REOPENED",
                text=f"Request reopened: covered dropped to {new_on_the_way + request.accepted} (below {request.units_needed}).",
            )
        )

    return TransitionResult(
        request=new_request,
        call=new_call,
        timeline_events=events,
        side_effects=side_effects,
    )


def apply_call_no_answer(
    request: BloodRequest, call: Call, timestamp: str = "2026-10-15T00:00:00Z"
) -> TransitionResult:
    """Call timed out (> 45s ringing) with no donor response."""
    if call.state not in (CallState.RINGING, CallState.DIALING):
        raise IllegalTransition(
            f"Cannot record no_answer on call {call.id} in state '{call.state}'. Expected RINGING or DIALING."
        )

    new_call = call.model_copy(update={"state": CallState.NO_ANSWER, "updated_at": timestamp})
    event = TimelineEvent(
        id=_gen_event_id(),
        request_id=request.id,
        at=timestamp,
        kind="CALL_NO_ANSWER",
        text=f"No answer from {call.donor_alias} after 45s timeout.",
    )
    return TransitionResult(
        request=request,
        call=new_call,
        timeline_events=[event],
        side_effects=[],
    )


def apply_reminder_press_2(
    request: BloodRequest, call: Call, timestamp: str = "2026-10-15T00:00:00Z"
) -> TransitionResult:
    """Donor who was ON_THE_WAY presses 2 on a reminder call or cancels travel."""
    if call.state != CallState.ON_THE_WAY:
        raise IllegalTransition(
            f"Cannot cancel arrival on call {call.id} in state '{call.state}'. Donor must be ON_THE_WAY."
        )

    new_call = call.model_copy(update={"state": CallState.CANCELLED, "updated_at": timestamp})
    new_on_the_way = max(0, request.on_the_way - 1)
    new_status = next_status(request.status, request.units_needed, request.accepted, new_on_the_way)

    new_request = request.model_copy(
        update={
            "on_the_way": new_on_the_way,
            "status": new_status,
            "updated_at": timestamp,
        }
    )

    events = [
        TimelineEvent(
            id=_gen_event_id(),
            request_id=request.id,
            at=timestamp,
            kind="DONOR_CANCELLED",
            text=f"{call.donor_alias} cancelled arrival via reminder call.",
        )
    ]
    side_effects: list[Intent] = []

    if request.status == RequestStatus.PAUSED and new_status == RequestStatus.OPEN:
        side_effects.append(Intent.START_ROUND)
        events.append(
            TimelineEvent(
                id=_gen_event_id(),
                request_id=request.id,
                at=timestamp,
                kind="REQUEST_REOPENED",
                text=f"Request reopened: covered dropped to {new_on_the_way + request.accepted} (below {request.units_needed}).",
            )
        )

    return TransitionResult(
        request=new_request,
        call=new_call,
        timeline_events=events,
        side_effects=side_effects,
    )


def apply_hospital_cancel(
    request: BloodRequest,
    active_calls: list[Call] | None = None,
    timestamp: str = "2026-10-15T00:00:00Z",
) -> TransitionResult:
    """Hospital staff manually cancels request. Automated outreach is stood down."""
    if request.status in (
        RequestStatus.FULFILLED,
        RequestStatus.EXPIRED,
        RequestStatus.CANCELLED,
        RequestStatus.REJECTED,
    ):
        raise IllegalTransition(
            f"Cannot cancel request {request.id} already in terminal status '{request.status}'."
        )

    new_request = request.model_copy(
        update={"status": RequestStatus.CANCELLED, "updated_at": timestamp}
    )
    events = [
        TimelineEvent(
            id=_gen_event_id(),
            request_id=request.id,
            at=timestamp,
            kind="REQUEST_CANCELLED",
            text="Hospital cancelled blood request. Active outreach stood down.",
        )
    ]
    updated_calls: list[Call] = []
    if active_calls:
        for c in active_calls:
            if c.state in (
                CallState.RINGING,
                CallState.DIALING,
                CallState.QUEUED,
                CallState.ON_THE_WAY,
            ):
                updated_calls.append(
                    c.model_copy(update={"state": CallState.CANCELLED, "updated_at": timestamp})
                )
            else:
                updated_calls.append(c)

    return TransitionResult(
        request=new_request,
        call=None,
        timeline_events=events,
        side_effects=[Intent.THANK_AND_STAND_DOWN],
        other_calls=updated_calls,
    )


def apply_expire(
    request: BloodRequest,
    active_calls: list[Call] | None = None,
    timestamp: str = "2026-10-15T00:00:00Z",
) -> TransitionResult:
    """Request reaches 24-hour expiration without fulfillment."""
    if request.status in (
        RequestStatus.FULFILLED,
        RequestStatus.EXPIRED,
        RequestStatus.CANCELLED,
        RequestStatus.REJECTED,
    ):
        raise IllegalTransition(
            f"Cannot expire request {request.id} already in terminal status '{request.status}'."
        )

    new_request = request.model_copy(
        update={"status": RequestStatus.EXPIRED, "updated_at": timestamp}
    )
    events = [
        TimelineEvent(
            id=_gen_event_id(),
            request_id=request.id,
            at=timestamp,
            kind="REQUEST_EXPIRED",
            text="Request expired after 24 hours.",
        )
    ]
    updated_calls: list[Call] = []
    if active_calls:
        for c in active_calls:
            if c.state in (
                CallState.RINGING,
                CallState.DIALING,
                CallState.QUEUED,
                CallState.ON_THE_WAY,
            ):
                updated_calls.append(
                    c.model_copy(update={"state": CallState.CANCELLED, "updated_at": timestamp})
                )
            else:
                updated_calls.append(c)

    return TransitionResult(
        request=new_request,
        call=None,
        timeline_events=events,
        side_effects=[],
        other_calls=updated_calls,
    )
