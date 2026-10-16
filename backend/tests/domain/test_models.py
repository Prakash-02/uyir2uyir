from app.requests.models import (
    BloodGroup,
    BloodRequest,
    Call,
    CallState,
    Component,
    Lang,
    RequestStatus,
    TimelineEvent,
)

# Contract fixture copied directly from docs/API_CONTRACT.md section 1
CONTRACT_BLOOD_REQUEST_FIELDS = {
    "id",
    "hospitalId",
    "hospitalName",
    "centreId",
    "centreName",
    "bloodGroup",
    "component",
    "unitsNeeded",
    "status",
    "accepted",
    "onTheWay",
    "round",
    "createdAt",
    "updatedAt",
    "expiresAt",
    "isSimulated",
    "patientRef",
}

CONTRACT_CALL_FIELDS = {
    "id",
    "requestId",
    "donorAlias",
    "bloodGroup",
    "lang",
    "state",
    "round",
    "etaMinutes",
    "quote",
    "distanceKm",
    "updatedAt",
}

CONTRACT_TIMELINE_EVENT_FIELDS = {
    "id",
    "requestId",
    "at",
    "kind",
    "text",
}

CONTRACT_BLOOD_GROUPS = {"A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"}
CONTRACT_COMPONENTS = {
    "WHOLE_BLOOD",
    "RED_CELLS",
    "PLATELETS_SDP",
    "PLATELETS_RDP",
    "PLASMA",
    "UNSPECIFIED",
}
CONTRACT_REQUEST_STATUSES = {
    "AWAITING_HOSPITAL",
    "OPEN",
    "PAUSED",
    "FULFILLED",
    "EXPIRED",
    "CANCELLED",
    "REJECTED",
}
CONTRACT_CALL_STATES = {
    "QUEUED",
    "DIALING",
    "RINGING",
    "ON_THE_WAY",
    "ACCEPTED",
    "DEFERRED",
    "DECLINED",
    "NO_ANSWER",
    "UNKNOWN",
    "OPTED_OUT",
    "LATE_ACCEPT",
    "CANCELLED",
}
CONTRACT_LANGS = {"en", "ta"}


def test_enums_match_contract_values() -> None:
    """Enums strictly mirror the API contract value sets."""
    assert {e.value for e in BloodGroup} == CONTRACT_BLOOD_GROUPS
    assert {e.value for e in Component} == CONTRACT_COMPONENTS
    assert {e.value for e in RequestStatus} == CONTRACT_REQUEST_STATUSES
    assert {e.value for e in CallState} == CONTRACT_CALL_STATES
    assert {e.value for e in Lang} == CONTRACT_LANGS


def test_blood_request_json_fields_match_contract_fixture() -> None:
    """BloodRequest serialized JSON field names strictly match API_CONTRACT.md."""
    sample = BloodRequest(
        id="req-1",
        hospital_id="hosp-1",
        hospital_name="GH Chennai",
        centre_id="centre-1",
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
        patient_ref="IP-101",
    )
    dumped = sample.model_dump(by_alias=True)
    assert set(dumped.keys()) == CONTRACT_BLOOD_REQUEST_FIELDS


def test_call_json_fields_match_contract_fixture() -> None:
    """Call serialized JSON field names strictly match API_CONTRACT.md."""
    sample = Call(
        id="call-1",
        request_id="req-1",
        donor_alias="Donor A1",
        blood_group=BloodGroup.O_POS,
        lang=Lang.TA,
        state=CallState.RINGING,
        round=1,
        eta_minutes=25,
        distance_km=4.5,
        updated_at="2026-10-15T00:00:00Z",
    )
    dumped = sample.model_dump(by_alias=True)
    assert set(dumped.keys()) == CONTRACT_CALL_FIELDS


def test_timeline_event_json_fields_match_contract_fixture() -> None:
    """TimelineEvent serialized JSON field names strictly match API_CONTRACT.md."""
    sample = TimelineEvent(
        id="evt-1",
        request_id="req-1",
        at="2026-10-15T00:00:00Z",
        kind="ROUND_STARTED",
        text="Dispatched round 1",
    )
    dumped = sample.model_dump(by_alias=True)
    assert set(dumped.keys()) == CONTRACT_TIMELINE_EVENT_FIELDS
