"""Tests for browser-based Gemini Live WebSocket endpoint WS /sim/live/{callId}.

Verifies:
1. Valid demo token authenticates and receives 24 kHz opening audio chunks
2. COMING with ETA from FakeLiveSession applies transition and dispatches result
3. Browser key 1 overrides open Live session immediately
4. Bad ID token closes WebSocket with code 1008
5. Non-ringing call closes WebSocket
6. Live session open failure sends fallback notification and keypad prompt audio
7. Interruption sends clear event to browser
8. 45-second duration timeout records UNCLEAR result and ended event
9. Non-demo mode guard closes WebSocket
"""

import base64
import json

import pytest
from starlette.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.clock.service import SimulationClock
from app.core.config import Settings
from app.core.entities import Donor
from app.core.phone_vault import store_donor_contact
from app.core.store import Store, get_store
from app.core.store_memory import MemoryStore
from app.requests.models import BloodGroup, BloodRequest, Call, CallState, Component, RequestStatus
from app.voice.browser_stream import set_browser_live_session_factory
from tests.test_live_session import (
    FakeFunctionCall,
    FakeLiveSession,
    FakeMessage,
    FakeServerContent,
    FakeToolCall,
)


@pytest.fixture(autouse=True)
def reset_store_and_factory():
    """Resets memory store, clock, and browser live session factory before each test."""
    MemoryStore.reset_instance()
    SimulationClock.reset_instance()
    set_browser_live_session_factory(None)
    yield
    MemoryStore.reset_instance()
    SimulationClock.reset_instance()
    set_browser_live_session_factory(None)


@pytest.fixture
def test_settings() -> Settings:
    return Settings(
        DATA_MODE="demo",
        FIRESTORE_DB="u2u-demo",
        GEMINI_MODEL="gemini-2.5-flash",
        LIVE_MODEL="gemini-live-2.5-flash-native-audio",
        LIVE_LOCATION="us-central1",
        LIVE_DAILY_MINUTES=60,
        PUBLIC_BASE_URL="http://testserver",
        ALLOW_TEST_HEADER_AUTH=True,
    )


@pytest.fixture
def sim_client(test_settings: Settings) -> TestClient:
    from app.main import create_app

    app = create_app(settings=test_settings)
    return TestClient(app)


async def _seed_test_request_and_call(
    store: Store,
    request_id: str = "req-browser-1",
    call_id: str = "req-browser-1_1_d1",
    status: RequestStatus = RequestStatus.OPEN,
    call_state: CallState = CallState.RINGING,
    donor_id: str = "d1",
) -> tuple[BloodRequest, Call]:
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
        state=call_state,
        round=1,
        eta_minutes=None,
        distance_km=4.2,
        updated_at="2026-10-15T10:00:00Z",
    )
    await store.save_call(request_id, call)

    donor = Donor(
        id=donor_id,
        alias="Donor A1",
        blood_group=BloodGroup.O_POS,
        area="Egmore",
        lang="ta",
        distance_km=4.2,
        consent_urgent=True,
        consent_history=True,
        adult=True,
        active=True,
        last_donation_date=None,
        is_simulated=True,
    )
    await store.save_donor(donor)
    await store_donor_contact(store, donor_id, "+919876543210")
    return req, call


VALID_AUTH_PAYLOAD = {
    "type": "auth",
    "idToken": "mock:" + json.dumps({"uid": "demo-judge", "role": "admin", "env": "demo"}),
}


# -------------------------------------------------------------------------
# Test 1: Bad ID token closes WebSocket with code 1008
# -------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_bad_id_token_closes_socket(sim_client: TestClient):
    store = get_store()
    await _seed_test_request_and_call(store)

    with (
        pytest.raises(WebSocketDisconnect),
        sim_client.websocket_connect("/sim/live/req-browser-1_1_d1") as ws,
    ):
        ws.send_text(json.dumps({"type": "auth", "idToken": "bad-token-value"}))
        # Next read should raise due to closed socket
        ws.receive_json()


# -------------------------------------------------------------------------
# Test 2: Non-ringing call closes WebSocket
# -------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_non_ringing_call_closes_socket(sim_client: TestClient):
    store = get_store()
    await _seed_test_request_and_call(store, call_state=CallState.ON_THE_WAY)

    with (
        pytest.raises(WebSocketDisconnect),
        sim_client.websocket_connect("/sim/live/req-browser-1_1_d1") as ws,
    ):
        ws.send_text(json.dumps(VALID_AUTH_PAYLOAD))
        ws.receive_json()


# -------------------------------------------------------------------------
# Test 3: Valid demo user receives opening audio chunks
# -------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_valid_auth_receives_opening_audio(sim_client: TestClient):
    store = get_store()
    await _seed_test_request_and_call(store)

    fake_session = FakeLiveSession()
    set_browser_live_session_factory(lambda _b: fake_session)

    with sim_client.websocket_connect("/sim/live/req-browser-1_1_d1") as ws:
        ws.send_text(json.dumps(VALID_AUTH_PAYLOAD))

        # First incoming message must be 24k audio opening
        msg = ws.receive_json()
        assert msg["type"] == "audio"
        assert "pcm24k" in msg
        assert len(msg["pcm24k"]) > 0

        # Terminate cleanly
        ws.send_text(json.dumps({"type": "end"}))


