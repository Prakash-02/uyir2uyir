"""Manual smoke test script for Request Desk Gemini extraction.

Run after setting GEMINI_MODEL:
    cd backend
    export GEMINI_MODEL="gemini-2.0-flash"  # or gemini-1.5-flash
    export GOOGLE_CLOUD_PROJECT="your-project-id"
    export VERTEX_LOCATION="asia-south1"   # or us-central1 if 2.0-flash not in asia-south1
    python scripts/desk_smoke.py

On Windows PowerShell:
    cd backend
    $env:GEMINI_MODEL="gemini-2.0-flash"
    $env:GOOGLE_CLOUD_PROJECT="your-project-id"
    $env:VERTEX_LOCATION="asia-south1"
    .\.venv\Scripts\python.exe scripts/desk_smoke.py
"""

import asyncio
import os
import sys

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Ensure backend root is on sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

os.environ.setdefault("DATA_MODE", "demo")
os.environ.setdefault("STORE", "memory")
os.environ.setdefault("GEMINI_MODEL", "gemini-2.5-flash")
os.environ.setdefault("GOOGLE_CLOUD_PROJECT", "uyir2uyir-53929")
os.environ.setdefault("VERTEX_LOCATION", "asia-south1")

from app.core.config import get_settings
from app.core.store import get_store
from app.desk.pipeline import check_desk_pipeline
from scripts.seed import seed

SAMPLE_MESSAGES = [
    (
        "Sample 1: Emergency Blood Request (English)",
        "URGENT: Patient IP-101 at Sample General Hospital, Chennai needs 2 units of O+ RED_CELLS immediately for emergency surgery. Contact hospital blood bank.",
    ),
    (
        "Sample 2: Tamil Message for Metropolitan Care Hospital",
        "அவசர இரத்தத் தேவை: Metropolitan Care Hospital, Chennai-ல் அனுமதிக்கப்பட்டுள்ள நோயாளிக்கு அவசரமாக 2 units B+ இரத்தம் தேவைப்படுகிறது.",
    ),
    (
        "Sample 3: Commercial Solicitation / Payment Scam",
        "Urgent blood donor needed at Sample General Hospital, Chennai. Donor will be paid 3000 rupees conveyance charge in cash. Contact immediately.",
    ),
]


async def run_smoke():
    settings = get_settings()
    store = get_store()

    print("=" * 70)
    print("U2U REQUEST DESK — GEMINI VERTEX AI SMOKE TEST")
    print(f"Project:  {settings.GOOGLE_CLOUD_PROJECT or '(none / ADC)'}")
    print(f"Location: {settings.VERTEX_LOCATION}")
    print(f"Model:    {settings.GEMINI_MODEL}")
    print("=" * 70)

    # 1. Seed database with test hospitals
    print("\n[*] Seeding in-memory store with hospital fixtures...")
    await seed()

    # 2. Test the 3 sample messages
    for title, text in SAMPLE_MESSAGES:
        print("\n" + "-" * 70)
        print(f"[*] Testing: {title}")
        print(f"    Message: {text}")
        try:
            result = await check_desk_pipeline(text, client_ip="127.0.0.1", store=store)
            print(f"\n    [RESULT ANSWER]: {result.answer.value}")
            print(f"    [MESSAGE]:       {result.message}")
            print(f"    [HOSPITAL]:      {result.hospital_name}")
            print(f"    [REQUEST ID]:    {result.request_id}")
            print(f"    [FOOTER]:        {result.footer}")
            print(f"    [GEMINI CHOICE]: {result.trace.gemini_choice}")
            print(f"    [CODE DECISION]: {result.trace.code_decision}")
            print("    [TRACE FIELDS]:")
            print(
                f"      - Hospital:       kept={result.trace.hospital.kept}, value={result.trace.hospital.value}, quote={result.trace.hospital.quote!r}"
            )
            print(
                f"      - Patient Ref:    kept={result.trace.patient_number.kept}, value={result.trace.patient_number.value}, quote={result.trace.patient_number.quote!r}"
            )
            print(
                f"      - Blood Group:    kept={result.trace.blood_group.kept}, value={result.trace.blood_group.value}, quote={result.trace.blood_group.quote!r}"
            )
            print(
                f"      - Component:      kept={result.trace.component.kept}, value={result.trace.component.value}, quote={result.trace.component.quote!r}"
            )
            print(
                f"      - Units:          kept={result.trace.units.kept}, value={result.trace.units.value}, quote={result.trace.units.quote!r}"
            )
            print(f"      - Payment Words:  {result.trace.payment_phrases}")
        except Exception as exc:
            print(f"\n    [ERROR]: Extraction failed with {type(exc).__name__}: {exc}")

    print("\n" + "=" * 70)
    print("Smoke test completed.")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(run_smoke())
