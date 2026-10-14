from enum import StrEnum

from pydantic import Field

from app.core.models import CamelModel


class BloodGroup(StrEnum):
    A_POS = "A+"
    A_NEG = "A-"
    B_POS = "B+"
    B_NEG = "B-"
    AB_POS = "AB+"
    AB_NEG = "AB-"
    O_POS = "O+"
    O_NEG = "O-"


class Component(StrEnum):
    WHOLE_BLOOD = "WHOLE_BLOOD"
    RED_CELLS = "RED_CELLS"
    PLATELETS_SDP = "PLATELETS_SDP"
    PLATELETS_RDP = "PLATELETS_RDP"
    PLASMA = "PLASMA"
    UNSPECIFIED = "UNSPECIFIED"


class RequestStatus(StrEnum):
    AWAITING_HOSPITAL = "AWAITING_HOSPITAL"
    OPEN = "OPEN"
    PAUSED = "PAUSED"
    FULFILLED = "FULFILLED"
    EXPIRED = "EXPIRED"
    CANCELLED = "CANCELLED"
    REJECTED = "REJECTED"


class CallState(StrEnum):
    QUEUED = "QUEUED"
    DIALING = "DIALING"
    RINGING = "RINGING"
    ON_THE_WAY = "ON_THE_WAY"
    ACCEPTED = "ACCEPTED"
    DEFERRED = "DEFERRED"
    DECLINED = "DECLINED"
    NO_ANSWER = "NO_ANSWER"
    UNKNOWN = "UNKNOWN"
    OPTED_OUT = "OPTED_OUT"
    LATE_ACCEPT = "LATE_ACCEPT"
    CANCELLED = "CANCELLED"


class Lang(StrEnum):
    EN = "en"
    TA = "ta"


class BloodRequest(CamelModel):
    id: str
    hospital_id: str
    hospital_name: str
    centre_id: str
    centre_name: str
    blood_group: BloodGroup
    component: Component
    units_needed: int = Field(ge=1, le=6)
    status: RequestStatus
    accepted: int = 0
    on_the_way: int = 0
    round: int = 1
    created_at: str
    updated_at: str
    expires_at: str
    is_simulated: bool = True
    patient_ref: str | None = None


class Call(CamelModel):
    id: str
    request_id: str
    donor_alias: str
    blood_group: BloodGroup
    lang: Lang
    state: CallState
    round: int
    eta_minutes: int | None = None
    distance_km: float
    updated_at: str


class TimelineEvent(CamelModel):
    id: str
    request_id: str
    at: str
    kind: str
    text: str