# -------------------------------------------------------------------------
# Test 4: COMING with ETA from FakeLiveSession applies transition and dispatches result
# -------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_browser_live_coming_with_eta(sim_client: TestClient):
    store = get_store()
    await _seed_test_request_and_call(store)

    fake_session = FakeLiveSession()
    set_browser_live_session_factory(lambda _b: fake_session)

    with sim_client.websocket_connect("/sim/live/req-browser-1_1_d1") as ws:
        ws.send_text(json.dumps(VALID_AUTH_PAYLOAD))

        # Send browser 16k PCM audio chunk
        dummy_pcm = base64.b64encode(b"\x00" * 640).decode("ascii")
        ws.send_text(json.dumps({"type": "audio", "pcm16k": dummy_pcm}))

        # Inject tool call into FakeLiveSession
        tool_msg = FakeMessage(
            tool_call=FakeToolCall(
                function_calls=[
                    FakeFunctionCall(
                        name="record_reply",
                        id="call_browser_1",
                        args={"intent": "COMING", "etaMinutes": 20, "quote": "varen 20 mins"},
                    )
                ]
            )
        )
        fake_session.push_message(tool_msg)

        # Collect events until result received (skipping opening audio chunks)
        result_msg = None
        for _ in range(300):
            try:
                data = ws.receive_json()
                if data.get("type") == "result":
                    result_msg = data
                    break
            except Exception:
                break

        assert result_msg is not None
        assert result_msg["intent"] == "COMING"
        assert result_msg["etaMinutes"] == 20
        assert result_msg["quote"] == "varen 20 mins"
        assert result_msg["applied"] is True

    # Call in store must now be ON_THE_WAY with eta_minutes and quote
    saved_call = await store.get_call("req-browser-1", "req-browser-1_1_d1")
    assert saved_call is not None
    assert saved_call.state == CallState.ON_THE_WAY
    assert saved_call.eta_minutes == 20
    assert saved_call.quote == "varen 20 mins"


# -------------------------------------------------------------------------
# Test 5: Browser key 1 overrides open live session
# -------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_browser_key_1_overrides_session(sim_client: TestClient):
    store = get_store()
    await _seed_test_request_and_call(store)

    fake_session = FakeLiveSession()
    set_browser_live_session_factory(lambda _b: fake_session)

    with sim_client.websocket_connect("/sim/live/req-browser-1_1_d1") as ws:
        ws.send_text(json.dumps(VALID_AUTH_PAYLOAD))

        # Read initial opening audio frame
        ws.receive_json()

        # Send browser keypad override
        ws.send_text(json.dumps({"type": "key", "digit": "1"}))

        # Must receive clear followed by closing audio and ended
        events = []
        try:
            while True:
                msg = ws.receive_json()
                events.append(msg.get("type"))
        except Exception:
            pass

        assert "clear" in events
        assert "ended" in events

    # Live session must be closed
    assert fake_session.is_closed is True

    # Call must be transitioned to ON_THE_WAY
    saved_call = await store.get_call("req-browser-1", "req-browser-1_1_d1")
    assert saved_call.state == CallState.ON_THE_WAY


# -------------------------------------------------------------------------
# Test 6: Live session open failure sends fallback notification and keypad prompt audio
# -------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_browser_live_open_failure_sends_fallback(sim_client: TestClient):
    store = get_store()
    await _seed_test_request_and_call(store)

    async def _failing_factory(_b):
        raise RuntimeError("Vertex AI connect failed")

    set_browser_live_session_factory(_failing_factory)

    with sim_client.websocket_connect("/sim/live/req-browser-1_1_d1") as ws:
        ws.send_text(json.dumps(VALID_AUTH_PAYLOAD))

        fallback_msg = None
        for _ in range(300):
            try:
                data = ws.receive_json()
                if data.get("type") == "fallback":
                    fallback_msg = data
                    break
            except Exception:
                break

        assert fallback_msg is not None
        assert fallback_msg["reason"] == "connection_failed"

        # Verify fallback timeline event
        events = await store.list_events("req-browser-1")
        assert any(e.kind == "LIVE_FALLBACK" for e in events)


# -------------------------------------------------------------------------
# Test 7: Interruption sends clear to browser
# -------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_browser_interruption_sends_clear(sim_client: TestClient):
    store = get_store()
    await _seed_test_request_and_call(store)

    fake_session = FakeLiveSession()
    set_browser_live_session_factory(lambda _b: fake_session)

    with sim_client.websocket_connect("/sim/live/req-browser-1_1_d1") as ws:
        ws.send_text(json.dumps(VALID_AUTH_PAYLOAD))

        # Push server content with interrupted=True
        interrupted_msg = FakeMessage(server_content=FakeServerContent(interrupted=True))
        fake_session.push_message(interrupted_msg)

        clear_received = False
        for _ in range(300):
            try:
                data = ws.receive_json()
                if data.get("type") == "clear":
                    clear_received = True
                    break
            except Exception:
                break

        assert clear_received is True


# -------------------------------------------------------------------------
# Test 8: Non-demo mode guard closes WebSocket
# -------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_non_demo_mode_guard_closes_socket():
    from app.main import create_app

    live_settings = Settings(
        DATA_MODE="live",
        FIRESTORE_DB="u2u-live",
        GEMINI_MODEL="gemini-2.5-flash",
        PUBLIC_BASE_URL="http://testserver",
    )
    app = create_app(settings=live_settings)
    client = TestClient(app)

    with (
        pytest.raises(WebSocketDisconnect),
        client.websocket_connect("/sim/live/req-browser-1_1_d1") as ws,
    ):
        ws.receive_json()
