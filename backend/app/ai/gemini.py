import asyncio
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Protocol

from google import genai
from google.genai import types
from pydantic import BaseModel, Field

from app.core.config import Settings, get_settings
from app.core.store import Store, get_store

logger = logging.getLogger("u2u.ai.gemini")


class AIUnavailable(Exception):
    """Raised when Gemini on Vertex AI is unavailable, timed out, or quota exceeded."""

    pass


class RawQuotedString(BaseModel):
    value: str | None = None
    quote: str | None = None


class RawQuotedInt(BaseModel):
    value: int | None = None
    quote: str | None = None


class GeminiExtraction(BaseModel):
    hospital: RawQuotedString = Field(default_factory=RawQuotedString)
    patient_number: RawQuotedString | None = Field(default_factory=RawQuotedString)
    blood_group: RawQuotedString | None = Field(default_factory=RawQuotedString)
    component: RawQuotedString | None = Field(default_factory=RawQuotedString)
    units: RawQuotedInt | None = Field(default_factory=RawQuotedInt)
    payment_phrases: list[str] = Field(default_factory=list)


class GeminiExtractor(Protocol):
    """Protocol for extracting entities from blood request text."""

    async def extract(self, text: str, hospital_ids: list[str]) -> GeminiExtraction: ...


_system_prompt_cache: str | None = None


def get_system_prompt() -> str:
    global _system_prompt_cache
    if _system_prompt_cache is None:
        prompt_path = (
            Path(__file__).resolve().parent.parent.parent / "prompts" / "desk_extract_v1.md"
        )
        if prompt_path.exists():
            _system_prompt_cache = prompt_path.read_text(encoding="utf-8")
        else:
            _system_prompt_cache = "You are an emergency blood request entity extractor for U2U."
    return _system_prompt_cache


class VertexGeminiExtractor:
    """Production Gemini Flash extractor calling Vertex AI with strict schema and timeout."""

    def __init__(self, settings: Settings | None = None, store: Store | None = None) -> None:
        self.settings = settings or get_settings()
        self.store = store or get_store()

    async def _check_and_increment_daily_cap(self) -> None:
        app_config = await self.store.get_config("app") or {}
        today_str = datetime.now(UTC).strftime("%Y-%m-%d")
        current_date = app_config.get("geminiCallsDate")
        current_count = app_config.get("geminiCallsToday", 0) if current_date == today_str else 0

        if current_count >= self.settings.DAILY_GEMINI_CAP:
            logger.warning(
                "Daily Gemini call cap exceeded: %d / %d",
                current_count,
                self.settings.DAILY_GEMINI_CAP,
            )
            raise AIUnavailable("Daily Gemini quota exceeded")

        app_config["geminiCallsDate"] = today_str
        app_config["geminiCallsToday"] = current_count + 1
        await self.store.set_config("app", app_config)

    async def extract(self, text: str, hospital_ids: list[str]) -> GeminiExtraction:
        await self._check_and_increment_daily_cap()

        system_base = get_system_prompt()
        hospitals_str = ", ".join(hospital_ids) if hospital_ids else "NONE"
        system_instruction = f"{system_base}\n\nALLOWED_HOSPITAL_IDS:\n[{hospitals_str}]"

        prompt_content = f"<message>\n{text}\n</message>"

        client = genai.Client(
            vertexai=True,
            project=self.settings.GOOGLE_CLOUD_PROJECT,
            location=self.settings.VERTEX_LOCATION,
            http_options=types.HttpOptions(timeout=8000),
        )

        config = types.GenerateContentConfig(
            temperature=0.0,
            response_mime_type="application/json",
            response_schema=GeminiExtraction,
            max_output_tokens=1000,
            system_instruction=system_instruction,
            http_options=types.HttpOptions(timeout=8000),
        )

        last_error: Exception | None = None
        for attempt in range(2):
            try:
                response = await client.aio.models.generate_content(
                    model=self.settings.GEMINI_MODEL,
                    contents=prompt_content,
                    config=config,
                )
                if not response.text:
                    raise AIUnavailable("Empty response received from Gemini")
                return GeminiExtraction.model_validate_json(response.text)
            except AIUnavailable:
                raise
            except Exception as exc:
                last_error = exc
                logger.warning(
                    "Gemini generation attempt %d failed: %s",
                    attempt + 1,
                    type(exc).__name__,
                )
                if attempt == 0:
                    await asyncio.sleep(0.5)

        raise AIUnavailable(f"Gemini call failed: {last_error}") from last_error


# Global active extractor instance (allows test swapping with FakeGemini)
_active_extractor: GeminiExtractor | None = None


def get_gemini_extractor() -> GeminiExtractor:
    global _active_extractor
    if _active_extractor is not None:
        return _active_extractor
    return VertexGeminiExtractor()


def set_gemini_extractor(extractor: GeminiExtractor | None) -> None:
    global _active_extractor
    _active_extractor = extractor
