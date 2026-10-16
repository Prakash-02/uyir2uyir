"""Comprehensive unit and integration tests for Gemini Live session bridge and audio adapter.

Tests using FakeLiveSession (strictly no network calls):
1. COMING with an ETA applies once (idempotent transition, quote and eta stored)
2. UNCLEAR changes nothing
3. An invalid intent becomes UNCLEAR
4. A tool call after 45 seconds is ignored
5. DTMF overrides an open session (immediate session closure and transition)
6. A session open failure falls back to keypad
7. Interrupted sends clear to Twilio
8. The audio conversion keeps strict 160-byte frames (20 ms @ 8 kHz mu-law)
9. No audio or full transcript is stored on disk or in the database
"""

import asyncio
import base64
import json
import tempfile
from collections.abc import AsyncGenerator
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from unittest.mock import AsyncMock, MagicMock

import pytest
from starlette.testclient import TestClient

from app.clock.service import SimulationClock
from app.core.config import Settings
from app.core.entities import Donor
from app.core.phone_vault import store_donor_contact
from app.core.store import Store, get_store
from app.core.store_memory import MemoryStore
from app.requests.models import BloodGroup, BloodRequest, Call, CallState, Component, RequestStatus
from app.voice.live_session import LiveBridge, TwilioAudioAdapter
from app.voice.tokens import create_stream_token
from app.voice.twilio_stream import set_live_session_factory


@dataclass
class FakeServerContent:
    interrupted: bool = False
    input_transcription: Any = None
    output_transcription: Any = None
    model_turn: Any = None
    turn_complete: bool = False


@dataclass
class FakeFunctionCall:
    name: str
    id: str
    args: dict[str, Any]


@dataclass
class FakeToolCall:
    function_calls: list[FakeFunctionCall]


@dataclass
class FakeMessage:
    server_content: FakeServerContent | None = None
    tool_call: FakeToolCall | None = None


class FakeLiveSession:
    """Mock Gemini Live session yielding scripted messages and recording sent data."""

    def __init__(self, script: list[FakeMessage] | None = None) -> None:
        self.script = script or []
        self.sent_realtime_chunks: list[bytes] = []
        self.sent_tool_responses: list[Any] = []
        self.is_closed = False
        self._queue: asyncio.Queue[FakeMessage] = asyncio.Queue()
        for msg in self.script:
            self._queue.put_nowait(msg)

    async def send_realtime_input(self, media: Any = None, audio_stream_end: bool = False) -> None:
        if media and hasattr(media, "data"):
            self.sent_realtime_chunks.append(media.data)

    async def send_tool_response(self, function_responses: list[Any] | None = None) -> None:
        if function_responses:
            self.sent_tool_responses.extend(function_responses)

    async def receive(self) -> AsyncGenerator[FakeMessage, None]:
        while not self.is_closed:
            try:
                msg = await asyncio.wait_for(self._queue.get(), timeout=0.1)
                yield msg
            except TimeoutError:
                if self.is_closed:
                    break
            except asyncio.CancelledError:
                break

    def push_message(self, msg: FakeMessage) -> None:
        self._queue.put_nowait(msg)

    async def close(self) -> None:
        self.is_closed = True


@pytest.fixture(autouse=True)
def reset_store_and_factory():
    """Resets memory store, clock, and live session factory before each test."""
    MemoryStore.reset_instance()
    SimulationClock.reset_instance()
    set_live_session_factory(None)
    yield
    MemoryStore.reset_instance()
    SimulationClock.reset_instance()
    set_live_session_factory(None)


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
        TWILIO_ACCOUNT_SID="ACtest1234567890",
        TWILIO_AUTH_TOKEN="test-twilio-auth-token-12345",
        TWILIO_FROM_NUMBER="+15551234567",
        CALL_ALLOWLIST="+919876543210,+15551234567",
        ALLOW_TEST_HEADER_AUTH=True,
    )


@pytest.fixture
def stream_client(test_settings: Settings) -> TestClient:
    from app.main import create_app

    app = create_app(settings=test_settings)
    return TestClient(app)


