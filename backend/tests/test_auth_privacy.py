"""Tests for authentication roles, demo role claims, donor signup, consent ledger, phone vault, and audit."""

import json
import re
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.clock.service import SimulationClock
from app.core.audit import record_audit
from app.core.config import Settings
from app.core.phone_vault import decrypt_phone, encrypt_phone, validate_indian_mobile
from app.core.store_memory import MemoryStore
from app.main import create_app
from app.requests.models import BloodGroup
from scripts.seed import seed

# Regex to detect full 10-digit Indian mobile numbers (+91 optional) or any raw 10-digit phone
FULL_PHONE_REGEX = re.compile(r"(?:\+91[\s-]?)?[6-9]\d{9}|\b\d{10}\b")


@pytest.fixture(autouse=True)
async def reset_store_and_clock():
    """Resets memory store and seeds fixtures before each test."""
    from app.core.config import set_settings

    set_settings(
        Settings(
            DATA_MODE="demo",
            FIRESTORE_DB="u2u-demo",
            GEMINI_MODEL="gemini-2.0-flash",
            ALLOW_TEST_HEADER_AUTH=False,
        )
    )
    store = MemoryStore.get_instance()
    store.reset()
    SimulationClock.reset_instance(
        base_time=datetime(2026, 10, 15, 9, 0, 0, tzinfo=UTC),
        offset_seconds=0.0,
    )
    await seed()


@pytest.fixture
def demo_client() -> TestClient:
    settings = Settings(
        DATA_MODE="demo",
        FIRESTORE_DB="u2u-demo",
        GEMINI_MODEL="gemini-2.0-flash",
        INTERNAL_TOKEN="test-internal-token",
        ALLOW_TEST_HEADER_AUTH=False,
    )
    app = create_app(settings=settings)
    return TestClient(app)


@pytest.fixture
def live_client() -> TestClient:
    settings = Settings(
        DATA_MODE="live",
        FIRESTORE_DB="u2u-live",
        GEMINI_MODEL="gemini-2.0-flash",
        INTERNAL_TOKEN="test-internal-token",
        ALLOW_TEST_HEADER_AUTH=False,
    )
    app = create_app(settings=settings)
    return TestClient(app)


def make_mock_token(claims: dict) -> str:
    """Helper creating a mock token for offline unit testing."""
    return f"mock:{json.dumps(claims)}"


# =========================================================================
# 1. AUTH & ENV CLAIMS
# =========================================================================


