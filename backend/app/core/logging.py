import json
import logging
import re
from datetime import UTC, datetime
from typing import Any

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

# Regex to detect Indian phone numbers (+91 or 10 digits starting with 6-9) and generic 10-digit numbers
PHONE_REGEX = re.compile(r"(?:\+91[\s-]?)?[6-9]\d{9}|\b\d{10}\b")

# Allowed fields in structured JSON logs
LOG_ALLOWLIST = {
    "timestamp",
    "severity",
    "message",
    "logger",
    "module",
    "path",
    "method",
    "status_code",
    "duration_ms",
    "request_id",
    "error",
}


def redact_phone_numbers(text: str) -> str:
    """Masks phone numbers to prevent accidental PII leakage into logs."""
    if not isinstance(text, str):
        return text
    return PHONE_REGEX.sub("[REDACTED_PHONE]", text)


def sanitize_log_dict(data: dict[str, Any]) -> dict[str, Any]:
    """Recursively redacts phone numbers from dictionary values."""
    sanitized: dict[str, Any] = {}
    for k, v in data.items():
        if isinstance(v, str):
            sanitized[k] = redact_phone_numbers(v)
        elif isinstance(v, dict):
            sanitized[k] = sanitize_log_dict(v)
        elif isinstance(v, list):
            sanitized[k] = [
                redact_phone_numbers(item) if isinstance(item, str) else item for item in v
            ]
        else:
            sanitized[k] = v
    return sanitized


class StructuredJsonFormatter(logging.Formatter):
    """Formats log records as structured JSON with field allowlist and phone redaction."""

    def format(self, record: logging.LogRecord) -> str:
        timestamp = datetime.now(UTC).isoformat()
        message = redact_phone_numbers(record.getMessage())

        log_entry: dict[str, Any] = {
            "timestamp": timestamp,
            "severity": record.levelname,
            "message": message,
            "logger": record.name,
            "module": record.module,
        }

        # Include custom attributes from record if in allowlist
        for field in LOG_ALLOWLIST:
            if hasattr(record, field) and field not in log_entry:
                val = getattr(record, field)
                if isinstance(val, str):
                    log_entry[field] = redact_phone_numbers(val)
                else:
                    log_entry[field] = val

        if record.exc_info:
            log_entry["error"] = redact_phone_numbers(self.formatException(record.exc_info))

        return json.dumps(log_entry)


class PhoneRedactionFilter(logging.Filter):
    """Logging filter that ensures record msg and args are redacted before formatting."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = redact_phone_numbers(record.msg)
        if record.args:
            if isinstance(record.args, dict):
                record.args = sanitize_log_dict(record.args)
            elif isinstance(record.args, tuple):
                record.args = tuple(
                    redact_phone_numbers(a) if isinstance(a, str) else a for a in record.args
                )
        return True


def setup_logging(level: int = logging.INFO) -> None:
    """Configures structured JSON logging with redaction on the root logger."""
    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    # Remove existing handlers to prevent duplicate logs
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    handler = logging.StreamHandler()
    handler.setFormatter(StructuredJsonFormatter())
    handler.addFilter(PhoneRedactionFilter())
    root_logger.addHandler(handler)


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """Custom 422 handler that strips raw request body input from validation errors

    to prevent leaking PII, phone numbers, or clinical details in error responses.
    """
    sanitized_errors = []
    for err in exc.errors():
        # Keep location, message, and type; drop 'input' field completely
        sanitized_errors.append(
            {
                "loc": err.get("loc"),
                "msg": err.get("msg"),
                "type": err.get("type"),
            }
        )

    return JSONResponse(
        status_code=getattr(
            status, "HTTP_422_UNPROCESSABLE_CONTENT", status.HTTP_422_UNPROCESSABLE_ENTITY
        ),
        content={"detail": sanitized_errors},
    )