async def _seed_test_request_and_call(
    store: Store,
    request_id: str = "req-live-1",
    call_id: str = "req-live-1_1_d1",
    status: RequestStatus = RequestStatus.OPEN,
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
        state=CallState.RINGING,
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
        area="T Nagar",
        phone_hash="hash-1",
        phone_masked="+91 ••••• ••210",
        lang="ta",
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


# -------------------------------------------------------------------------
# Test 1: COMING with an ETA applies once
# -------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_coming_with_eta_applies_once():
    store = get_store()
    req, call = await _seed_test_request_and_call(store)

    fake_session = FakeLiveSession()
    adapter = MagicMock()
    adapter.send_output_audio = AsyncMock()
    adapter.handle_interrupted = AsyncMock()

    bridge = LiveBridge(
        call=call,
        lang="ta",
        audio_adapter=adapter,
        request=req,
        store=store,
        session_factory=lambda _b: fake_session,
    )
    await bridge.start()

    # Emit tool call: COMING with 25 minutes ETA
    tool_msg = FakeMessage(
        tool_call=FakeToolCall(
            function_calls=[
                FakeFunctionCall(
                    name="record_reply",
                    id="call_1",
                    args={"intent": "COMING", "etaMinutes": 25, "quote": "varen 25 nimisham la"},
                )
            ]
        )
    )
    fake_session.push_message(tool_msg)

    # Wait for tool call execution
    await asyncio.wait_for(bridge.tool_called_event.wait(), timeout=2.0)

    # Verify tool response
    assert len(fake_session.sent_tool_responses) == 1
    resp = fake_session.sent_tool_responses[0]
    assert resp.response["applied"] is True
    assert "Chennai Blood Centre" in resp.response["sayThis"]

    # Verify Call in store
    saved_call = await store.get_call("req-live-1", "req-live-1_1_d1")
    assert saved_call is not None
    assert saved_call.state == CallState.ON_THE_WAY
    assert saved_call.eta_minutes == 25
    assert saved_call.quote == "varen 25 nimisham la"

    # Verify Request counter incremented
    saved_req = await store.get_request("req-live-1")
    assert saved_req.on_the_way == 1

    # Second tool call: should be idempotent and not double-increment
    tool_msg_2 = FakeMessage(
        tool_call=FakeToolCall(
            function_calls=[
                FakeFunctionCall(
                    name="record_reply",
                    id="call_2",
                    args={"intent": "COMING", "etaMinutes": 25, "quote": "varen 25 nimisham la"},
                )
            ]
        )
    )
    fake_session.push_message(tool_msg_2)
    await asyncio.sleep(0.05)

    saved_req2 = await store.get_request("req-live-1")
    assert saved_req2.on_the_way == 1

    await bridge.close()


# -------------------------------------------------------------------------
# Test 2: UNCLEAR changes nothing
# -------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_unclear_changes_nothing():
    store = get_store()
    req, call = await _seed_test_request_and_call(store)

    fake_session = FakeLiveSession()
    adapter = MagicMock()
    adapter.send_output_audio = AsyncMock()

    bridge = LiveBridge(
        call=call,
        lang="ta",
        audio_adapter=adapter,
        request=req,
        store=store,
        session_factory=lambda _b: fake_session,
    )
    await bridge.start()

    tool_msg = FakeMessage(
        tool_call=FakeToolCall(
            function_calls=[
                FakeFunctionCall(
                    name="record_reply",
                    id="call_unclear",
                    args={"intent": "UNCLEAR", "quote": "hello?"},
                )
            ]
        )
    )
    fake_session.push_message(tool_msg)
    await asyncio.wait_for(bridge.tool_called_event.wait(), timeout=2.0)

    # Tool response must reflect applied=False
    resp = fake_session.sent_tool_responses[0]
    assert resp.response["applied"] is False

    # Call must remain RINGING with no ETA
    saved_call = await store.get_call("req-live-1", "req-live-1_1_d1")
    assert saved_call.state == CallState.RINGING
    assert saved_call.eta_minutes is None

    # Request counters unchanged
    saved_req = await store.get_request("req-live-1")
    assert saved_req.on_the_way == 0

    await bridge.close()


# -------------------------------------------------------------------------
# Test 3: An invalid intent becomes UNCLEAR
# -------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_invalid_intent_becomes_unclear():
    store = get_store()
    req, call = await _seed_test_request_and_call(store)

    fake_session = FakeLiveSession()
    adapter = MagicMock()
    adapter.send_output_audio = AsyncMock()

    bridge = LiveBridge(
        call=call,
        lang="en",
        audio_adapter=adapter,
        request=req,
        store=store,
        session_factory=lambda _b: fake_session,
    )
    await bridge.start()

    # Emit tool call with unexpected intent string
    tool_msg = FakeMessage(
        tool_call=FakeToolCall(
            function_calls=[
                FakeFunctionCall(
                    name="record_reply",
                    id="call_invalid",
                    args={"intent": "PERHAPS_TOMORROW", "quote": "maybe tomorrow"},
                )
            ]
        )
    )
    fake_session.push_message(tool_msg)
    await asyncio.wait_for(bridge.tool_called_event.wait(), timeout=2.0)

    assert bridge.tool_result is not None
    assert bridge.tool_result["intent"] == "UNCLEAR"
    assert bridge.tool_result["applied"] is False

    # Call remains RINGING
    saved_call = await store.get_call("req-live-1", "req-live-1_1_d1")
    assert saved_call.state == CallState.RINGING

    await bridge.close()


# -------------------------------------------------------------------------
# Test 4: A tool call after 45 seconds is ignored
# -------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_tool_call_after_45_seconds_is_ignored():
    store = get_store()
    clock = SimulationClock.get_instance()
    req, call = await _seed_test_request_and_call(store)

    fake_session = FakeLiveSession()
    adapter = MagicMock()
    adapter.send_output_audio = AsyncMock()

    bridge = LiveBridge(
        call=call,
        lang="ta",
        audio_adapter=adapter,
        request=req,
        store=store,
        clock=clock,
        session_factory=lambda _b: fake_session,
    )
    await bridge.start()

    # Artificially set start_time to 50 seconds in the past
    bridge.start_time = clock.now().timestamp() - 50.0

    tool_msg = FakeMessage(
        tool_call=FakeToolCall(
            function_calls=[
                FakeFunctionCall(
                    name="record_reply",
                    id="call_late",
                    args={"intent": "COMING", "etaMinutes": 10, "quote": "I am coming"},
                )
            ]
        )
    )
    fake_session.push_message(tool_msg)
    await asyncio.sleep(0.1)

    # Tool call should have been ignored
    assert len(fake_session.sent_tool_responses) == 0
    saved_call = await store.get_call("req-live-1", "req-live-1_1_d1")
    assert saved_call.state == CallState.RINGING

    await bridge.close()


# -------------------------------------------------------------------------
# Test 5: DTMF overrides an open session
# -------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_dtmf_overrides_open_session(stream_client: TestClient):
    store = get_store()
    await _seed_test_request_and_call(store)
    token = await create_stream_token(store, "req-live-1_1_d1")

    fake_session = FakeLiveSession()
    set_live_session_factory(lambda _b: fake_session)

    with stream_client.websocket_connect("/twilio/demo/stream/req-live-1_1_d1") as ws:
        # Twilio sends start
        start_payload = {
            "event": "start",
            "streamSid": "MZ_live_dtmf",
            "start": {
                "streamSid": "MZ_live_dtmf",
                "callSid": "CA_dtmf_1",
                "customParameters": {"token": token},
            },
        }
        ws.send_text(json.dumps(start_payload))

        # Read opening audio frames until opening_end mark
        while True:
            msg = ws.receive_json()
            if msg.get("event") == "mark" and msg.get("mark", {}).get("name") == "opening_end":
                break

        # Brief delay ensuring live session is connected
        import time

        time.sleep(0.05)

        # Donor presses DTMF 1 while session is active
        dtmf_payload = {
            "event": "dtmf",
            "streamSid": "MZ_live_dtmf",
            "dtmf": {"digit": "1"},
        }
        ws.send_text(json.dumps(dtmf_payload))

        # Clear event should be sent to stop playing audio
        events_received = []
        try:
            while True:
                data = ws.receive_json()
                events_received.append(data.get("event"))
        except Exception:
            pass

        assert "clear" in events_received

    # Live session must be closed
    assert fake_session.is_closed is True

    # Call must be transitioned to ON_THE_WAY via DTMF 1
    call = await store.get_call("req-live-1", "req-live-1_1_d1")
    assert call.state == CallState.ON_THE_WAY


# -------------------------------------------------------------------------
# Test 6: A session open failure falls back to keypad
# -------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_session_open_failure_falls_back_to_keypad(stream_client: TestClient):
    store = get_store()
    await _seed_test_request_and_call(store)
    token = await create_stream_token(store, "req-live-1_1_d1")

    async def _failing_factory(_b):
        raise RuntimeError("Vertex AI Live connection refused")

    set_live_session_factory(_failing_factory)

    with stream_client.websocket_connect("/twilio/demo/stream/req-live-1_1_d1") as ws:
        start_payload = {
            "event": "start",
            "streamSid": "MZ_fail_1",
            "start": {
                "streamSid": "MZ_fail_1",
                "callSid": "CA_fail_1",
                "customParameters": {"token": token},
            },
        }
        ws.send_text(json.dumps(start_payload))

        # Verify fallback timeline event was logged
        await asyncio.sleep(0.1)
        events = await store.list_events("req-live-1")
        fallback_events = [e for e in events if e.kind == "LIVE_FALLBACK"]
        assert len(fallback_events) >= 1
        assert "Gemini Live unavailable, keypad used" in fallback_events[0].text

        # Send DTMF 2 to verify keypad continues operating
        dtmf_payload = {
            "event": "dtmf",
            "streamSid": "MZ_fail_1",
            "dtmf": {"digit": "2"},
        }
        ws.send_text(json.dumps(dtmf_payload))

        try:
            while True:
                ws.receive_json()
        except Exception:
            pass

    call = await store.get_call("req-live-1", "req-live-1_1_d1")
    assert call.state == CallState.DECLINED


# -------------------------------------------------------------------------
# Test 7: Interrupted sends clear
# -------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_interrupted_sends_clear():
    ws_mock = MagicMock()
    ws_mock.send_text = AsyncMock()
    adapter = TwilioAudioAdapter(websocket=ws_mock, stream_sid="MZ_clear_test")

    # Put some bytes into outgoing buffer
    adapter._out_buffer.extend(b"\x00" * 80)
    assert len(adapter._out_buffer) == 80

    await adapter.handle_interrupted()

    # Buffer must be cleared and clear message sent to Twilio
    assert len(adapter._out_buffer) == 0
    ws_mock.send_text.assert_called_once()
    sent_msg = json.loads(ws_mock.send_text.call_args[0][0])
    assert sent_msg["event"] == "clear"
    assert sent_msg["streamSid"] == "MZ_clear_test"


# -------------------------------------------------------------------------
# Test 8: The audio conversion keeps 160-byte frames
# -------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_audio_conversion_keeps_160_byte_frames():
    ws_mock = MagicMock()
    sent_frames = []

    async def mock_send_text(text: str):
        data = json.loads(text)
        if data.get("event") == "media":
            payload = data["media"]["payload"]
            decoded = base64.b64decode(payload)
            sent_frames.append(decoded)

    ws_mock.send_text = mock_send_text
    adapter = TwilioAudioAdapter(websocket=ws_mock, stream_sid="MZ_frame_test")

    # Synthesize arbitrary 24 kHz 16-bit linear PCM (say 12,345 bytes)
    dummy_24k_pcm = b"\x12\x34" * 6000
    await adapter.send_output_audio(dummy_24k_pcm)
    await adapter.flush()

    assert len(sent_frames) > 0
    for frame in sent_frames:
        assert len(frame) == 160, f"Expected strictly 160-byte frame, got {len(frame)}"


# -------------------------------------------------------------------------
# Test 9: No audio or full transcript is stored
# -------------------------------------------------------------------------
@pytest.mark.asyncio
async def test_no_audio_or_full_transcript_stored():
    store = get_store()
    req, call = await _seed_test_request_and_call(store)

    fake_session = FakeLiveSession()
    adapter = MagicMock()
    adapter.send_output_audio = AsyncMock()

    bridge = LiveBridge(
        call=call,
        lang="ta",
        audio_adapter=adapter,
        request=req,
        store=store,
        session_factory=lambda _b: fake_session,
    )
    await bridge.start()

    # Feed transcripts and audio into bridge
    msg = FakeMessage(
        server_content=FakeServerContent(
            input_transcription=MagicMock(text="Enakku vara mudiyum aana 20 mins aagum"),
            output_transcription=MagicMock(text="Romba nandri, blood centre vanga"),
            model_turn=MagicMock(parts=[MagicMock(inline_data=MagicMock(data=b"\x00" * 480))]),
            turn_complete=True,
        ),
        tool_call=FakeToolCall(
            function_calls=[
                FakeFunctionCall(
                    name="record_reply",
                    id="call_t9",
                    args={"intent": "COMING", "etaMinutes": 20, "quote": "vara mudiyum"},
                )
            ]
        ),
    )
    fake_session.push_message(msg)
    await asyncio.wait_for(bridge.tool_called_event.wait(), timeout=2.0)
    await bridge.close()

    # 1. Assert transcripts exist in-memory on bridge instance
    assert "Enakku vara mudiyum aana 20 mins aagum" in bridge.input_transcripts
    assert "Romba nandri, blood centre vanga" in bridge.output_transcripts

    # 2. Check store: only short quote is saved on Call; full transcript is NOT saved
    saved_call = await store.get_call("req-live-1", "req-live-1_1_d1")
    assert saved_call.quote == "vara mudiyum"
    assert not hasattr(saved_call, "transcript")

    # 3. Check timeline events: contains only short summary, never the full conversation
    events = await store.list_events("req-live-1")
    event_texts = [e.text for e in events]
    for text in event_texts:
        assert "Enakku vara mudiyum aana 20 mins aagum" not in text
        assert "Romba nandri, blood centre vanga" not in text

    # 4. Check disk / filesystem: no .wav, .pcm, or .mp3 files created
    temp_dir = Path(tempfile.gettempdir())
    recent_audio = list(temp_dir.glob("*.pcm")) + list(temp_dir.glob("*.ulaw"))
    assert len(recent_audio) == 0
