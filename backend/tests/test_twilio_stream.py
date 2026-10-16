"""Tests for Twilio Media Streams two-way WebSocket handler and audio synthesis.

Validates:
- Bad token closes stream with policy violation (1008)
- Mode mismatch closes stream with policy violation (1008)
- Audio frames are strictly 160 bytes (20 ms at 8 kHz mu-law)
- Nothing is written to disk during audio synthesis or stream playback
- DTMF 1 applies COMING once even if sent twice (idempotency)
- DTMF 2 declines and DTMF 9 opts out donor
- No key within timeout triggers NO_ANSWER transition
- Non-allowlisted numbers are refused by TwilioAdapter
"""

import base64
import tempfile
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.clock.service import SimulationClock
from app.core.config import Settings
from app.core.entities import Donor
from app.core.phone_vault import store_donor_contact
from app.core.store import Store, get_store
from app.core.store_memory import MemoryStore
from app.outreach.twilio_adapter import TwilioAdapter
from app.requests.models import BloodGroup, BloodRequest, Call, CallState, Component, RequestStatus
from app.voice.tokens import create_stream_token


@pytest.fixture(autouse=True)
def reset_store_and_clock():
    """Resets in-memory store and simulation clock before each test."""
    MemoryStore.reset_instance()
    SimulationClock.reset_instance()
    yield
    MemoryStore.reset_instance()
    SimulationClock.reset_instance()


@pytest.fixture
def stream_settings() -> Settings:
    return Settings(
        DATA_MODE="demo",
        FIRESTORE_DB="u2u-demo",
        GEMINI_MODEL="gemini-2.5-flash",
        PUBLIC_BASE_URL="http://testserver",
        TWILIO_ACCOUNT_SID="ACtest1234567890",
        TWILIO_AUTH_TOKEN="test-twilio-auth-token-12345",
        TWILIO_FROM_NUMBER="+15551234567",
        CALL_ALLOWLIST="+919876543210,+15551234567",
        ALLOW_TEST_HEADER_AUTH=True,
    )


@pytest.fixture
def stream_client(stream_settings: Settings) -> TestClient:
    from app.main import create_app

    app = create_app(settings=stream_settings)
    return TestClient(app)


async def _seed_test_request_and_call(
    store: Store,
    request_id: str = "req-stream-1",
    call_id: str = "req-stream-1_1_d1",
    status: RequestStatus = RequestStatus.OPEN,
    donor_id: str = "d1",
    phone: str = "+919876543210",
) -> tuple[BloodRequest, Call]:
    """Helper creating a test BloodRequest, Call, and Donor in the store."""
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
        id=call_id,
        request_id=request_id,
        donor_alias="Donor A1",
        blood_group=BloodGroup.O_POS,
        lang="ta",
        state=CallState.RINGING,
        round=1,
        eta_minutes=25,
        distance_km=2.4,
        updated_at="2026-10-15T10:00:00Z",
    )
    await store.save_call(request_id, call)

    await store_donor_contact(store, donor_id, phone)
    donor = Donor(
        id=donor_id,
        alias="Donor A1",
        blood_group=BloodGroup.O_POS,
        lang="ta",
        area="Adyar",
        city="Chennai",
        distance_km=2.4,
        phone_hash="hash1",
        phone_masked="+91 ••••• ••3210",
        consent_urgent=True,
        consent_history=True,
        adult=True,
        active=True,
        last_donation_date=None,
        is_simulated=True,
        data_mode="demo",
    )
    await store.save_donor(donor)
    return req, call


def test_bad_token_closes_stream(stream_client: TestClient):
    """A bad or non-existent stream token closes the WebSocket immediately."""
    with stream_client.websocket_connect("/twilio/demo/stream/req-stream-1_1_d1") as ws:
        ws.send_json({"event": "connected"})
        # Send start event with invalid token
        ws.send_json(
            {
                "event": "start",
                "start": {
                    "streamSid": "MZ_bad_001",
                    "callSid": "CA_bad_001",
                    "customParameters": {"token": "completely-invalid-token"},
                },
            }
        )
        with pytest.raises(WebSocketDisconnect) as exc_info:
            ws.receive_text()
        assert exc_info.value.code == 1008


