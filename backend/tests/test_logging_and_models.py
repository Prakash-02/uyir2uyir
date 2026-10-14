import logging

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.testclient import TestClient
from pydantic import Field

from app.core.logging import (
    StructuredJsonFormatter,
    redact_phone_numbers,
    validation_exception_handler,
)
from app.core.models import CamelModel


class SampleSchema(CamelModel):
    user_name: str
    phone_number: str
    units_needed: int = Field(ge=1, le=6)


def test_camel_model_serialization_and_aliases() -> None:
    """CamelModel converts snake_case to camelCase in dict and JSON exports."""
    sample = SampleSchema(
        user_name="Prakash",
        phone_number="+919876543210",
        units_needed=2,
    )
    dumped = sample.model_dump(by_alias=True)
    assert "userName" in dumped
    assert "phoneNumber" in dumped
    assert "unitsNeeded" in dumped
    assert "user_name" not in dumped

    # Populating by alias also works
    parsed = SampleSchema.model_validate(
        {
            "userName": "Ramesh",
            "phoneNumber": "+919876543211",
            "unitsNeeded": 3,
        }
    )
    assert parsed.user_name == "Ramesh"
    assert parsed.units_needed == 3


def test_redact_phone_numbers() -> None:
    """redact_phone_numbers masks +91 numbers and 10-digit Indian numbers."""
    text = "Call donor at +919876543210 or 9840123456 regarding request."
    redacted = redact_phone_numbers(text)
    assert "+919876543210" not in redacted
    assert "9840123456" not in redacted
    assert "[REDACTED_PHONE]" in redacted


def test_structured_json_formatter_masks_pii() -> None:
    """StructuredJsonFormatter produces valid JSON and redacts phone numbers."""
    formatter = StructuredJsonFormatter()
    record = logging.LogRecord(
        name="test_logger",
        level=logging.INFO,
        pathname="test.py",
        lineno=10,
        msg="Donor registered with phone +919840123456 successfully",
        args=(),
        exc_info=None,
    )
    formatted = formatter.format(record)
    assert "+919840123456" not in formatted
    assert "[REDACTED_PHONE]" in formatted


def test_422_handler_strips_request_body() -> None:
    """Custom 422 handler returns validation errors without echoing raw input values."""
    test_app = FastAPI()
    test_app.add_exception_handler(RequestValidationError, validation_exception_handler)

    @test_app.post("/test-validation")
    async def sample_endpoint(payload: SampleSchema):
        return payload

    client = TestClient(test_app)

    # Send invalid payload with invalid units and phone number
    response = client.post(
        "/test-validation",
        json={"userName": "Prakash", "phoneNumber": "9876543210", "unitsNeeded": 10},
    )
    assert response.status_code == 422
    body = response.json()
    assert "detail" in body
    for err in body["detail"]:
        # Verify 'input' field is completely absent
        assert "input" not in err
        assert "loc" in err
        assert "msg" in err
