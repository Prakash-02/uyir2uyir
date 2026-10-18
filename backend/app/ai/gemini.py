import asyncio
import hashlib
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


ImageKind = Literal[
    "TEXT_MESSAGE_SCREENSHOT",
    "HOSPITAL_SLIP_OR_FORM",
    "POSTER",
    "NO_REQUEST_TEXT",
]


class GeminiImageExtraction(GeminiExtraction):
    transcript: str = ""
    image_kind: ImageKind = "NO_REQUEST_TEXT"


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


def create_image_extraction_schema(hospital_ids: list[str]) -> type[BaseModel]:
    """Dynamically creates response_schema for multimodal image extraction."""
    allowed_values = tuple(dict.fromkeys(hospital_ids + ["NONE"]))
    HospEnum = Literal[allowed_values]  # type: ignore

    class DynamicQuotedHospital(BaseModel):
        value: HospEnum | None = None
        quote: str | None = None

    class DynamicImageExtraction(BaseModel):
        transcript: str
        image_kind: ImageKind
        hospital: DynamicQuotedHospital = Field(default_factory=DynamicQuotedHospital)
        patient_number: RawQuotedString | None = Field(default_factory=RawQuotedString)
        blood_group: RawQuotedString | None = Field(default_factory=RawQuotedString)
        component: RawQuotedString | None = Field(default_factory=RawQuotedString)
        units: RawQuotedInt | None = Field(default_factory=RawQuotedInt)
        payment_phrases: list[str] = Field(default_factory=list)

    return DynamicImageExtraction


class GeminiExtractor(Protocol):
    """Protocol for extracting entities from blood request text or images."""

    async def extract(
        self,
        text: str,
        hospitals: list[Any] | None = None,
        *,
        hospital_ids: list[str] | None = None,
    ) -> GeminiExtraction: ...

    async def extract_from_image(
        self,
        image_bytes: bytes,
        caption: str = "",
        hospitals: list[Any] | None = None,
        *,
        hospital_ids: list[str] | None = None,
    ) -> GeminiImageExtraction: ...


_system_prompt_cache: str | None = None
_image_system_prompt_cache: str | None = None


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


def get_image_system_prompt() -> str:
    global _image_system_prompt_cache
    if _image_system_prompt_cache is None:
        prompt_path = (
            Path(__file__).resolve().parent.parent.parent / "prompts" / "desk_extract_image_v1.md"
        )
        if prompt_path.exists():
            _image_system_prompt_cache = prompt_path.read_text(encoding="utf-8")
        else:
            _image_system_prompt_cache = (
                "You are an emergency blood request image entity extractor for U2U."
            )
    return _image_system_prompt_cache


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

    async def extract_from_image(
        self,
        image_bytes: bytes,
        caption: str = "",
        hospitals: list[Any] | None = None,
        *,
        hospital_ids: list[str] | None = None,
    ) -> GeminiImageExtraction:
        await self._check_and_increment_daily_cap()

        target_hospitals = hospitals if hospitals is not None else (hospital_ids or [])
        system_base = get_image_system_prompt()
        hosp_table = format_hospital_table(target_hospitals)
        system_instruction = (
            f"{system_base}\n\nREGISTERED HOSPITALS TABLE:\n{hosp_table}"
            if hosp_table
            else f"{system_base}\n\nREGISTERED HOSPITALS TABLE:\nNONE"
        )

        hosp_ids = get_hospital_ids(target_hospitals)
        response_schema = create_image_extraction_schema(hosp_ids)

        image_part = types.Part.from_bytes(data=image_bytes, mime_type="image/jpeg")
        contents: list[Any] = [image_part]
        if caption.strip():
            contents.append(f"<message_caption>\n{caption.strip()}\n</message_caption>")

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
            max_output_tokens=1500,
            system_instruction=system_instruction,
            http_options=types.HttpOptions(timeout=8000),
        )

        last_error: Exception | None = None
        for attempt in range(2):
            try:
                response = await client.aio.models.generate_content(
                    model=self.settings.GEMINI_MODEL,
                    contents=contents,
                    config=config,
                )
                if not response.text:
                    raise AIUnavailable("Empty response received from Gemini")
                return GeminiImageExtraction.model_validate_json(response.text)
            except AIUnavailable:
                raise
            except Exception as exc:
                last_error = exc
                logger.warning(
                    "Gemini image generation attempt %d failed: %s",
                    attempt + 1,
                    type(exc).__name__,
                )
                if attempt == 0:
                    await asyncio.sleep(0.5)

        raise AIUnavailable(f"Gemini call failed: {last_error}") from last_error


# Sample photo SHA-256 signatures for deterministic demo mock extraction
_UNKNOWN_HOSP_SHA256 = {
    "3633fe02079edd429b2124a9458b2906406056d5ea1c4c28b6c44874a7ec4220",
    "e7321f006cfb903dbab4910b5b8054ac4736aeca7c1b05a53f50815cad2957c7",
}
_REGISTERED_HOSP_SHA256 = {
    "60220ce2badee34c27efe1a66199a2f9a1330efbb81e13e22a935d7ce7975939",
    "5d753b083edee0503083e0fc9813ff5e02751b9b0ec9e6d94ed4acf7699efff3",
}


