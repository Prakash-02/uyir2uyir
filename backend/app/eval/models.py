from pydantic import Field

from app.core.models import CamelModel


class EvalRow(CamelModel):
    id: str
    expected: str
    got: str
    pass_: bool = Field(..., alias="pass")


class EvalResult(CamelModel):
    prompt_version: str
    run_at: str
    total: int
    correct: int
    payment_to_hospital: int
    wrong_hospital_ids: int
    p95_latency_ms: float
    rows: list[EvalRow]
