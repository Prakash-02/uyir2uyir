"""Tests for Twilio outbound voice adapter, signed webhooks, allowlisting, and fallback."""

from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from twilio.request_validator import RequestValidator

from app.clock.service import SimulationClock
from app.core.config import Settings
from app.core.entities import Donor
from app.core.phone_vault import store_donor_contact
from app.core.store import Store, get_store
from app.core.store_memory import MemoryStore
from app.outreach.twilio_adapter import TwilioAdapter
from app.requests.models import BloodGroup, BloodRequest, Call, CallState, Component, RequestStatus


@pytest.fixture(autouse=True)
def reset_store_and_clock():
    """Resets in-memory store and simulation clock before each test."""
    MemoryStore.reset_instance()
    SimulationClock.reset_instance()
    yield
    MemoryStore.reset_instance()
    SimulationClock.reset_instance()


def build_signed_headers(
    url_path: str,
    params: dict[str, str],
    auth_token: str = "test-twilio-auth-token-12345",
    public_base: str = "http://testserver",
) -> dict[str, str]:
    """Generates X-Twilio-Signature matching Twilio RequestValidator logic."""
    full_url = f"{public_base.rstrip('/')}{url_path}"
    validator = RequestValidator(auth_token)
    sig = validator.compute_signature(full_url, params)
    return {"X-Twilio-Signature": sig}


@pytest.fixture
def twilio_settings() -> Settings:
    return Settings(
        DATA_MODE="demo",
        FIRESTORE_DB="u2u-demo",
        GEMINI_MODEL="gemini-2.0-flash",
        PUBLIC_BASE_URL="http://testserver",
        TWILIO_ACCOUNT_SID="ACtest1234567890",
        TWILIO_AUTH_TOKEN="test-twilio-auth-token-12345",
        TWILIO_FROM_NUMBER="+15551234567",
        CALL_ALLOWLIST="+919876543210,+919123456789",
        ALLOW_TEST_HEADER_AUTH=True,
    )


@pytest.fixture
def twilio_client(twilio_settings: Settings) -> TestClient:
    from app.main import create_app

    app = create_app(settings=twilio_settings)
    return TestClient(app)


async def _seed_test_request_and_call(
    store: Store,
    request_id: str = "req-test-1",
    call_id: str | None = None,
    status: RequestStatus = RequestStatus.OPEN,
    call_state: CallState = CallState.RINGING,
    donor_id: str = "d1",
    phone: str = "+919876543210",
) -> tuple[BloodRequest, Call]:
    """Helper creating a test BloodRequest, Call, and Donor in the store."""
    actual_call_id = call_id or f"{request_id}_1_{donor_id}"
    parts = actual_call_id.split("_", 2)
    actual_donor_id = parts[2] if len(parts) >= 3 else donor_id

    req = BloodRequest(
        id=request_id,
        hospital_id="h-1",
        hospital_name="Apollo Hospital",
        centre_id="c-1",
        centre_name="Chennai Blood Centre",
        blood_group=BloodGroup.O_POS,
        component=Component.WHOLE_BLOOD,
        units_needed=2,
        status=status,
        accepted=0,
        on_the_way=0,
        round=1,
        created_at="2026-10-15T10:00:00Z",
        updated_at="2026-10-15T10:00:00Z",
        expires_at="2026-10-15T14:00:00Z",
        is_simulated=True,
    )
    await store.save_request(req)

    call = Call(
        id=actual_call_id,
        request_id=request_id,
        donor_alias=f"Donor {actual_donor_id}",
        blood_group=BloodGroup.O_POS,
        lang="ta",
        state=call_state,
        round=1,
        eta_minutes=None,
        distance_km=3.5,
        updated_at="2026-10-15T10:00:00Z",
    )
    await store.save_call(request_id, call)

    donor = Donor(
        id=actual_donor_id,
        alias=f"Donor {actual_donor_id}",
        blood_group=BloodGroup.O_POS,
        lang="ta",
        area="T Nagar",
        lat=13.0418,
        lng=80.2341,
        active=True,
        consent_urgent=True,
        is_simulated=True,
        registered_at="2026-01-01T00:00:00Z",
    )
    await store.save_donor(donor)
    await store_donor_contact(store, actual_donor_id, phone)

    return req, call


def test_bad_signature_gives_403(twilio_client: TestClient):
    """Webhook requests with missing or invalid signatures must be rejected with 403."""
    url = "/twilio/demo/voice/req-test-1_1_d1"
    resp = twilio_client.post(
        url,
        data={"CallSid": "CA12345"},
        headers={"X-Twilio-Signature": "invalid-signature"},
    )
    assert resp.status_code == 403
    assert "Invalid Twilio signature" in resp.json()["detail"]


