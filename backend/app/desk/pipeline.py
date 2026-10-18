import asyncio
import hashlib
import logging
import re
import secrets
import time
from datetime import UTC, datetime, timedelta
from typing import Any, Literal

from fastapi import HTTPException

from app.ai.gemini import (
    AIUnavailable,
    GeminiExtraction,
    GeminiImageExtraction,
    get_gemini_extractor,
)
from app.core.config import Settings, get_settings
from app.core.entities import Hospital
from app.core.store import Store, get_store
from app.desk.image_input import validate_and_sanitize_image
from app.desk.links import create_and_store_confirm_link, mask_patient_ref
from app.desk.models import (
    DeskAnswer,
    DeskResult,
    DeskTrace,
    QuotedField,
)
from app.requests.models import BloodGroup, BloodRequest, Component, RequestStatus

logger = logging.getLogger("u2u.desk.pipeline")

# In-memory IP rate limiter: max 10 requests per minute
_ip_history: dict[str, list[float]] = {}
_ip_lock = asyncio.Lock()

AMBIGUOUS_KEYWORDS = {
    "gh",
    "general hospital",
    "govt hospital",
    "government hospital",
    "district hospital",
    "care hospital",
    "city hospital",
    "private hospital",
}

PAYMENT_REGEX = re.compile(
    r"\b(pay|paid|paying|payment|charge|charges|rupees?|rs\.?|inr|amount|fee|fees|cash|remuneration|price|cost|பணம்|காசு)\b|₹",
    re.IGNORECASE,
)
PROCESSING_CHARGE_REGEX = re.compile(r"\b(?:blood\s+)?processing\s+charges?\b", re.IGNORECASE)


async def check_ip_rate_limit(
    ip: str, limit: int = 10, window_secs: int = 60, current_time: float | None = None
) -> None:
    """Enforces in-memory rate limiting per IP address."""
    now_ts = current_time or time.time()
    async with _ip_lock:
        history = _ip_history.get(ip, [])
        valid = [t for t in history if now_ts - t < window_secs]
        if len(valid) >= limit:
            _ip_history[ip] = valid
            raise HTTPException(
                status_code=429,
                detail="Rate limit exceeded. Maximum 10 checks per minute.",
            )
        valid.append(now_ts)
        _ip_history[ip] = valid


def reset_ip_rate_limiter() -> None:
    """Clears IP rate limiter memory (used in testing)."""
    global _ip_history
    _ip_history.clear()


def normalize_text(text: str) -> str:
    """Normalizes whitespace and lowercases string for exact token checking."""
    return " ".join(text.lower().split())


def normalize_component(comp_str: str | None, raw_text: str) -> Component:
    """Maps extracted component text to canonical Component enum."""
    if not comp_str:
        return Component.UNSPECIFIED

    norm = comp_str.lower().strip()
    raw_norm = raw_text.lower()

    # Rule: 'pints' or 'bottles' leaves component unknown
    if "pint" in norm or "bottle" in norm or "pint" in raw_norm or "bottle" in raw_norm:
        return Component.UNSPECIFIED

    if (
        "prbc" in norm
        or "pcv" in norm
        or "packed cells" in norm
        or "packed red cells" in norm
        or "red cells" in norm
        or "red_cells" in norm
    ):
        return Component.RED_CELLS
    if "sdp" in norm or "apheresis" in norm:
        return Component.PLATELETS_SDP
    if "rdp" in norm:
        return Component.PLATELETS_RDP
    if "platelet" in norm:
        return Component.UNSPECIFIED
    if "whole blood" in norm or "whole_blood" in norm:
        return Component.WHOLE_BLOOD
    if "plasma" in norm or "ffp" in norm:
        return Component.PLASMA

    return Component.UNSPECIFIED