def test_mode_mismatch_closes_stream(stream_client: TestClient):
    """Connecting to a path with a mode mismatching DATA_MODE closes the WebSocket."""
    # Active mode is demo; path requests 'live'
    with stream_client.websocket_connect("/twilio/live/stream/req-stream-1_1_d1") as ws:
        with pytest.raises(WebSocketDisconnect) as exc_info:
            ws.receive_text()
        assert exc_info.value.code == 1008


@pytest.mark.asyncio
async def test_audio_frames_are_160_bytes_and_nothing_written_to_disk(stream_client: TestClient):
    """Audio frames sent over WebSocket must be exactly 160 bytes and zero files written to disk."""
    store = get_store()
    call_id = "req-stream-1_1_d1"
    await _seed_test_request_and_call(store, call_id=call_id)
    token = await create_stream_token(store, call_id)

    # Snapshot temp directory files before stream
    temp_dir = Path(tempfile.gettempdir())
    files_before = set(temp_dir.glob("u2u_stream*"))

    media_frames_checked = 0
    with stream_client.websocket_connect(f"/twilio/demo/stream/{call_id}") as ws:
        ws.send_json({"event": "connected"})
        ws.send_json(
            {
                "event": "start",
                "start": {
                    "streamSid": "MZ_frame_test",
                    "callSid": "CA_frame_test",
                    "customParameters": {"token": token},
                },
            }
        )

        # Read media frames and marks
        while media_frames_checked < 5:
            msg = ws.receive_json()
            if msg.get("event") == "media":
                payload_b64 = msg["media"]["payload"]
                raw_bytes = base64.b64decode(payload_b64)
                assert len(raw_bytes) == 160, f"Expected 160-byte frame, got {len(raw_bytes)}"
                media_frames_checked += 1
            elif msg.get("event") == "mark":
                break

        # Stop playback cleanly
        ws.send_json({"event": "stop", "stop": {}})

    # Verify nothing was written to disk
    files_after = set(temp_dir.glob("u2u_stream*"))
    assert files_before == files_after, "Audio frames must NOT be written to disk!"


@pytest.mark.asyncio
async def test_dtmf_1_applies_coming_once_even_if_sent_twice(stream_client: TestClient):
    """DTMF 1 transitions call to ON_THE_WAY and increments counter once, even if sent twice."""
    store = get_store()
    call_id = "req-stream-1_1_d1"
    await _seed_test_request_and_call(store, call_id=call_id)
    token = await create_stream_token(store, call_id)

    with stream_client.websocket_connect(f"/twilio/demo/stream/{call_id}") as ws:
        ws.send_json({"event": "connected"})
        ws.send_json(
            {
                "event": "start",
                "start": {
                    "streamSid": "MZ_dtmf_test",
                    "callSid": "CA_dtmf_test",
                    "customParameters": {"token": token},
                },
            }
        )

        # Send DTMF 1
        ws.send_json({"event": "dtmf", "dtmf": {"digit": "1"}})

        # Send DTMF 1 a second time immediately
        ws.send_json({"event": "dtmf", "dtmf": {"digit": "1"}})

        # Drain closing audio frames until socket closes
        try:
            while True:
                ws.receive_json()
        except WebSocketDisconnect:
            pass

    # Verify request counter only incremented ONCE
    req = await store.get_request("req-stream-1")
    assert req is not None
    assert req.on_the_way == 1

    call = await store.get_call("req-stream-1", call_id)
    assert call is not None
    assert call.state == CallState.ON_THE_WAY


