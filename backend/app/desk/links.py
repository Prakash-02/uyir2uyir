import base64
import hashlib
import hmac
import logging
import secrets
from datetime import UTC, datetime, timedelta
from typing import Any

from fastapi import HTTPException

from app.core.config import Settings, get_settings
from app.core.store import Store, TransactionStore, get_store
from app.desk.models import ConfirmAction, RequestPreview
from app.outreach.service import dispatch_round_calls
from app.requests.models import BloodRequest, RequestStatus, TimelineEvent

logger = logging.getLogger("u2u.desk.links")

LINK_EXPIRY_HOURS = 6
HOURLY_HOSPITAL_CAP = 6
DAILY_HOSPITAL_CAP = 40


def mask_patient_ref(patient_ref: str | None) -> str:
    """Masks patient reference for privacy (e.g. 'IP-101' -> 'IP-••1')."""
    if not patient_ref:
        return "UNKNOWN"
    clean = patient_ref.strip()
    if len(clean) <= 3:
        return clean[0] + "••"
    if "-" in clean:
        prefix, rest = clean.split("-", 1)
        if len(rest) <= 2:
            return f"{prefix}-•{rest[-1]}"
        return f"{prefix}-••{rest[-2:]}"
    return f"{clean[:2]}••{clean[-2:]}"


def generate_confirm_token(request_id: str, hospital_id: str, signing_key: str) -> str:
    """Generates a cryptographically signed one-time token."""
    rand_part = secrets.token_hex(16)
    raw = f"{request_id}:{hospital_id}:{rand_part}"
    sig = hmac.new(signing_key.encode("utf-8"), raw.encode("utf-8"), hashlib.sha256).hexdigest()[
        :24
    ]
    payload = f"{raw}:{sig}"
    return base64.urlsafe_b64encode(payload.encode("utf-8")).decode("utf-8")


def verify_confirm_token_signature(token_str: str, signing_key: str) -> bool:
    """Verifies HMAC signature of a confirm link token."""
    try:
        decoded = base64.urlsafe_b64decode(token_str.encode("utf-8")).decode("utf-8")
        parts = decoded.split(":")
        if len(parts) != 4:
            return False
        request_id, hospital_id, rand_part, sig = parts
        raw = f"{request_id}:{hospital_id}:{rand_part}"
        expected = hmac.new(
            signing_key.encode("utf-8"), raw.encode("utf-8"), hashlib.sha256
        ).hexdigest()[:24]
        return hmac.compare_digest(sig, expected)
    except Exception:
        return False


def hash_token(token_str: str) -> str:
    """Returns SHA-256 hex digest of the raw token."""
    return hashlib.sha256(token_str.encode("utf-8")).hexdigest()


async def check_hospital_link_caps(
    hospital_id: str, store: Store, now: datetime | None = None
) -> bool:
    """Returns True if within hourly and daily limits, False if capped."""
    current_time = now or datetime.now(UTC)
    one_hour_ago = (current_time - timedelta(hours=1)).isoformat()
    one_day_ago = (current_time - timedelta(hours=24)).isoformat()

    links = await store.list_confirm_links_by_hospital(hospital_id)
    hourly_count = sum(1 for lnk in links if lnk.get("createdAt", "") >= one_hour_ago)
    daily_count = sum(1 for lnk in links if lnk.get("createdAt", "") >= one_day_ago)

    if hourly_count >= HOURLY_HOSPITAL_CAP:
        logger.warning(
            "Hourly confirm link cap reached for hospital %s: %d/%d",
            hospital_id,
            hourly_count,
            HOURLY_HOSPITAL_CAP,
        )
        return False
    if daily_count >= DAILY_HOSPITAL_CAP:
        logger.warning(
            "Daily confirm link cap reached for hospital %s: %d/%d",
            hospital_id,
            daily_count,
            DAILY_HOSPITAL_CAP,
        )
        return False
    return True


async def create_and_store_confirm_link(
    request_id: str,
    hospital_id: str,
    store: Store,
    settings: Settings,
    now: datetime | None = None,
) -> str | None:
    """Generates, signs, and stores a single-use confirm token if within caps."""
    current_time = now or datetime.now(UTC)
    within_caps = await check_hospital_link_caps(hospital_id, store, current_time)
    if not within_caps:
        return None

    raw_token = generate_confirm_token(request_id, hospital_id, settings.LINK_SIGNING_KEY)
    token_h = hash_token(raw_token)
    expires_at = (current_time + timedelta(hours=LINK_EXPIRY_HOURS)).isoformat()

    link_doc: dict[str, Any] = {
        "tokenHash": token_h,
        "requestId": request_id,
        "hospitalId": hospital_id,
        "createdAt": current_time.isoformat(),
        "expiresAt": expires_at,
        "used": False,
        "action": None,
        "usedAt": None,
    }
    await store.save_confirm_link(token_h, link_doc)
    return raw_token