def normalize_blood_group(bg_str: str | None) -> BloodGroup | None:
    """Normalizes blood group strings across English and Tamil variations."""
    if not bg_str:
        return None

    norm = bg_str.lower().replace(" ", "").replace("-", "").replace("_", "")

    # Tamil mappings
    if "ஓபாசி" in norm or "oபாசி" in norm:
        return BloodGroup.O_POS
    if "ஓநெக" in norm or "oநெக" in norm:
        return BloodGroup.O_NEG
    if "ஏபாசி" in norm or "aபாசி" in norm:
        return BloodGroup.A_POS
    if "ஏநெக" in norm or "aநெக" in norm:
        return BloodGroup.A_NEG
    if "பிபாசி" in norm or "bபாசி" in norm:
        return BloodGroup.B_POS
    if "பிநெக" in norm or "bநெக" in norm:
        return BloodGroup.B_NEG
    if "ஏபிபாசி" in norm or "abபாசி" in norm:
        return BloodGroup.AB_POS
    if "ஏபிநெக" in norm or "abநெக" in norm:
        return BloodGroup.AB_NEG

    # Standard / colloquial formats
    if norm in ("o+", "opositive", "opos", "o+ve"):
        return BloodGroup.O_POS
    if norm in ("o-", "onegative", "oneg", "o-ve"):
        return BloodGroup.O_NEG
    if norm in ("a+", "apositive", "apos", "a+ve"):
        return BloodGroup.A_POS
    if norm in ("a-", "anegative", "aneg", "a-ve"):
        return BloodGroup.A_NEG
    if norm in ("b+", "bpositive", "bpos", "b+ve"):
        return BloodGroup.B_POS
    if norm in ("b-", "bnegative", "bneg", "b-ve"):
        return BloodGroup.B_NEG
    if norm in ("ab+", "abpositive", "abpos", "ab+ve"):
        return BloodGroup.AB_POS
    if norm in ("ab-", "abnegative", "abneg", "ab-ve"):
        return BloodGroup.AB_NEG

    return None


def detect_payment_phrases(raw_text: str, gemini_phrases: list[str]) -> list[str]:
    """Scans for remuneration phrases. 'processing charge' alone is allowed."""
    detected: list[str] = []

    # Check text with allowed processing charges stripped out
    stripped_text = PROCESSING_CHARGE_REGEX.sub(" ", raw_text)
    for match in PAYMENT_REGEX.finditer(stripped_text):
        token = match.group().strip()
        if token and token not in detected:
            detected.append(token)

    for phrase in gemini_phrases:
        p_clean = phrase.strip()
        if not p_clean:
            continue
        if PROCESSING_CHARGE_REGEX.fullmatch(p_clean):
            continue
        if p_clean not in detected:
            detected.append(p_clean)

    return detected


IMAGE_DISCLAIMER_EN = "A photo can be edited. We check it against the hospital's live requests, not how real it looks."
IMAGE_DISCLAIMER_TA = (
    "புகைப்படங்கள் திருத்தப்படலாம். மருத்துவமனையின் நேரடி கோரிக்கைகளுடன் ஒப்பிட்டே நாங்கள் சரிபார்க்கிறோம், "
    "அது எவ்வளவு உண்மையானதாகத் தோன்றுகிறது என்பதைப் பார்த்து அல்ல."
)
IMAGE_DISCLAIMER = f"{IMAGE_DISCLAIMER_EN} ({IMAGE_DISCLAIMER_TA})"


