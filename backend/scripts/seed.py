"""Database seed script for U2U (Uyir2Uyir) simulated demo data.

Seeds:
- 3 fictional Chennai hospitals
- 2 blood centres
- 30 donors (Donor A1..Donor C10) with mixed blood groups and distances
- Initial config document (config/app)

Strict Safety: Refuses to run when DATA_MODE=live.
"""

import asyncio
import hashlib
import os
import sys

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("GEMINI_MODEL", "gemini-2.0-flash")

from app.auth.constants import DEMO_STORY_CENTRE_ID, DEMO_STORY_HOSPITAL_ID
from app.core.config import get_settings
from app.core.entities import Centre, Donor, Hospital
from app.core.store import get_store
from app.requests.models import BloodGroup, Lang

HOSPITALS_FIXTURE = [
    {
        "id": DEMO_STORY_HOSPITAL_ID,
        "name": "Sample General Hospital, Chennai",
        "aliases": ["Sample General Hospital", "SGH"],
        "area": "Adyar",
        "city": "Chennai",
        "centreId": DEMO_STORY_CENTRE_ID,
    },
    {
        "id": "hosp-sample-2",
        "name": "Metropolitan Care Hospital, Chennai",
        "aliases": ["Metropolitan Care Hospital", "MCH"],
        "area": "Anna Nagar",
        "city": "Chennai",
        "centreId": "centre-sample-2",
    },
    {
        "id": "hosp-sample-3",
        "name": "Coastal District Hospital, Chennai",
        "aliases": [
            "Coastal District Hospital",
            "CDH",
            "கோஸ்டல் டிஸ்ட்ரிக்ட் ஹாஸ்பிடல் சென்னை",
        ],
        "area": "Mylapore",
        "city": "Chennai",
        "centreId": DEMO_STORY_CENTRE_ID,
    },
]

CENTRES_FIXTURE = [
    {
        "id": DEMO_STORY_CENTRE_ID,
        "name": "Central Blood Bank, Egmore (Simulated)",
        "area": "Egmore",
        "city": "Chennai",
    },
    {
        "id": "centre-sample-2",
        "name": "Community Transfusion Centre (Simulated)",
        "area": "T. Nagar",
        "city": "Chennai",
    },
]

