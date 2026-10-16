import asyncio
import logging
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Literal, Protocol

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


def format_hospital_table(hospitals: list[Any]) -> str:
    """Formats hospital list into table lines: ID | full name | aliases | city."""
    lines: list[str] = []
    for h in hospitals:
        if isinstance(h, str):
            lines.append(f"{h} | {h} | None | Chennai")
        elif isinstance(h, dict):
            h_id = h.get("id", "")
            name = h.get("name", "")
            aliases_raw = h.get("aliases", [])
            aliases_str = ", ".join(aliases_raw) if aliases_raw else "None"
            city = h.get("city", "Chennai")
            lines.append(f"{h_id} | {name} | {aliases_str} | {city}")
        else:
            h_id = getattr(h, "id", "")
            name = getattr(h, "name", "")
            aliases_raw = getattr(h, "aliases", [])
            aliases_str = ", ".join(aliases_raw) if aliases_raw else "None"
            city = getattr(h, "city", "Chennai")
            lines.append(f"{h_id} | {name} | {aliases_str} | {city}")
    return "\n".join(lines)


def get_hospital_ids(hospitals: list[Any]) -> list[str]:
    """Extracts hospital IDs from strings, dicts, or Hospital entities."""
    ids: list[str] = []
    for h in hospitals:
        if isinstance(h, str):
            ids.append(h)
        elif isinstance(h, dict):
            if "id" in h:
                ids.append(h["id"])
        elif hasattr(h, "id"):
            ids.append(h.id)
    return ids


def create_extraction_schema(hospital_ids: list[str]) -> type[BaseModel]:
    """Dynamically creates response_schema with hospital.value enum limited to IDs + NONE."""
    allowed_values = tuple(dict.fromkeys(hospital_ids + ["NONE"]))
    HospEnum = Literal[allowed_values]  # type: ignore

    class DynamicQuotedHospital(BaseModel):
        value: HospEnum | None = None
        quote: str | None = None

    class DynamicExtraction(BaseModel):
        hospital: DynamicQuotedHospital = Field(default_factory=DynamicQuotedHospital)
        patient_number: RawQuotedString | None = Field(default_factory=RawQuotedString)
        blood_group: RawQuotedString | None = Field(default_factory=RawQuotedString)
        component: RawQuotedString | None = Field(default_factory=RawQuotedString)
        units: RawQuotedInt | None = Field(default_factory=RawQuotedInt)
        payment_phrases: list[str] = Field(default_factory=list)

    return DynamicExtraction


class GeminiExtractor(Protocol):
    """Protocol for extracting entities from blood request text."""

    async def extract(
        self,
        text: str,
        hospitals: list[Any] | None = None,
        *,
        hospital_ids: list[str] | None = None,
    ) -> GeminiExtraction: ...


_system_prompt_cache: str | None = None


def get_system_prompt() -> str:
    global _system_prompt_cache
    if _system_prompt_cache is None:
        prompt_path = (
            Path(__file__).resolve().parent.parent.parent / "prompts" / "desk_extract_v2.md"
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

    async def extract(
        self,
        text: str,
        hospitals: list[Any] | None = None,
        *,
        hospital_ids: list[str] | None = None,
    ) -> GeminiExtraction:
        await self._check_and_increment_daily_cap()

        target_hospitals = hospitals if hospitals is not None else (hospital_ids or [])
        system_base = get_system_prompt()
        hosp_table = format_hospital_table(target_hospitals)
        system_instruction = (
            f"{system_base}\n\nREGISTERED HOSPITALS TABLE:\n{hosp_table}"
            if hosp_table
            else f"{system_base}\n\nREGISTERED HOSPITALS TABLE:\nNONE"
        )

        prompt_content = f"<message>\n{text}\n</message>"
        hosp_ids = get_hospital_ids(target_hospitals)
        response_schema = create_extraction_schema(hosp_ids)

        client = genai.Client(
            vertexai=True,
            project=self.settings.GOOGLE_CLOUD_PROJECT,
            location=self.settings.VERTEX_LOCATION,
            http_options=types.HttpOptions(timeout=8000),
        )

        config = types.GenerateContentConfig(
            temperature=0.0,
            response_mime_type="application/json",
            response_schema=response_schema,
            thinking_config=types.ThinkingConfig(thinking_budget=0),
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