async def _evaluate_desk_source(
    source_text: str,
    extraction: GeminiExtraction,
    hospitals: list[Hospital],
    input_type: Literal["text", "image"] = "text",
    transcript: str | None = None,
    store: Store | None = None,
    settings: Settings | None = None,
    now: datetime | None = None,
) -> DeskResult:
    """Shared deterministic verification logic applied to normalized source text."""
    s = store or get_store()
    cfg = settings or get_settings()
    current_time = now or datetime.now(UTC)
    now_iso = current_time.isoformat()

    # Step i: Fingerprint calculation & deduplication within 24 hours
    norm_source_text = normalize_text(source_text)
    fingerprint = hashlib.sha256(norm_source_text.encode("utf-8")).hexdigest()

    existing_paste = await s.get_paste(fingerprint)
    if existing_paste:
        created_at_str = existing_paste.get("createdAt", "")
        twenty_four_hours_ago = (current_time - timedelta(hours=24)).isoformat()
        if created_at_str and created_at_str >= twenty_four_hours_ago:
            # Deduplicated repeat within 24 hours: return stored result trace
            cached_ans = existing_paste.get("answer", DeskAnswer.NOT_VERIFIED)
            cached_msg = existing_paste.get(
                "message", "Verified request (deduplicated repeat within 24h)."
            )
            if input_type == "image" and IMAGE_DISCLAIMER_EN not in cached_msg:
                cached_msg = f"{cached_msg} {IMAGE_DISCLAIMER}"

            return DeskResult(
                answer=DeskAnswer(cached_ans),
                message=cached_msg,
                request_id=existing_paste.get("requestId"),
                hospital_name=existing_paste.get("hospitalName"),
                trace=DeskTrace(
                    input_type=input_type,
                    transcript=transcript,
                    gemini_choice=existing_paste.get(
                        "geminiChoice", "Cached from previous submission."
                    ),
                    code_decision="Deduplicated repeat submission within 24 hours.",
                ),
                footer="Nobody may charge you for a donor.",
                demo_confirm_token=existing_paste.get("demoConfirmToken"),
            )

    # Step c: Quote check (drop any field whose quote is not found word for word in source_text)
    def check_quote(quote_str: str | None) -> tuple[str | None, bool]:
        if not quote_str:
            return None, False
        norm_q = normalize_text(quote_str)
        if norm_q and norm_q in norm_source_text:
            return quote_str, True
        return None, False

    hosp_quote, hosp_kept = check_quote(extraction.hospital.quote if extraction.hospital else None)
    patient_quote, patient_kept = check_quote(
        extraction.patient_number.quote if extraction.patient_number else None
    )
    bg_quote, bg_kept = check_quote(
        extraction.blood_group.quote if extraction.blood_group else None
    )
    comp_quote, comp_kept = check_quote(
        extraction.component.quote if extraction.component else None
    )
    units_quote, units_kept = check_quote(extraction.units.quote if extraction.units else None)

    hosp_val = extraction.hospital.value if (hosp_kept and extraction.hospital) else None
    patient_val = (
        extraction.patient_number.value if (patient_kept and extraction.patient_number) else None
    )
    bg_raw_val = extraction.blood_group.value if (bg_kept and extraction.blood_group) else None
    comp_raw_val = extraction.component.value if (comp_kept and extraction.component) else None
    units_val = extraction.units.value if (units_kept and extraction.units) else None

    # Step d: Canonicalization & dictionaries
    norm_bg = normalize_blood_group(bg_raw_val) if bg_kept else None
    norm_comp = (
        normalize_component(comp_raw_val, source_text) if comp_kept else Component.UNSPECIFIED
    )

    # Step e: Hospital ambiguity check
    hosp_map = {h.id: h for h in hospitals}
    matched_hospital: Hospital | None = None
    is_ambiguous_hospital = False

    if hosp_kept and hosp_val and hosp_val in hosp_map:
        matched_hospital = hosp_map[hosp_val]

    # Inspect if text merely mentions generic acronyms like "GH"
    raw_hosp_tokens = (hosp_quote or "").lower().split()
    for token in raw_hosp_tokens:
        clean_tok = token.strip(".,;:()")
        if clean_tok in AMBIGUOUS_KEYWORDS and (
            not matched_hospital or clean_tok == normalize_text(hosp_quote or "")
        ):
            is_ambiguous_hospital = True
            break

    # If message contains bare 'GH' or generic without the full name
    if re.search(r"\bGH\b", source_text) and (
        not matched_hospital or normalize_text(matched_hospital.name) not in norm_source_text
    ):
        is_ambiguous_hospital = True

    # Step f: Payment check
    detected_payments = detect_payment_phrases(source_text, extraction.payment_phrases)
    payment_blocked = len(detected_payments) > 0

    # Step g: Decide
    answer: DeskAnswer
    message: str
    code_decision: str
    target_request_id: str | None = None
    demo_confirm_token: str | None = None

    if payment_blocked:
        answer = DeskAnswer.NOT_VERIFIED
        message = "Couldn't verify. Requests offering or soliciting payment are prohibited."
        code_decision = (
            f"NOT_VERIFIED: Payment wording detected ({', '.join(detected_payments)})."
            " Commercial donor solicitations are barred under NBTC guidelines."
        )
    elif is_ambiguous_hospital:
        answer = DeskAnswer.NOT_VERIFIED
        message = "Please paste again with the full hospital name."
        code_decision = "NOT_VERIFIED: Ambiguous hospital name detected (e.g. 'GH'). Full hospital name is required."
    elif not matched_hospital:
        answer = DeskAnswer.NOT_VERIFIED
        message = "Couldn't verify. Please call the hospital."
        code_decision = "NOT_VERIFIED: Hospital not recognized or quote check failed."
    else:
        # Hospital is recognized. Check active requests in store for exact key match
        open_requests = await s.list_requests_by_hospital(matched_hospital.id)
        matching_req = None

        if patient_val:
            norm_patient = normalize_text(patient_val)
            for req in open_requests:
                if (
                    req.status in (RequestStatus.OPEN, RequestStatus.PAUSED)
                    and req.patient_ref
                    and normalize_text(req.patient_ref) == norm_patient
                    and (
                        norm_comp == Component.UNSPECIFIED
                        or req.component == norm_comp
                        or req.component == Component.UNSPECIFIED
                    )
                ):
                    matching_req = req
                    break

        if matching_req:
            answer = DeskAnswer.VERIFIED_MATCH
            message = "Verified hospital request. Match confirmed with active hospital order."
            target_request_id = matching_req.id
            code_decision = (
                f"VERIFIED_MATCH: Exact patient reference '{patient_val}' matches active"
                f" request {matching_req.id} at {matched_hospital.name}."
            )
        else:
            # Create request as AWAITING_HOSPITAL and dispatch confirm link
            new_req_id = f"req_{secrets.token_hex(6)}"
            expires_at = (current_time + timedelta(minutes=30)).isoformat()
            awaiting_req = BloodRequest(
                id=new_req_id,
                hospital_id=matched_hospital.id,
                hospital_name=matched_hospital.name,
                centre_id=matched_hospital.centre_id,
                centre_name="Regional Blood Transfusion Centre",
                blood_group=norm_bg or BloodGroup.O_POS,
                component=norm_comp,
                units_needed=units_val or 1,
                status=RequestStatus.AWAITING_HOSPITAL,
                round=1,
                created_at=now_iso,
                updated_at=now_iso,
                expires_at=expires_at,
                is_simulated=(cfg.DATA_MODE == "demo"),
                patient_ref=patient_val,
            )
            await s.save_request(awaiting_req)

            token = await create_and_store_confirm_link(
                new_req_id, matched_hospital.id, s, cfg, current_time
            )
            if cfg.DATA_MODE == "demo":
                demo_confirm_token = token

            answer = DeskAnswer.SENT_TO_HOSPITAL
            message = "Sent to hospital blood bank. Pending hospital verification."
            target_request_id = new_req_id
            code_decision = (
                f"SENT_TO_HOSPITAL: Registered hospital '{matched_hospital.name}' verified."
                " Created order in AWAITING_HOSPITAL and generated single-use verification link."
            )

    # Step h: Build DeskResult with full trace
    gemini_choice_str = (
        f"Extracted hospital '{hosp_val}' ({hosp_quote}), patient '{patient_val}',"
        f" blood group '{bg_raw_val}', component '{comp_raw_val}', units '{units_val}'."
    )

    final_message = f"{message} {IMAGE_DISCLAIMER}" if input_type == "image" else message

    trace = DeskTrace(
        input_type=input_type,
        transcript=transcript,
        hospital=QuotedField[str](
            value=matched_hospital.name if matched_hospital and hosp_kept else None,
            quote=hosp_quote,
            kept=hosp_kept and matched_hospital is not None,
        ),
        patient_number=QuotedField[str](
            value=patient_val,
            quote=patient_quote,
            kept=patient_kept,
        ),
        blood_group=QuotedField[BloodGroup](
            value=norm_bg,
            quote=bg_quote,
            kept=bg_kept and norm_bg is not None,
        ),
        component=QuotedField[Component](
            value=norm_comp,
            quote=comp_quote,
            kept=comp_kept,
        ),
        units=QuotedField[int](
            value=units_val,
            quote=units_quote,
            kept=units_kept,
        ),
        payment_phrases=detected_payments,
        gemini_choice=gemini_choice_str,
        code_decision=code_decision,
    )

    result = DeskResult(
        answer=answer,
        message=final_message,
        request_id=target_request_id,
        hospital_name=matched_hospital.name if matched_hospital else None,
        trace=trace,
        footer="Nobody may charge you for a donor.",
        demo_confirm_token=demo_confirm_token,
    )

    # Step i: Discard raw source text, image, and transcript! Save extracted fields only to pastes/{fingerprint}
    paste_doc: dict[str, Any] = {
        "fingerprint": fingerprint,
        "hospitalId": matched_hospital.id if matched_hospital else None,
        "hospitalName": matched_hospital.name if matched_hospital else None,
        "patientRefMasked": mask_patient_ref(patient_val),
        "bloodGroup": norm_bg.value if norm_bg else None,
        "component": norm_comp.value,
        "units": units_val,
        "answer": answer.value,
        "message": final_message,
        "requestId": target_request_id,
        "geminiChoice": gemini_choice_str,
        "demoConfirmToken": demo_confirm_token,
        "createdAt": now_iso,
        "expiresAt": (current_time + timedelta(days=30)).isoformat(),
    }
    await s.save_paste(fingerprint, paste_doc)

    return result