# 30 Simulated Donors with aliases Donor A1..Donor C10 (matching frontend/src/api/mock/fixtures.ts)
DONORS_FIXTURE = [
    # Round 1 (A1 - A10)
    {
        "id": "donor-a1",
        "alias": "Donor A1",
        "bloodGroup": "O+",
        "distanceKm": 1.2,
        "lang": "en",
        "area": "Adyar",
    },
    {
        "id": "donor-a2",
        "alias": "Donor A2",
        "bloodGroup": "O+",
        "distanceKm": 1.8,
        "lang": "ta",
        "area": "Besant Nagar",
    },
    {
        "id": "donor-a3",
        "alias": "Donor A3",
        "bloodGroup": "O+",
        "distanceKm": 2.4,
        "lang": "en",
        "area": "Thiruvanmiyur",
    },
    {
        "id": "donor-a4",
        "alias": "Donor A4",
        "bloodGroup": "O+",
        "distanceKm": 3.1,
        "lang": "ta",
        "area": "Kotturpuram",
    },
    {
        "id": "donor-a5",
        "alias": "Donor A5",
        "bloodGroup": "O+",
        "distanceKm": 3.5,
        "lang": "en",
        "area": "R.A. Puram",
    },
    {
        "id": "donor-a6",
        "alias": "Donor A6",
        "bloodGroup": "A+",
        "distanceKm": 4.2,
        "lang": "ta",
        "area": "Guindy",
    },
    {
        "id": "donor-a7",
        "alias": "Donor A7",
        "bloodGroup": "O+",
        "distanceKm": 2.1,
        "lang": "en",
        "area": "Adyar",
    },
    {
        "id": "donor-a8",
        "alias": "Donor A8",
        "bloodGroup": "B+",
        "distanceKm": 4.9,
        "lang": "ta",
        "area": "Saidapet",
    },
    {
        "id": "donor-a9",
        "alias": "Donor A9",
        "bloodGroup": "AB+",
        "distanceKm": 5.5,
        "lang": "en",
        "area": "Velachery",
    },
    {
        "id": "donor-a10",
        "alias": "Donor A10",
        "bloodGroup": "O-",
        "distanceKm": 6.0,
        "lang": "ta",
        "area": "Teynampet",
    },
    # Round 2 (B1 - B10)
    {
        "id": "donor-b1",
        "alias": "Donor B1",
        "bloodGroup": "O+",
        "distanceKm": 4.5,
        "lang": "en",
        "area": "Mylapore",
    },
    {
        "id": "donor-b2",
        "alias": "Donor B2",
        "bloodGroup": "O+",
        "distanceKm": 5.0,
        "lang": "ta",
        "area": "Alwarpet",
    },
    {
        "id": "donor-b3",
        "alias": "Donor B3",
        "bloodGroup": "O+",
        "distanceKm": 5.2,
        "lang": "en",
        "area": "Mandaveli",
    },
    {
        "id": "donor-b4",
        "alias": "Donor B4",
        "bloodGroup": "O+",
        "distanceKm": 5.8,
        "lang": "ta",
        "area": "Nandanam",
    },
    {
        "id": "donor-b5",
        "alias": "Donor B5",
        "bloodGroup": "O+",
        "distanceKm": 6.3,
        "lang": "en",
        "area": "T. Nagar",
    },
    {
        "id": "donor-b6",
        "alias": "Donor B6",
        "bloodGroup": "B+",
        "distanceKm": 6.8,
        "lang": "ta",
        "area": "Kodambakkam",
    },
    {
        "id": "donor-b7",
        "alias": "Donor B7",
        "bloodGroup": "A+",
        "distanceKm": 7.2,
        "lang": "en",
        "area": "Ashok Nagar",
    },
    {
        "id": "donor-b8",
        "alias": "Donor B8",
        "bloodGroup": "A-",
        "distanceKm": 7.9,
        "lang": "ta",
        "area": "Vadapalani",
    },
    {
        "id": "donor-b9",
        "alias": "Donor B9",
        "bloodGroup": "B-",
        "distanceKm": 8.3,
        "lang": "en",
        "area": "Nungambakkam",
    },
    {
        "id": "donor-b10",
        "alias": "Donor B10",
        "bloodGroup": "O+",
        "distanceKm": 8.7,
        "lang": "ta",
        "area": "Chetpet",
    },
    # Round 3 (C1 - C10)
    {
        "id": "donor-c1",
        "alias": "Donor C1",
        "bloodGroup": "O+",
        "distanceKm": 8.0,
        "lang": "en",
        "area": "Egmore",
    },
    {
        "id": "donor-c2",
        "alias": "Donor C2",
        "bloodGroup": "O+",
        "distanceKm": 8.5,
        "lang": "ta",
        "area": "Kilpauk",
    },
    {
        "id": "donor-c3",
        "alias": "Donor C3",
        "bloodGroup": "O+",
        "distanceKm": 9.1,
        "lang": "en",
        "area": "Anna Nagar",
    },
    {
        "id": "donor-c4",
        "alias": "Donor C4",
        "bloodGroup": "O+",
        "distanceKm": 9.5,
        "lang": "ta",
        "area": "Shenoy Nagar",
    },
    {
        "id": "donor-c5",
        "alias": "Donor C5",
        "bloodGroup": "O+",
        "distanceKm": 10.1,
        "lang": "en",
        "area": "Aminjikarai",
    },
    {
        "id": "donor-c6",
        "alias": "Donor C6",
        "bloodGroup": "AB-",
        "distanceKm": 10.6,
        "lang": "ta",
        "area": "Purasawalkam",
    },
    {
        "id": "donor-c7",
        "alias": "Donor C7",
        "bloodGroup": "B+",
        "distanceKm": 11.0,
        "lang": "en",
        "area": "Perambur",
    },
    {
        "id": "donor-c8",
        "alias": "Donor C8",
        "bloodGroup": "A+",
        "distanceKm": 11.4,
        "lang": "ta",
        "area": "Ayanavaram",
    },
    {
        "id": "donor-c9",
        "alias": "Donor C9",
        "bloodGroup": "O-",
        "distanceKm": 11.8,
        "lang": "en",
        "area": "Villivakkam",
    },
    {
        "id": "donor-c10",
        "alias": "Donor C10",
        "bloodGroup": "O+",
        "distanceKm": 12.0,
        "lang": "ta",
        "area": "Kolathur",
    },
]