def test_wrong_env_claim_gives_403(demo_client: TestClient):
    """Token with claim env='live' when server DATA_MODE='demo' must return 403."""
    token = make_mock_token(
        {
            "uid": "hospital-user-1",
            "role": "hospital",
            "hospitalId": "hosp-sample-1",
            "env": "live",  # Mismatch with server DATA_MODE=demo
        }
    )
    resp = demo_client.post(
        "/requests",
        json={
            "bloodGroup": "O+",
            "component": "WHOLE_BLOOD",
            "unitsNeeded": 2,
        },
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 403
    assert "Environment mismatch" in resp.json()["detail"]


def test_demo_role_endpoint_sets_claims(demo_client: TestClient):
    """POST /auth/demo-role sets custom claims with fixed demo story IDs."""
    token = make_mock_token({"uid": "anon-judge-1"})
    resp = demo_client.post(
        "/auth/demo-role",
        json={"role": "hospital"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["ok"] is True
    assert data["claims"]["role"] == "hospital"
    assert data["claims"]["env"] == "demo"
    assert data["claims"]["hospitalId"] == "hosp-sample-1"
    assert data["claims"]["centreId"] is None


def test_demo_role_endpoint_returns_404_in_live(live_client: TestClient):
    """POST /auth/demo-role returns 404 in live data mode."""
    token = make_mock_token({"uid": "user-1"})
    resp = live_client.post(
        "/auth/demo-role",
        json={"role": "hospital"},
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 404


def test_x_demo_role_rejected_when_flag_off(demo_client: TestClient):
    """X-Demo-Role is rejected with 403 when ALLOW_TEST_HEADER_AUTH is False."""
    resp = demo_client.post(
        "/requests",
        json={
            "bloodGroup": "O+",
            "component": "WHOLE_BLOOD",
            "unitsNeeded": 2,
        },
        headers={"X-Demo-Role": "hospital"},
    )
    assert resp.status_code == 403


# =========================================================================
# 2. ROLE ISOLATION (HOSPITAL & STAFF)
# =========================================================================


def test_hospital_cannot_read_another_hospitals_request(demo_client: TestClient):
    """A hospital user cannot read a request belonging to another hospital."""
    hosp1_token = make_mock_token(
        {
            "uid": "hosp1-actor",
            "role": "hospital",
            "hospitalId": "hosp-sample-1",
            "env": "demo",
        }
    )
    hosp2_token = make_mock_token(
        {
            "uid": "hosp2-actor",
            "role": "hospital",
            "hospitalId": "hosp-sample-2",
            "env": "demo",
        }
    )

    # Hospital 1 creates a request
    create_resp = demo_client.post(
        "/requests",
        json={
            "bloodGroup": "O+",
            "component": "WHOLE_BLOOD",
            "unitsNeeded": 2,
            "patientRef": "IP-PRIVATE-99",
        },
        headers={"Authorization": f"Bearer {hosp1_token}"},
    )
    assert create_resp.status_code == 201
    req_id = create_resp.json()["id"]

    # Hospital 1 can read its own request
    hosp1_read = demo_client.get(
        f"/requests/{req_id}",
        headers={"Authorization": f"Bearer {hosp1_token}"},
    )
    assert hosp1_read.status_code == 200
    assert hosp1_read.json()["patientRef"] == "IP-PRIVATE-99"

    # Hospital 2 cannot read Hospital 1's request -> 403 Forbidden
    hosp2_read = demo_client.get(
        f"/requests/{req_id}",
        headers={"Authorization": f"Bearer {hosp2_token}"},
    )
    assert hosp2_read.status_code == 403
    assert "Forbidden" in hosp2_read.json()["detail"]

    # Hospital 2 cannot cancel Hospital 1's request -> 403 Forbidden
    hosp2_cancel = demo_client.post(
        f"/requests/{req_id}/cancel",
        headers={"Authorization": f"Bearer {hosp2_token}"},
    )
    assert hosp2_cancel.status_code == 403


def test_staff_cannot_act_on_another_centres_call(demo_client: TestClient):
    """Blood centre staff can only accept or defer calls belonging to their centre."""
    hosp1_token = make_mock_token(
        {
            "uid": "hosp1-actor",
            "role": "hospital",
            "hospitalId": "hosp-sample-1",  # centreId is centre-sample-1
            "env": "demo",
        }
    )
    centre2_staff_token = make_mock_token(
        {
            "uid": "staff-c2",
            "role": "staff",
            "centreId": "centre-sample-2",  # Different centre
            "env": "demo",
        }
    )

    create_resp = demo_client.post(
        "/requests",
        json={
            "bloodGroup": "O+",
            "component": "WHOLE_BLOOD",
            "unitsNeeded": 2,
        },
        headers={"Authorization": f"Bearer {hosp1_token}"},
    )
    assert create_resp.status_code == 201
    req_id = create_resp.json()["id"]

    # Call ID format: f"{requestId}_{round}_{donorId}"
    call_id = f"{req_id}_1_donor-a5"

    # Staff from centre-sample-2 tries to accept call for centre-sample-1 -> 403
    resp = demo_client.post(
        f"/calls/{call_id}/accept",
        headers={"Authorization": f"Bearer {centre2_staff_token}"},
    )
    assert resp.status_code == 403
    assert "own centre" in resp.json()["detail"]


# =========================================================================
# 3. DONOR SIGNUP & CONSENT LEDGER
# =========================================================================


def test_signup_without_consent_gives_422_with_no_echo(demo_client: TestClient):
    """Signing up without mandatory urgent consent or adult=true returns 422 without echoing input."""
    raw_phone = "+919876543210"

    # Missing consentUrgent
    resp1 = demo_client.post(
        "/donors/signup",
        json={
            "name": "Jane Doe",
            "phone": raw_phone,
            "bloodGroup": "A+",
            "area": "Adyar",
            "consentUrgent": False,
            "consentHistory": True,
            "adult": True,
        },
    )
    assert resp1.status_code == 422
    # Verify response body does NOT echo the phone number or input
    resp_text_1 = resp1.text
    assert raw_phone not in resp_text_1
    assert "9876543210" not in resp_text_1

    # Missing adult attestation
    resp2 = demo_client.post(
        "/donors/signup",
        json={
            "name": "Jane Doe",
            "phone": raw_phone,
            "bloodGroup": "A+",
            "area": "Adyar",
            "consentUrgent": True,
            "consentHistory": True,
            "adult": False,
        },
    )
    assert resp2.status_code == 422
    resp_text_2 = resp2.text
    assert raw_phone not in resp_text_2
    assert "9876543210" not in resp_text_2


def test_donor_signup_records_vault_and_consent_ledger(demo_client: TestClient):
    """Valid signup records donor alias, encrypted phone in vault, and 2 consent events."""
    raw_phone = "+91 98401 23456"
    resp = demo_client.post(
        "/donors/signup",
        json={
            "name": "Test Donor",
            "phone": raw_phone,
            "bloodGroup": "B+",
            "area": "Besant Nagar",
            "lang": "ta",
            "consentUrgent": True,
            "consentHistory": True,
            "adult": True,
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert "donorAlias" in data
    donor_alias = data["donorAlias"]
    assert donor_alias.startswith("Donor D")

    # Full phone must NOT appear in response
    assert "9840123456" not in resp.text
    assert not FULL_PHONE_REGEX.search(resp.text)

    # Check database state
    store = MemoryStore.get_instance()
    donors = [d for d in store._donors.values() if d.alias == donor_alias]
    assert len(donors) == 1
    donor = donors[0]
    assert donor.is_simulated is True
    assert donor.blood_group == BloodGroup.B_POS
    assert donor.phone_masked == "+91 ••••• ••3456"

    # Vault inspection: donorContacts/{id}
    contact = store._donor_contacts.get(donor.id)
    assert contact is not None
    assert contact["last4"] == "3456"
    assert "encryptedPhone" in contact
    # Decrypt phone with vault key
    decrypted = decrypt_phone(contact["encryptedPhone"])
    assert decrypted == "+919840123456"

    # Consent ledger inspection: consents/{donorId}/events
    consent_events = store._consents.get(donor.id)
    assert consent_events is not None
    assert len(consent_events) == 2

    # Purpose 1: urgent_contact
    c1 = next(e for e in consent_events if e["purpose"] == "urgent_contact")
    assert c1["granted"] is True
    assert c1["noticeVersion"] == "v1"
    assert c1["language"] == "ta"
    assert c1["channel"] == "web"

    # Purpose 2: donation_history
    c2 = next(e for e in consent_events if e["purpose"] == "donation_history")
    assert c2["granted"] is True
    assert c2["noticeVersion"] == "v1"


# =========================================================================
# 4. PHONE VAULT (AES-GCM & HMAC HASH)
# =========================================================================


def test_phone_vault_encryption_and_hmac_hash():
    """Validates AES-256-GCM encryption, decryption, and blind HMAC hash."""
    phone = "+919876543210"
    encrypted_b64, phone_hash, last4 = encrypt_phone(phone)

    assert last4 == "3210"
    assert len(phone_hash) == 64  # SHA-256 hex digest length
    assert encrypted_b64 != phone

    # Decrypt
    decrypted = decrypt_phone(encrypted_b64)
    assert decrypted == phone

    # HMAC hash is deterministic for blind lookups
    _, phone_hash2, _ = encrypt_phone(phone)
    assert phone_hash == phone_hash2


def test_indian_mobile_normalization():
    """Tests various Indian mobile number formats."""
    assert validate_indian_mobile("9876543210") == "+919876543210"
    assert validate_indian_mobile("+91 98765 43210") == "+919876543210"
    assert validate_indian_mobile("09876543210") == "+919876543210"
    assert validate_indian_mobile("919876543210") == "+919876543210"

    with pytest.raises(ValueError):
        validate_indian_mobile("1234567890")  # Does not start with 6-9
    with pytest.raises(ValueError):
        validate_indian_mobile("98765")  # Too short


# =========================================================================
# 5. PRESS 9 CONSENT WITHDRAWAL
# =========================================================================


def test_press_9_records_consent_withdraw_and_audit(demo_client: TestClient):
    """Pressing 9 in simulator records consent withdraw event and audit entry."""
    hosp_token = make_mock_token(
        {
            "uid": "hosp-1",
            "role": "hospital",
            "hospitalId": "hosp-sample-1",
            "env": "demo",
        }
    )
    demo_user_token = make_mock_token(
        {
            "uid": "demo-judge",
            "role": "public",
            "env": "demo",
        }
    )

    create_resp = demo_client.post(
        "/requests",
        json={
            "bloodGroup": "O+",
            "component": "WHOLE_BLOOD",
            "unitsNeeded": 2,
        },
        headers={"Authorization": f"Bearer {hosp_token}"},
    )
    assert create_resp.status_code == 201
    req_id = create_resp.json()["id"]

    store = MemoryStore.get_instance()
    calls = list(store._calls.get(req_id, {}).values())
    assert len(calls) > 0
    target_call = calls[0]
    target_donor_id = target_call.id.split("_", 2)[2]

    # Press 9 (Opt out)
    press_resp = demo_client.post(
        f"/sim/calls/{target_call.id}/press",
        json={"key": "9"},
        headers={"Authorization": f"Bearer {demo_user_token}"},
    )
    assert press_resp.status_code == 200
    assert press_resp.json()["state"] == "OPTED_OUT"

    # Check store for consent withdrawal
    donor = store._donors.get(target_donor_id)
    assert donor is not None
    assert donor.consent_urgent is False
    assert donor.active is False

    # Check consent event in consents/{target_donor_id}/events
    consent_events = store._consents.get(target_donor_id, [])
    withdraw_events = [e for e in consent_events if e.get("action") == "WITHDRAW"]
    assert len(withdraw_events) == 1
    we = withdraw_events[0]
    assert we["purpose"] == "urgent_contact"
    assert we["granted"] is False
    assert we["channel"] == "ivr"

    # Check audit entry for opt-out
    audit_entries = [e for e in store._audit if e.get("action") == "opt-out"]
    assert len(audit_entries) >= 1
    ae = audit_entries[-1]
    assert ae["targetId"] == target_donor_id
    assert ae["actorUid"] == target_donor_id
    assert ae["role"] == "donor"
    assert ae["beforeStatus"] == "ACTIVE"
    assert ae["afterStatus"] == "WITHDRAWN"


# =========================================================================
# 6. AUDIT TRAIL FOR SENSITIVE ACTIONS
# =========================================================================


async def test_audit_ledger_records_sensitive_actions():
    """Verifies that record_audit persists immutable records without personal values."""
    store = MemoryStore.get_instance()
    entry = await record_audit(
        store,
        actor_uid="test-actor-1",
        role="staff",
        action="accept",
        target_id="req-123_1_donor-a1",
        before_status="ON_THE_WAY",
        after_status="ACCEPTED",
        mode="demo",
    )
    assert entry["id"].startswith("audit-")
    assert entry["actorUid"] == "test-actor-1"
    assert entry["action"] == "accept"
    assert entry["beforeStatus"] == "ON_THE_WAY"
    assert entry["afterStatus"] == "ACCEPTED"

    # Ensure no PII exists in entry
    assert "phone" not in str(entry)
    assert "name" not in str(entry)
    assert "patient" not in str(entry)

    saved_entries = await store.list_audit_entries()
    assert any(e["id"] == entry["id"] for e in saved_entries)


# =========================================================================
# 7. RESPONSE SCANNER: ZERO PHONE NUMBER LEAKAGE
# =========================================================================


def test_no_endpoint_response_contains_full_phone_number(demo_client: TestClient):
    """Scans all endpoint responses with regex to prove zero phone leakage."""
    hosp_token = make_mock_token(
        {
            "uid": "hosp-1",
            "role": "hospital",
            "hospitalId": "hosp-sample-1",
            "env": "demo",
        }
    )
    staff_token = make_mock_token(
        {
            "uid": "staff-1",
            "role": "staff",
            "centreId": "centre-sample-1",
            "env": "demo",
        }
    )
    demo_user_token = make_mock_token(
        {
            "uid": "judge-1",
            "role": "public",
            "env": "demo",
        }
    )

    responses_to_scan = []

    # 1. Signup
    r_signup = demo_client.post(
        "/donors/signup",
        json={
            "name": "Donor Privacy Test",
            "phone": "+919876543210",
            "bloodGroup": "O+",
            "area": "T. Nagar",
            "consentUrgent": True,
            "consentHistory": True,
            "adult": True,
        },
    )
    responses_to_scan.append(r_signup)

    # 2. Config & Health
    responses_to_scan.append(demo_client.get("/healthz"))
    responses_to_scan.append(demo_client.get("/config"))

    # 3. Create Request
    r_create = demo_client.post(
        "/requests",
        json={
            "bloodGroup": "O+",
            "component": "WHOLE_BLOOD",
            "unitsNeeded": 2,
            "patientRef": "IP-12345",
        },
        headers={"Authorization": f"Bearer {hosp_token}"},
    )
    responses_to_scan.append(r_create)
    req_id = r_create.json()["id"]

    # 4. Request Status & Inspection
    responses_to_scan.append(demo_client.get(f"/requests/{req_id}/status"))
    responses_to_scan.append(
        demo_client.get(
            f"/requests/{req_id}",
            headers={"Authorization": f"Bearer {hosp_token}"},
        )
    )

    store = MemoryStore.get_instance()
    active_calls = list(store._calls.get(req_id, {}).values())
    assert len(active_calls) >= 3
    call_1 = active_calls[0].id

    call_2 = active_calls[1].id
    call_3 = active_calls[2].id

    # 5. Simulator Key Presses (1, 1, 9)
    responses_to_scan.append(
        demo_client.post(
            f"/sim/calls/{call_1}/press",
            json={"key": "1"},
            headers={"Authorization": f"Bearer {demo_user_token}"},
        )
    )
    responses_to_scan.append(
        demo_client.post(
            f"/sim/calls/{call_2}/press",
            json={"key": "1"},
            headers={"Authorization": f"Bearer {demo_user_token}"},
        )
    )
    responses_to_scan.append(
        demo_client.post(
            f"/sim/calls/{call_3}/press",
            json={"key": "9"},
            headers={"Authorization": f"Bearer {demo_user_token}"},
        )
    )

    # 6. Staff Accept & Defer
    responses_to_scan.append(
        demo_client.post(
            f"/calls/{call_1}/accept",
            headers={"Authorization": f"Bearer {staff_token}"},
        )
    )
    responses_to_scan.append(
        demo_client.post(
            f"/calls/{call_2}/defer",
            json={"returnDate": "2026-12-01"},
            headers={"Authorization": f"Bearer {staff_token}"},
        )
    )

    # 7. Metrics
    responses_to_scan.append(
        demo_client.get(
            "/metrics",
            headers={"Authorization": f"Bearer {demo_user_token}"},
        )
    )

    # 8. Cancel Request
    responses_to_scan.append(
        demo_client.post(
            f"/requests/{req_id}/cancel",
            headers={"Authorization": f"Bearer {hosp_token}"},
        )
    )

    # Scan ALL response texts for any full 10-digit phone number
    for r in responses_to_scan:
        assert r.status_code in (200, 201), f"Unexpected status {r.status_code}: {r.text}"
        found = FULL_PHONE_REGEX.findall(r.text)
        assert not found, f"Response leaked full phone number: {found} in {r.url} body: {r.text}"