async def check_desk_pipeline(
    text: str,
    client_ip: str = "127.0.0.1",
    store: Store | None = None,
    settings: Settings | None = None,
    now: datetime | None = None,
) -> DeskResult:
    """Executes the Request Desk verification pipeline for pasted text."""
    s = store or get_store()

    # Step a: Input length cap & IP rate limiting
    if len(text) > 2000:
        raise HTTPException(
            status_code=400,
            detail="Message exceeds 2,000 character limit.",
        )
    await check_ip_rate_limit(client_ip)

    # Step b: One Gemini call with registered hospital list
    hospitals = await s.list_hospitals()
    extractor = get_gemini_extractor()
    try:
        extraction: GeminiExtraction = await extractor.extract(text, hospitals)
    except AIUnavailable as exc:
        logger.warning("Gemini unavailable: %s", exc)
        return DeskResult(
            answer=DeskAnswer.NOT_VERIFIED,
            message="Couldn't check right now. Please call the hospital.",
            trace=DeskTrace(
                input_type="text",
                gemini_choice="AI service unavailable.",
                code_decision="NOT_VERIFIED: Gemini unavailable; safe fallback applied.",
            ),
            footer="Nobody may charge you for a donor.",
        )

    return await _evaluate_desk_source(
        source_text=text,
        extraction=extraction,
        hospitals=hospitals,
        input_type="text",
        transcript=None,
        store=s,
        settings=settings,
        now=now,
    )