@pytest.mark.asyncio
async def test_dtmf_2_declines_call(stream_client: TestClient):
    """DTMF 2 transitions call to DECLINED and plays closing_cant."""
    store = get_store()
    call_id = "req-stream-1_1_d1"
    await _seed_test_request_and_call(store, call_id=call_id)
    token = await create_stream_token(store, call_id)

    with stream_client.websocket_connect(f"/twilio/demo/stream/{call_id}") as ws:
        ws.send_json({"event": "connected"})
        ws.send_json(
            {
                "event": "start",
                "start": {
                    "streamSid": "MZ_dtmf_2",
                    "callSid": "CA_dtmf_2",
                    "customParameters": {"token": token},
                },
            }
        )

        ws.send_json({"event": "dtmf", "dtmf": {"digit": "2"}})

        try:
            while True:
                ws.receive_json()
        except WebSocketDisconnect:
            pass

    call = await store.get_call("req-stream-1", call_id)
    assert call is not None
    assert call.state == CallState.DECLINED


@pytest.mark.asyncio
async def test_dtmf_9_opts_out_donor(stream_client: TestClient):
    """DTMF 9 transitions call to OPTED_OUT and revokes donor consent."""
    store = get_store()
    call_id = "req-stream-1_1_d1"
    await _seed_test_request_and_call(store, call_id=call_id)
    token = await create_stream_token(store, call_id)

    with stream_client.websocket_connect(f"/twilio/demo/stream/{call_id}") as ws:
        ws.send_json({"event": "connected"})
        ws.send_json(
            {
                "event": "start",
                "start": {
                    "streamSid": "MZ_dtmf_9",
                    "callSid": "CA_dtmf_9",
                    "customParameters": {"token": token},
                },
            }
        )

        ws.send_json({"event": "dtmf", "dtmf": {"digit": "9"}})

        try:
            while True:
                ws.receive_json()
        except WebSocketDisconnect:
            pass

    call = await store.get_call("req-stream-1", call_id)
    assert call is not None
    assert call.state == CallState.OPTED_OUT

    donor = await store.get_donor("d1")
    assert donor is not None
    assert donor.consent_urgent is False
    assert donor.active is False


@pytest.mark.asyncio
async def test_no_key_for_timeout_gives_no_answer(stream_client: TestClient):
    """When no key is pressed within timeout, the call transitions to NO_ANSWER."""
    store = get_store()
    call_id = "req-stream-1_1_d1"
    await _seed_test_request_and_call(store, call_id=call_id)
    token = await create_stream_token(store, call_id)

    with (
        patch("app.voice.twilio_stream.STREAM_TIMEOUT_SECONDS", 0.05),
        stream_client.websocket_connect(f"/twilio/demo/stream/{call_id}") as ws,
    ):
        ws.send_json({"event": "connected"})
        ws.send_json(
            {
                "event": "start",
                "start": {
                    "streamSid": "MZ_timeout",
                    "callSid": "CA_timeout",
                    "customParameters": {"token": token},
                },
            }
        )

        # Wait for socket to be closed by server timeout handler
        try:
            while True:
                ws.receive_json()
        except WebSocketDisconnect:
            pass

    call = await store.get_call("req-stream-1", call_id)
    assert call is not None
    assert call.state == CallState.NO_ANSWER


@pytest.mark.asyncio
async def test_non_allowlisted_number_is_refused():
    """TwilioAdapter strictly refuses numbers not in CALL_ALLOWLIST."""
    store = get_store()
    settings = Settings(
        CALL_ALLOWLIST="+919876543210",
        DATA_MODE="demo",
        TWILIO_ACCOUNT_SID="ACtest",
        TWILIO_AUTH_TOKEN="authtoken",
        TWILIO_FROM_NUMBER="+15551234567",
    )
    # Seed donor with non-allowlisted number
    _, call = await _seed_test_request_and_call(
        store,
        donor_id="d_not_allowed",
        call_id="req-stream-1_1_d_not_allowed",
        phone="+919999999999",
    )

    mock_client = MagicMock()
    with patch("app.outreach.twilio_adapter.get_settings", return_value=settings):
        adapter = TwilioAdapter(store=store, twilio_client=mock_client)
        with pytest.raises(ValueError, match="not in CALL_ALLOWLIST"):
            await adapter.place_call(call)

    # Verify Twilio client was never called
    mock_client.calls.create.assert_not_called()