async def get_confirm_link_preview(
    token_str: str,
    store: Store | None = None,
    settings: Settings | None = None,
    now: datetime | None = None,
) -> RequestPreview:
    """Retrieves RequestPreview for a valid, non-expired, single-use token."""
    s = store or get_store()
    cfg = settings or get_settings()
    current_time = now or datetime.now(UTC)

    if not verify_confirm_token_signature(token_str, cfg.LINK_SIGNING_KEY):
        raise HTTPException(status_code=400, detail="Invalid token signature")

    token_h = hash_token(token_str)
    link_doc = await s.get_confirm_link(token_h)
    if not link_doc:
        raise HTTPException(status_code=404, detail="Confirmation link not found")

    if link_doc.get("used"):
        raise HTTPException(status_code=400, detail="This confirmation link has already been used")

    expires_at_str = link_doc.get("expiresAt", "")
    if expires_at_str and current_time.isoformat() > expires_at_str:
        raise HTTPException(status_code=400, detail="This confirmation link has expired")

    request_id = link_doc.get("requestId")
    if not request_id:
        raise HTTPException(status_code=404, detail="Associated request not found")

    req = await s.get_request(request_id)
    if not req:
        raise HTTPException(status_code=404, detail="Request document not found")

    return RequestPreview(
        hospital_name=req.hospital_name,
        blood_group=req.blood_group,
        component=req.component,
        units_needed=req.units_needed,
        patient_ref_masked=mask_patient_ref(req.patient_ref),
        expires_at=expires_at_str,
    )


async def execute_confirm_action(
    token_str: str,
    action: ConfirmAction,
    store: Store | None = None,
    settings: Settings | None = None,
    now: datetime | None = None,
) -> BloodRequest:
    """Processes confirmation action (RAISE or NOT_OUR_PATIENT) transactionally."""
    s = store or get_store()
    cfg = settings or get_settings()
    current_time = now or datetime.now(UTC)

    if not verify_confirm_token_signature(token_str, cfg.LINK_SIGNING_KEY):
        raise HTTPException(status_code=400, detail="Invalid token signature")

    token_h = hash_token(token_str)

    async def _tx_confirm(tx: TransactionStore) -> tuple[BloodRequest, bool]:
        link_doc = await tx.get_confirm_link(token_h)
        if not link_doc:
            raise HTTPException(status_code=404, detail="Confirmation link not found")

        if link_doc.get("used"):
            raise HTTPException(
                status_code=400, detail="This confirmation link has already been used"
            )

        expires_at_str = link_doc.get("expiresAt", "")
        if expires_at_str and current_time.isoformat() > expires_at_str:
            raise HTTPException(status_code=400, detail="This confirmation link has expired")

        request_id = link_doc.get("requestId")
        if not request_id:
            raise HTTPException(status_code=404, detail="Request ID missing in link")

        req = await tx.get_request(request_id)
        if not req:
            raise HTTPException(status_code=404, detail="Request not found")

        if req.status != RequestStatus.AWAITING_HOSPITAL:
            raise HTTPException(
                status_code=400,
                detail=f"Cannot confirm request in status {req.status}",
            )

        # Mark link as used
        link_doc["used"] = True
        link_doc["action"] = action.value
        link_doc["usedAt"] = current_time.isoformat()
        await tx.save_confirm_link(token_h, link_doc)

        should_dispatch = False
        if action == ConfirmAction.RAISE:
            req.status = RequestStatus.OPEN
            req.updated_at = current_time.isoformat()
            await tx.save_request(req)
            event = TimelineEvent(
                id=f"evt_{secrets.token_hex(6)}",
                request_id=req.id,
                at=current_time.isoformat(),
                kind="REQUEST_CONFIRMED",
                text="Hospital confirmed urgent request via secure confirmation link.",
            )
            await tx.append_event(req.id, event)
            should_dispatch = True
        else:
            req.status = RequestStatus.REJECTED
            req.updated_at = current_time.isoformat()
            await tx.save_request(req)
            event = TimelineEvent(
                id=f"evt_{secrets.token_hex(6)}",
                request_id=req.id,
                at=current_time.isoformat(),
                kind="REQUEST_REJECTED",
                text='Hospital marked request as "Not our patient" (REJECTED).',
            )
            await tx.append_event(req.id, event)

        return req, should_dispatch

    req, should_dispatch = await s.run_transaction(_tx_confirm)

    if should_dispatch:
        try:
            from app.matching.service import select_donors_for_request
            from app.outreach.adapter import SimulatorAdapter

            donors = await select_donors_for_request(s, req, limit=5)
            adapter = SimulatorAdapter(s)
            await dispatch_round_calls(s, req, donors, adapter)
        except Exception as exc:
            logger.error("Failed to dispatch round 1 calls after confirmation: %s", exc)

    return req