def test_mode_mismatch_gives_403(twilio_client: TestClient):
    """Webhook requests with a mode that doesn't match DATA_MODE must return 403."""
    url = "/twilio/live/voice/req-test-1_1_d1"
    # Even with a technically valid signature for that URL, mode mismatch rejects with 403
    params = {"CallSid": "CA12345"}
    headers = build_signed_headers(url, params)
    resp = twilio_client.post(url, data=params, headers=headers)
    assert resp.status_code == 403
    assert "Data mode mismatch" in resp.json()["detail"]


@pytest.mark.asyncio
async def test_voice_webhook_returns_twiml(twilio_client: TestClient):
    """Voice webhook returns TwiML with <Play> and <Gather> replayed once, then <Hangup>."""
    store = get_store()
    await _seed_test_request_and_call(store)

    url = "/twilio/demo/voice/req-test-1_1_d1"
    params = {"CallSid": "CA_voice_001", "CallStatus": "in-progress"}
    headers = build_signed_headers(url, params)

    resp = twilio_client.post(url, data=params, headers=headers)
    assert resp.status_code == 200
    assert "application/xml" in resp.headers["content-type"]
    xml = resp.text

    assert "<Response>" in xml
    assert "<Play>" in xml
    assert "/audio/req-test-1/ta.mp3" in xml
    assert '<Gather numDigits="1" timeout="8"' in xml
    assert "/twilio/demo/gather/req-test-1_1_d1" in xml
    assert "<Hangup/>" in xml
    # Check that it is replayed once (appears twice in TwiML)
    assert xml.count("<Gather") == 2


@pytest.mark.asyncio
async def test_duplicate_gather_counts_once(twilio_client: TestClient):
    """A duplicate gather webhook submission counts only once."""
    store = get_store()
    await _seed_test_request_and_call(store)

    url = "/twilio/demo/gather/req-test-1_1_d1"
    params = {"CallSid": "CA_gather_dup_001", "Digits": "1"}
    headers = build_signed_headers(url, params)

    # First gather press 1
    resp1 = twilio_client.post(url, data=params, headers=headers)
    assert resp1.status_code == 200

    # Verify request state after first press
    req1 = await store.get_request("req-test-1")
    assert req1 is not None
    assert req1.on_the_way == 1
    call1 = await store.get_call("req-test-1", "req-test-1_1_d1")
    assert call1 is not None
    assert call1.state == CallState.ON_THE_WAY

    # Second gather with the EXACT SAME CallSid (Twilio duplicate/retry)
    resp2 = twilio_client.post(url, data=params, headers=headers)
    assert resp2.status_code == 200

    # Verify counters did not increment a second time
    req2 = await store.get_request("req-test-1")
    assert req2 is not None
    assert req2.on_the_way == 1  # Still 1!


@pytest.mark.asyncio
async def test_late_press_1_becomes_late_accept(twilio_client: TestClient):
    """Press 1 on a PAUSED or FULFILLED request transitions the call to LATE_ACCEPT."""
    store = get_store()
    await _seed_test_request_and_call(
        store,
        request_id="req-paused-1",
        call_id="req-paused-1_1_d1",
        status=RequestStatus.PAUSED,
    )

    url = "/twilio/demo/gather/req-paused-1_1_d1"
    params = {"CallSid": "CA_late_001", "Digits": "1"}
    headers = build_signed_headers(url, params)

    resp = twilio_client.post(url, data=params, headers=headers)
    assert resp.status_code == 200

    call = await store.get_call("req-paused-1", "req-paused-1_1_d1")
    assert call is not None
    assert call.state == CallState.LATE_ACCEPT

    req = await store.get_request("req-paused-1")
    assert req is not None
    assert req.status == RequestStatus.PAUSED


@pytest.mark.asyncio
async def test_non_allowlisted_number_is_refused():
    """Adapter refuses to place call if donor phone is not in CALL_ALLOWLIST."""
    store = get_store()
    # Number not in allowlist (+919999999999 vs +919876543210)
    _, call = await _seed_test_request_and_call(
        store,
        donor_id="d_refused",
        phone="+919999999999",
    )

    mock_twilio_client = MagicMock()
    adapter = TwilioAdapter(store=store, twilio_client=mock_twilio_client)

    with pytest.raises(ValueError, match="not in CALL_ALLOWLIST"):
        await adapter.place_call(call)

    # Twilio API must NEVER have been called
    mock_twilio_client.calls.create.assert_not_called()


