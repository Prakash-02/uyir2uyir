from enum import StrEnum
from typing import Literal

from pydantic import Field

from app.core.models import CamelModel
from app.requests.models import BloodGroup, Component


class QuotedField[T](CamelModel):
    value: T | None = None
    quote: str | None = None
    kept: bool = False


class DeskAnswer(StrEnum):
    VERIFIED_MATCH = "VERIFIED_MATCH"
    SENT_TO_HOSPITAL = "SENT_TO_HOSPITAL"
    NOT_VERIFIED = "NOT_VERIFIED"


class ConfirmAction(StrEnum):
    RAISE = "RAISE"
    NOT_OUR_PATIENT = "NOT_OUR_PATIENT"


class DeskTrace(CamelModel):
    input_type: Literal["text", "image"] = "text"
    transcript: str | None = None
    hospital: QuotedField[str] = Field(default_factory=QuotedField)
    patient_number: QuotedField[str] = Field(default_factory=QuotedField)
    blood_group: QuotedField[BloodGroup] = Field(default_factory=QuotedField)
    component: QuotedField[Component] = Field(default_factory=QuotedField)
    units: QuotedField[int] = Field(default_factory=QuotedField)
    payment_phrases: list[str] = Field(default_factory=list)
    gemini_choice: str = ""
    code_decision: str = ""


class DeskResult(CamelModel):
    answer: DeskAnswer
    message: str
    request_id: str | None = None
    hospital_name: str | None = None
    trace: DeskTrace
    footer: str = "Nobody may charge you for a donor."
    demo_confirm_token: str | None = None


class DeskCheckRequest(CamelModel):
    text: str = Field(..., max_length=2000)


class RequestPreview(CamelModel):
    hospital_name: str
    blood_group: BloodGroup
    component: Component
    units_needed: int
    patient_ref_masked: str
    expires_at: str


class ConfirmRequest(CamelModel):
    token: str
    action: ConfirmAction
