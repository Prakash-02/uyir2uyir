"""Donor onboarding router with purpose-specific consent and encrypted phone vault."""

import uuid

from fastapi import APIRouter, HTTPException, status
from pydantic import Field

from app.clock.service import get_clock
from app.core.config import get_settings
from app.core.entities import Donor
from app.core.models import CamelModel
from app.core.phone_vault import store_donor_contact, validate_indian_mobile
from app.core.store import get_store
from app.requests.models import BloodGroup, Lang

router = APIRouter(prefix="/donors", tags=["Donors"])


class DonorSignupInput(CamelModel):
    name: str = Field(min_length=1)
    phone: str
    blood_group: BloodGroup
    area: str = Field(min_length=1)
    lang: Lang = Lang.EN
    last_donation: str | None = None
    consent_urgent: bool
    consent_history: bool = True
    adult: bool


class DonorSignupResponse(CamelModel):
    donor_alias: str


@router.post("/signup", response_model=DonorSignupResponse, status_code=status.HTTP_201_CREATED)
async def signup_donor(payload: DonorSignupInput) -> DonorSignupResponse:
    """Public donor onboarding with purpose-specific consent and encrypted phone vault."""
    # 1. Require consent_urgent=True and adult=True
    if not payload.consent_urgent or not payload.adult:
        # Strictly no echoing of input values in 422 error
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Explicit consent for urgent contact and 18+ adult attestation are mandatory.",
        )

    # 2. Validate Indian mobile format
    try:
        normalized_phone = validate_indian_mobile(payload.phone)
    except ValueError:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Invalid Indian mobile number format.",
        ) from None

    settings = get_settings()
    store = get_store()
    clock = get_clock()
    now_iso = clock.now_iso()

    # 3. Generate donor id and alias
    existing_donors = await store.list_donors()
    donor_num = len(existing_donors) + 1
    donor_id = f"donor-d{donor_num}"
    donor_alias = f"Donor D{donor_num}"

    # 4. Save contact to phone vault (encrypts with AES-256-GCM, stores HMAC hash and last 4)
    contact_info = await store_donor_contact(store, donor_id, normalized_phone)

    # 5. Create Donor entity (in demo, mark is_simulated=True)
    is_simulated = settings.DATA_MODE == "demo"
    donor = Donor(
        id=donor_id,
        alias=donor_alias,
        blood_group=payload.blood_group,
        lang=payload.lang,
        area=payload.area,
        city="Chennai",
        distance_km=0.0,
        phone_hash=contact_info["phoneHash"],
        phone_masked=contact_info["phoneMasked"],
        consent_urgent=True,
        consent_history=payload.consent_history,
        adult=True,
        active=True,
        last_donation_date=payload.last_donation,
        is_simulated=is_simulated,
        data_mode=settings.DATA_MODE,
    )
    await store.save_donor(donor)

    # 6. Append two consent events to consents/{donorId}/events
    # Purpose 1: urgent_contact
    urgent_consent_event = {
        "id": f"c-evt-{uuid.uuid4().hex[:8]}",
        "donorId": donor_id,
        "purpose": "urgent_contact",
        "granted": True,
        "noticeVersion": "v1",
        "language": payload.lang.value,
        "channel": "web",
        "at": now_iso,
    }
    await store.append_consent_event(donor_id, urgent_consent_event)

    # Purpose 2: donation_history
    history_consent_event = {
        "id": f"c-evt-{uuid.uuid4().hex[:8]}",
        "donorId": donor_id,
        "purpose": "donation_history",
        "granted": payload.consent_history,
        "noticeVersion": "v1",
        "language": payload.lang.value,
        "channel": "web",
        "at": now_iso,
    }
    await store.append_consent_event(donor_id, history_consent_event)

    return DonorSignupResponse(donor_alias=donor_alias)