class MockGeminiExtractor:
    """Deterministic extractor for demo mode and offline testing."""

    def __init__(self, settings: Settings | None = None) -> None:
        self.settings = settings or get_settings()

    async def extract(
        self,
        text: str,
        hospitals: list[Any] | None = None,
        *,
        hospital_ids: list[str] | None = None,
    ) -> GeminiExtraction:
        # Check for standard mock cases
        lower = text.lower()
        if "sample general hospital" in lower and "ip-101" in lower:
            return GeminiExtraction(
                hospital=RawQuotedString(
                    value="hosp-sample-1", quote="Sample General Hospital, Chennai"
                ),
                patient_number=RawQuotedString(value="IP-101", quote="IP-101"),
                blood_group=RawQuotedString(value="O+", quote="O+"),
                component=RawQuotedString(value="RED_CELLS", quote="RED_CELLS"),
                units=RawQuotedInt(value=2, quote="2 units"),
                payment_phrases=[],
            )

        if "demo care hospital" in lower:
            return GeminiExtraction(
                hospital=RawQuotedString(
                    value="NONE", quote="Demo Care Hospital Tambaram Selaiyur"
                ),
                patient_number=RawQuotedString(value=None, quote=None),
                blood_group=RawQuotedString(value=None, quote=None),
                component=RawQuotedString(value=None, quote=None),
                units=RawQuotedInt(value=None, quote=None),
                payment_phrases=[],
            )

        return GeminiExtraction()

    async def extract_from_image(
        self,
        image_bytes: bytes,
        caption: str = "",
        hospitals: list[Any] | None = None,
        *,
        hospital_ids: list[str] | None = None,
    ) -> GeminiImageExtraction:
        sha = hashlib.sha256(image_bytes).hexdigest()

        if sha in _UNKNOWN_HOSP_SHA256:
            return GeminiImageExtraction(
                transcript=(
                    "🩸 Urgent Need: Any +ve group\n"
                    "Patient name: Arun Kumar\n"
                    "Demo Care Hospital Tambaram Selaiyur\n"
                    "Urgent Any blood needed for operation tomorrow morning (23 Sept 2026)\n"
                    "Contact: +91 90000 00001\n"
                    "(Patient's grandfather)\n"
                    "Please share with Frnds and fam\n"
                    "SAMPLE · fictional data"
                ),
                image_kind="TEXT_MESSAGE_SCREENSHOT",
                hospital=RawQuotedString(
                    value="NONE", quote="Demo Care Hospital Tambaram Selaiyur"
                ),
                patient_number=RawQuotedString(value=None, quote=None),
                blood_group=RawQuotedString(value=None, quote=None),
                component=RawQuotedString(value=None, quote=None),
                units=RawQuotedInt(value=None, quote=None),
                payment_phrases=[],
            )

        if sha in _REGISTERED_HOSP_SHA256:
            return GeminiImageExtraction(
                transcript=(
                    "🩸 Urgent Need: O+ve, 2 units\n"
                    "Patient name: Arun Kumar\n"
                    "IP No: IP-101\n"
                    "Sample General Hospital, Chennai\n"
                    "Red cells needed for operation tomorrow morning\n"
                    "Contact: +91 90000 00001\n"
                    "(Patient's grandfather)\n"
                    "Please share with Frnds and fam\n"
                    "SAMPLE · fictional data"
                ),
                image_kind="TEXT_MESSAGE_SCREENSHOT",
                hospital=RawQuotedString(
                    value="hosp-sample-1", quote="Sample General Hospital, Chennai"
                ),
                patient_number=RawQuotedString(value="IP-101", quote="IP-101"),
                blood_group=RawQuotedString(value="O+ve", quote="O+ve"),
                component=RawQuotedString(value="Red cells", quote="Red cells"),
                units=RawQuotedInt(value=2, quote="2 units"),
                payment_phrases=[],
            )

        # Default fallback for unknown / synthetic test images without matching sha
        return GeminiImageExtraction(
            transcript=caption if caption else "",
            image_kind="NO_REQUEST_TEXT" if not caption else "TEXT_MESSAGE_SCREENSHOT",
            hospital=RawQuotedString(value="NONE", quote=None),
            patient_number=RawQuotedString(value=None, quote=None),
            blood_group=RawQuotedString(value=None, quote=None),
            component=RawQuotedString(value=None, quote=None),
            units=RawQuotedInt(value=None, quote=None),
            payment_phrases=[],
        )


# Global active extractor instance (allows test swapping with FakeGemini)
_active_extractor: GeminiExtractor | None = None


def get_gemini_extractor() -> GeminiExtractor:
    global _active_extractor
    if _active_extractor is not None:
        return _active_extractor
    settings = get_settings()
    if settings.DATA_MODE == "demo" and not settings.GOOGLE_CLOUD_PROJECT:
        return MockGeminiExtractor(settings=settings)
    return VertexGeminiExtractor(settings=settings)


def set_gemini_extractor(extractor: GeminiExtractor | None) -> None:
    global _active_extractor
    _active_extractor = extractor