async def seed() -> None:
    settings = get_settings()

    # Strict Safety Guard: Never seed against live operational database
    if settings.DATA_MODE == "live" or os.environ.get("DATA_MODE") == "live":
        sys.stderr.write("FATAL ERROR: Seed script strictly refuses to run when DATA_MODE=live.\n")
        sys.exit(1)

    print(
        f"[*] Starting U2U database seed [DATA_MODE={settings.DATA_MODE}, STORE={settings.STORE}]..."
    )
    store = get_store()

    # 1. Seed Hospitals
    for h_data in HOSPITALS_FIXTURE:
        hospital = Hospital(
            id=h_data["id"],
            name=h_data["name"],
            centre_id=h_data["centreId"],
            area=h_data["area"],
            city=h_data["city"],
            active=True,
            is_simulated=True,
            data_mode=settings.DATA_MODE,
        )
        await store.save_hospital(hospital)
        print(f"  + Hospital: {hospital.name} ({hospital.id})")

    # 2. Seed Centres
    for c_data in CENTRES_FIXTURE:
        centre = Centre(
            id=c_data["id"],
            name=c_data["name"],
            area=c_data["area"],
            city=c_data["city"],
            active=True,
            is_simulated=True,
            data_mode=settings.DATA_MODE,
        )
        await store.save_centre(centre)
        print(f"  + Centre: {centre.name} ({centre.id})")

    # 3. Seed Donors
    from app.core.phone_vault import store_donor_contact

    verified_env = (
        os.environ.get("DEMO_VERIFIED_PHONES") or os.environ.get("VERIFIED_DONOR_PHONES") or ""
    )
    verified_phones = [p.strip() for p in verified_env.split(",") if p.strip()]

    for idx, d_data in enumerate(DONORS_FIXTURE, start=1):
        if idx <= len(verified_phones) and idx <= 3:
            real_phone = verified_phones[idx - 1]
            contact_res = await store_donor_contact(store, d_data["id"], real_phone)
            phone_hash = contact_res["phoneHash"]
            phone_masked = contact_res["phoneMasked"]
            print(
                f"    * Attached verified phone to {d_data['alias']} ({d_data['id']}): {phone_masked}"
            )
        else:
            phone_hash = hashlib.sha256(f"salt-sim-{d_data['id']}".encode()).hexdigest()
            phone_masked = f"+91 ••••• ••{idx:03d}"

        donor = Donor(
            id=d_data["id"],
            alias=d_data["alias"],
            blood_group=BloodGroup(d_data["bloodGroup"]),
            lang=Lang(d_data["lang"]),
            area=d_data["area"],
            city="Chennai",
            distance_km=d_data["distanceKm"],
            phone_hash=phone_hash,
            phone_masked=phone_masked,
            consent_urgent=True,
            consent_history=True,
            adult=True,
            active=True,
            last_donation_date=None,
            is_simulated=True,
            data_mode=settings.DATA_MODE,
        )
        await store.save_donor(donor)

    print(
        f"  + Seeded {len(DONORS_FIXTURE)} simulated donors ({DONORS_FIXTURE[0]['alias']}..{DONORS_FIXTURE[-1]['alias']})"
    )

    # 4. Seed config/app document
    await store.set_config(
        "app",
        {
            "dataMode": settings.DATA_MODE,
            "bannerText": "SIMULATED DATA · NOT FOR CLINICAL USE",
            "weatherAlert": False,
            "isSimulated": True,
        },
    )
    print("  + Config: config/app initialized")

    # 5. Initialize daily_calls config to 0
    await store.set_config(
        "daily_calls",
        {
            "count": 0,
            "date": "2026-10-15",
            "isSimulated": True,
            "dataMode": settings.DATA_MODE,
        },
    )
    print("  + Config: config/daily_calls initialized to 0")

    print("[OK] Database seed completed successfully.")


if __name__ == "__main__":
    asyncio.run(seed())
