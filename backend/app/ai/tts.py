"""Google Cloud Text-to-Speech audio generation and caching for U2U call scripts.

Voices:
- Tamil (ta-IN): ta-IN-Standard-A
- English (en-IN): en-IN-Standard-A

Templates:
Generated once per template, language, and weather alert flag.
Cached in memory and in /tmp (or system temporary directory).
Served via GET /audio/{template_id}/{lang}.mp3.
"""

import logging
import tempfile
from dataclasses import dataclass
from pathlib import Path

from fastapi import APIRouter, Response

from app.core.store import get_store

logger = logging.getLogger("u2u.tts")

router = APIRouter(prefix="/audio", tags=["Audio & TTS"])

# In-memory audio cache: key -> bytes
_AUDIO_CACHE: dict[str, bytes] = {}


# In-memory template parameter registry
@dataclass
class CallAudioTemplate:
    template_id: str
    blood_group: str
    component: str
    centre_name: str
    weather_alert: bool = False


_TEMPLATES: dict[str, CallAudioTemplate] = {}


def register_audio_template(
    template_id: str,
    blood_group: str,
    component: str,
    centre_name: str,
    weather_alert: bool = False,
) -> None:
    """Registers or updates a call audio template by ID."""
    _TEMPLATES[template_id] = CallAudioTemplate(
        template_id=template_id,
        blood_group=blood_group,
        component=component,
        centre_name=centre_name,
        weather_alert=weather_alert,
    )


def build_template_script(
    blood_group: str,
    component: str,
    centre_name: str,
    lang: str = "en",
    weather_alert: bool = False,
) -> str:
    """Builds spoken call prompt text in Tamil or English."""
    norm_lang = lang.lower()
    is_ta = norm_lang.startswith("ta")

    # Format blood group & component readability
    bg_display = blood_group.replace("_", " ").replace("POS", "+").replace("NEG", "-")
    comp_display = component.replace("_", " ").lower()

    if is_ta:
        if weather_alert:
            prefix = (
                "எச்சரிக்கை: சென்னை முழுவதும் பலத்த மழை பெய்து வருகிறது. பாதுகாப்பாக இருந்தால் மட்டுமே வரவும். "
            )
        else:
            prefix = ""
        return (
            f"{prefix}உயிர் டு உயிர் அவசர இரத்த தேவை: {centre_name}-ல் {bg_display} {comp_display} தேவைப்படுகிறது. "
            "தானம் செய்ய வர 1 அழுத்தவும், மறுக்க 2 அழுத்தவும், வெளியேற 9 அழுத்தவும்."
        )
    else:
        if weather_alert:
            prefix = (
                "Warning: Heavy rain and waterlogging reported across Chennai. "
                "Please travel only if your route is completely safe. "
            )
        else:
            prefix = ""
        return (
            f"{prefix}U2U urgent blood request: {bg_display} {comp_display} needed at {centre_name}. "
            "Press 1 to come donate, 2 to decline, or 9 to opt out."
        )


def _get_cache_dir() -> Path:
    """Returns /tmp or system temp directory as a Path."""
    tmp_path = Path("/tmp")
    try:
        tmp_path.mkdir(parents=True, exist_ok=True)
        return tmp_path
    except Exception:
        return Path(tempfile.gettempdir())


def _generate_synthetic_mp3_fallback() -> bytes:
    """Generates a minimal valid MPEG-1 Layer 3 silent frame fallback."""
    # Standard 418-byte silence frame for MPEG-1 Layer 3, 128 kbps, 44.1 kHz
    header = b"\xff\xfb\x90\x00"
    return header + (b"\x00" * 414)