async def check_desk_image_pipeline(
    image_bytes: bytes,
    caption: str = "",
    client_ip: str = "127.0.0.1",
    store: Store | None = None,
    settings: Settings | None = None,
    now: datetime | None = None,
) -> DeskResult:
    """Executes the Request Desk verification pipeline for photo uploads."""
    s = store or get_store()

    # Step a: Input length cap on caption & sanitize image
    if len(caption) > 2000:
        raise HTTPException(
            status_code=400,
            detail="Caption exceeds 2,000 character limit.",
        )
    sanitized_bytes = validate_and_sanitize_image(image_bytes)

    # Step b: Same IP rate limit bucket as text checks
    await check_ip_rate_limit(client_ip)

    # Step c: One Gemini multimodal call with registered hospital list
    hospitals = await s.list_hospitals()
    extractor = get_gemini_extractor()
    try:
        extraction: GeminiImageExtraction = await extractor.extract_from_image(
            image_bytes=sanitized_bytes,
            caption=caption,
            hospitals=hospitals,
        )
    except AIUnavailable as exc:
        logger.warning("Gemini unavailable: %s", exc)
        return DeskResult(
            answer=DeskAnswer.NOT_VERIFIED,
            message=f"Couldn't check right now. Please call the hospital. {IMAGE_DISCLAIMER}",
            trace=DeskTrace(
                input_type="image",
                gemini_choice="AI service unavailable.",
                code_decision="NOT_VERIFIED: Gemini unavailable; safe fallback applied.",
            ),
            footer="Nobody may charge you for a donor.",
        )

    # Step d: If image_kind is NO_REQUEST_TEXT or empty transcript -> NOT_VERIFIED
    if extraction.image_kind == "NO_REQUEST_TEXT" or not extraction.transcript.strip():
        return DeskResult(
            answer=DeskAnswer.NOT_VERIFIED,
            message=(
                f"We couldn't read a blood request in this photo. Please call the hospital. "
                f"{IMAGE_DISCLAIMER}"
            ),
            trace=DeskTrace(
                input_type="image",
                transcript=extraction.transcript,
                gemini_choice="No readable blood request found in uploaded photo.",
                code_decision="NOT_VERIFIED: Image kind was NO_REQUEST_TEXT or transcript was empty.",
            ),
            footer="Nobody may charge you for a donor.",
        )

    # Step e: Source text is transcript + "\n" + caption
    source_text = (
        f"{extraction.transcript}\n{caption}".strip() if caption.strip() else extraction.transcript
    )

    return await _evaluate_desk_source(
        source_text=source_text,
        extraction=extraction,
        hospitals=hospitals,
        input_type="image",
        transcript=extraction.transcript,
        store=s,
        settings=settings,
        now=now,
    )