@pytest.mark.asyncio
async def test_allowlisted_number_places_call():
    """Adapter places call via Twilio with exact settings for allowlisted number."""
    store = get_store()
    _, call = await _seed_test_request_and_call(
        store,
        donor_id="d_allowed",
        phone="+919876543210",
    )

    mock_twilio_client = MagicMock()
    mock_twilio_client.calls.create.return_value = MagicMock(sid="CA_test_success")
    adapter = TwilioAdapter(store=store, twilio_client=mock_twilio_client)

    await adapter.place_call(call)

    # Check Twilio API call parameters
    mock_twilio_client.calls.create.assert_called_once()
    kwargs = mock_twilio_client.calls.create.call_args.kwargs
    assert kwargs["to"] == "+919876543210"
    assert kwargs["timeout"] == 25
    assert kwargs["time_limit"] == 90
    assert kwargs["record"] is False
    assert f"/twilio/demo/voice/{call.id}" in kwargs["url"]
    assert f"/twilio/demo/status/{call.id}" in kwargs["status_callback"]

    # Call marked as RINGING in store
    saved_call = await store.get_call("req-test-1", call.id)
    assert saved_call is not None
    assert saved_call.state == CallState.RINGING


@pytest.mark.asyncio
async def test_status_webhook_maps_to_no_answer(twilio_client: TestClient):
    """Twilio status callback with no-answer, busy, failed, or completed maps call to NO_ANSWER."""
    store = get_store()
    await _seed_test_request_and_call(store, call_id="req-test-1_1_d_status")

    url = "/twilio/demo/status/req-test-1_1_d_status"
    params = {"CallSid": "CA_status_001", "CallStatus": "no-answer"}
    headers = build_signed_headers(url, params)

    resp = twilio_client.post(url, data=params, headers=headers)
    assert resp.status_code == 200

    call = await store.get_call("req-test-1", "req-test-1_1_d_status")
    assert call is not None
    assert call.state == CallState.NO_ANSWER


@pytest.mark.asyncio
async def test_three_twilio_errors_switch_to_simulator_and_add_timeline_event():
    """Three Twilio errors in a row switch config/telephony back to simulator and add timeline event."""
    store = get_store()
    req, call = await _seed_test_request_and_call(store, donor_id="d_fail", phone="+919876543210")

    # Set telephony adapter to twilio initially
    await store.set_config("telephony", {"adapter": "twilio", "consecutiveErrors": 0})

    mock_twilio_client = MagicMock()
    mock_twilio_client.calls.create.side_effect = RuntimeError("Twilio network error")
    adapter = TwilioAdapter(store=store, twilio_client=mock_twilio_client)

    # Call 1: error 1
    with pytest.raises(RuntimeError):
        await adapter.place_call(call)
    conf = await store.get_config("telephony")
    assert conf["adapter"] == "twilio"
    assert conf["consecutiveErrors"] == 1

    # Call 2: error 2
    with pytest.raises(RuntimeError):
        await adapter.place_call(call)
    conf = await store.get_config("telephony")
    assert conf["adapter"] == "twilio"
    assert conf["consecutiveErrors"] == 2

    # Call 3: error 3 -> switches to simulator and adds timeline event
    await adapter.place_call(call)
    conf = await store.get_config("telephony")
    assert conf["adapter"] == "simulator"
    assert conf["consecutiveErrors"] == 3

    # Check timeline events for TELEPHONY_FALLBACK
    events = await store.list_events(req.id)
    fallback_events = [e for e in events if e.kind == "TELEPHONY_FALLBACK"]
    assert len(fallback_events) == 1
    assert "3 consecutive Twilio errors" in fallback_events[0].text


def test_tts_audio_endpoint_serves_mp3(twilio_client: TestClient):
    """GET /audio/{template_id}/{lang}.mp3 serves MP3 audio."""
    resp_en = twilio_client.get("/audio/tpl-demo-1/en.mp3")
    assert resp_en.status_code == 200
    assert resp_en.headers["content-type"] == "audio/mpeg"
    assert len(resp_en.content) > 0

    resp_ta = twilio_client.get("/audio/tpl-demo-1/ta.mp3")
    assert resp_ta.status_code == 200
    assert resp_ta.headers["content-type"] == "audio/mpeg"
    assert len(resp_ta.content) > 0