async def synthesize_or_get_audio(
    template_id: str,
    lang: str,
    blood_group: str = "O+",
    component: str = "whole blood",
    centre_name: str = "Blood Centre",
    weather_alert: bool = False,
) -> bytes:
    """Retrieves cached audio or synthesizes audio via Cloud Text-to-Speech."""
    cache_key = f"{template_id}_{lang}_{'rain' if weather_alert else 'clear'}"

    # 1. Check in-memory cache
    if cache_key in _AUDIO_CACHE:
        return _AUDIO_CACHE[cache_key]

    # 2. Check /tmp filesystem cache
    cache_dir = _get_cache_dir()
    cache_file = cache_dir / f"u2u_{cache_key}.mp3"
    if cache_file.exists():
        try:
            audio_bytes = cache_file.read_bytes()
            if len(audio_bytes) > 0:
                _AUDIO_CACHE[cache_key] = audio_bytes
                return audio_bytes
        except Exception as e:
            logger.warning("Failed to read audio cache file %s: %s", cache_file, e)

    # 3. Generate script text
    script_text = build_template_script(
        blood_group=blood_group,
        component=component,
        centre_name=centre_name,
        lang=lang,
        weather_alert=weather_alert,
    )

    norm_lang = lang.lower()
    voice_lang = "ta-IN" if norm_lang.startswith("ta") else "en-IN"
    voice_name = "ta-IN-Standard-A" if voice_lang == "ta-IN" else "en-IN-Standard-A"

    audio_bytes: bytes | None = None

    # 4. Synthesize with Google Cloud Text-to-Speech
    try:
        from google.cloud import texttospeech

        client = texttospeech.TextToSpeechClient()
        synthesis_input = texttospeech.SynthesisInput(text=script_text)
        voice = texttospeech.VoiceSelectionParams(
            language_code=voice_lang,
            name=voice_name,
        )
        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.MP3,
        )
        response = client.synthesize_speech(
            input=synthesis_input,
            voice=voice,
            audio_config=audio_config,
        )
        audio_bytes = response.audio_content
    except Exception as e:
        logger.warning(
            "Cloud Text-to-Speech synthesis failed or unconfigured (%s). Using audio fallback.",
            e,
        )
        audio_bytes = _generate_synthetic_mp3_fallback()

    # 5. Populate caches
    _AUDIO_CACHE[cache_key] = audio_bytes
    try:
        cache_file.write_bytes(audio_bytes)
    except Exception as e:
        logger.warning("Failed writing audio cache file %s: %s", cache_file, e)

    return audio_bytes


@router.get("/{template_id}/{lang}.mp3")
@router.get("/{template_id}/{lang}")
async def serve_audio_mp3(template_id: str, lang: str) -> Response:
    """Serves the generated call script MP3 audio for a template and language."""
    # Strip optional .mp3 suffix if matched without
    clean_lang = lang.removesuffix(".mp3").lower()
    if clean_lang not in ("en", "ta", "en-in", "ta-in"):
        clean_lang = "en"

    # Look up template details
    bg = "O+"
    comp = "whole blood"
    centre = "Chennai Blood Centre"
    weather = False

    # Check registered templates
    if template_id in _TEMPLATES:
        t = _TEMPLATES[template_id]
        bg, comp, centre, weather = t.blood_group, t.component, t.centre_name, t.weather_alert
    else:
        # Check if template_id is a blood request ID in store
        store = get_store()
        req = await store.get_request(template_id)
        if req:
            bg = req.blood_group
            comp = req.component
            centre = req.centre_name or req.hospital_name
            app_conf = await store.get_config("app") or {}
            weather = bool(app_conf.get("weatherAlert", False))

    audio_bytes = await synthesize_or_get_audio(
        template_id=template_id,
        lang=clean_lang,
        blood_group=bg,
        component=comp,
        centre_name=centre,
        weather_alert=weather,
    )

    return Response(
        content=audio_bytes,
        media_type="audio/mpeg",
        headers={
            "Cache-Control": "public, max-age=86400",
            "Content-Disposition": f'inline; filename="{template_id}_{clean_lang}.mp3"',
        },
    )
