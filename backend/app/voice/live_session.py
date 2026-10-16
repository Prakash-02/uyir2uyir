"""Gemini Live session bridge and bidirectional telephony audio adapter.

Coordinates real-time multimodal voice conversations with donors:
- Opens bidirectional Live session on Vertex AI with Gemini Live.
- TwilioAudioAdapter converts:
  - Inbound: 8 kHz mu-law -> 16 kHz 16-bit linear PCM (ratecv with state).
  - Outbound: 24 kHz linear PCM -> 8 kHz mu-law in strict 160-byte frames (20 ms).
  - User interruption: sends Twilio 'clear' message and flushes buffer.
- Handles record_reply tool call:
  - Validates intent ('COMING', 'CANT', 'STOP', 'UNCLEAR'), etaMinutes (0..240), and quote (<=120 chars).
  - Applies state transitions via transitions.py in transactions (source='gemini_live').
  - Responds with {applied, sayThis} using deterministic code-selected phrases.
  - Updates etaMinutes and quote on Call record.
  - Closes session after model turn completes or 6 seconds.
- Enforces guardrails:
  - Ignored if called after 45 seconds or after session closed.
  - Transcripts kept in memory only (never written to disk or database).
  - No raw audio stored.
"""

import asyncio
import audioop
import base64
import contextlib
import json
import logging
from collections.abc import Callable
from pathlib import Path
from typing import Any, Protocol, runtime_checkable
from uuid import uuid4

from fastapi import WebSocket
from google import genai
from google.genai import types

from app.clock.service import get_clock
from app.core.config import get_settings
from app.core.store import Store, TransactionStore, get_store
from app.requests.models import BloodRequest, Call, CallState, RequestStatus, TimelineEvent
from app.requests.transitions import (
    IllegalTransition,
    Intent,
    apply_press_1,
    apply_press_2,
    apply_press_9,
)

logger = logging.getLogger("u2u.voice.live")

# Path to live system prompt template
_PROMPT_PATH = Path(__file__).resolve().parent.parent.parent / "prompts" / "live_call_v1.md"


def build_record_reply_tool() -> types.Tool:
    """Declares the record_reply function declaration for donor response recording."""
    return types.Tool(
        function_declarations=[
            types.FunctionDeclaration(
                name="record_reply",
                description="Records the donor response intent, arrival ETA, and verbatim quote.",
                parameters=types.Schema(
                    type=types.Type.OBJECT,
                    properties={
                        "intent": types.Schema(
                            type=types.Type.STRING,
                            enum=["COMING", "CANT", "STOP", "UNCLEAR"],
                            description="The extracted intent of the donor response.",
                        ),
                        "etaMinutes": types.Schema(
                            type=types.Type.INTEGER,
                            nullable=True,
                            description="Estimated arrival time in minutes if coming, else null.",
                        ),
                        "quote": types.Schema(
                            type=types.Type.STRING,
                            description="Exact verbatim phrase or quote spoken by the donor.",
                        ),
                    },
                    required=["intent", "quote"],
                ),
            )
        ]
    )


def load_live_instruction(request: BloodRequest | None, lang: str) -> str:
    """Loads and formats the system instruction for Gemini Live donor calls."""
    if _PROMPT_PATH.exists():
        template = _PROMPT_PATH.read_text(encoding="utf-8")
    else:
        template = (
            "You are calling on behalf of {centreName}. A patient at {hospitalName} "
            "needs {bloodGroup} {component}. Ask if the donor can come, cannot, or wants "
            "to stop calls, and their ETA in minutes. Reply in {donorLanguageName}."
        )

    centre_name = (request.centre_name if request else None) or "Sample Blood Centre"
    hospital_name = (request.hospital_name if request else None) or "Sample General Hospital"
    blood_group = (
        request.blood_group.value
        if request and hasattr(request.blood_group, "value")
        else str(request.blood_group if request else "O+")
    )
    component = (
        request.component.value
        if request and hasattr(request.component, "value")
        else str(request.component if request else "RED_CELLS")
    )
    centre_area = "Chennai"

    donor_lang = "Tamil" if lang == "ta" else "English"

    return template.format(
        centreName=centre_name,
        hospitalName=hospital_name,
        bloodGroup=blood_group,
        component=component,
        centreArea=centre_area,
        donorLanguageName=donor_lang,
    )


@runtime_checkable
class AudioAdapter(Protocol):
    """Abstract interface for audio ingestion and streaming."""

    async def send_input_chunk(self, raw_chunk: bytes) -> None:
        """Processes incoming caller audio and sends to Gemini Live session."""
        ...

    async def send_output_audio(self, pcm_24k: bytes) -> None:
        """Processes 24 kHz PCM from Gemini and sends to caller."""
        ...

    async def handle_interrupted(self) -> None:
        """Handles donor interruption event."""
        ...

    async def flush(self) -> None:
        """Flushes remaining audio frames."""
        ...

    async def close(self) -> None:
        """Closes adapter resources."""
        ...


class TwilioAudioAdapter:
    """Twilio WebSocket audio adapter.

    Translates between Twilio telephony audio (8 kHz mu-law, 160B frames)
    and Gemini Multimodal Live audio (16 kHz PCM in, 24 kHz PCM out).
    """

    def __init__(self, websocket: WebSocket, stream_sid: str) -> None:
        self.websocket = websocket
        self.stream_sid = stream_sid
        self._in_ratecv_state: Any = None
        self._out_ratecv_state: Any = None
        self._out_buffer = bytearray()
        self._session: Any = None
        self.frames_sent = 0

    def set_session(self, session: Any) -> None:
        """Binds the active Live session for forwarding input audio."""
        self._session = session

    def process_inbound_mulaw(self, mulaw_bytes: bytes) -> bytes:
        """Converts 8 kHz mu-law to 16 kHz 16-bit linear PCM."""
        if not mulaw_bytes:
            return b""
        pcm_8k = audioop.ulaw2lin(mulaw_bytes, 2)
        pcm_16k, self._in_ratecv_state = audioop.ratecv(
            pcm_8k, 2, 1, 8000, 16000, self._in_ratecv_state
        )
        return pcm_16k

    async def send_input_chunk(self, raw_chunk: bytes) -> None:
        """Processes incoming 8 kHz mu-law chunk and forwards as 16 kHz PCM to Gemini."""
        if not self._session or not raw_chunk:
            return
        pcm_16k = self.process_inbound_mulaw(raw_chunk)
        if pcm_16k:
            await self._session.send_realtime_input(
                media=types.Blob(data=pcm_16k, mime_type="audio/pcm;rate=16000")
            )

    async def send_output_audio(self, pcm_24k: bytes) -> None:
        """Converts Gemini 24 kHz PCM to 8 kHz mu-law and streams in 160-byte frames."""
        if not pcm_24k:
            return
        pcm_8k, self._out_ratecv_state = audioop.ratecv(
            pcm_24k, 2, 1, 24000, 8000, self._out_ratecv_state
        )
        mulaw = audioop.lin2ulaw(pcm_8k, 2)
        self._out_buffer.extend(mulaw)

        while len(self._out_buffer) >= 160:
            frame = bytes(self._out_buffer[:160])
            del self._out_buffer[:160]
            await self._send_twilio_media(frame)

    async def handle_interrupted(self) -> None:
        """Clears outgoing audio buffer and sends Twilio 'clear' message."""
        self._out_buffer.clear()
        self._out_ratecv_state = None
        msg = {
            "event": "clear",
            "streamSid": self.stream_sid,
        }
        await self.websocket.send_text(json.dumps(msg))

    async def flush(self) -> None:
        """Pads and flushes any pending residual audio bytes so all frames are 160 bytes."""
        if len(self._out_buffer) > 0:
            remainder = len(self._out_buffer) % 160
            if remainder > 0:
                self._out_buffer.extend(b"\xff" * (160 - remainder))
            while len(self._out_buffer) >= 160:
                frame = bytes(self._out_buffer[:160])
                del self._out_buffer[:160]
                await self._send_twilio_media(frame)

    async def _send_twilio_media(self, frame_160: bytes) -> None:
        if len(frame_160) != 160:
            raise ValueError(f"Twilio media frame must be exactly 160 bytes, got {len(frame_160)}")
        payload = base64.b64encode(frame_160).decode("ascii")
        msg = {
            "event": "media",
            "streamSid": self.stream_sid,
            "media": {"payload": payload},
        }
        await self.websocket.send_text(json.dumps(msg))
        self.frames_sent += 1

    async def close(self) -> None:
        await self.flush()


class LiveBridge:
    """Manages a Gemini Multimodal Live session attached to a donor call."""

    def __init__(
        self,
        call: Call,
        lang: str,
        audio_adapter: AudioAdapter,
        request: BloodRequest | None = None,
        store: Store | None = None,
        clock: Any | None = None,
        session_factory: Callable[..., Any] | None = None,
    ) -> None:
        self.call = call
        self.lang = lang
        self.audio_adapter = audio_adapter
        self.request = request
        self.store = store or get_store()
        self.clock = clock or get_clock()
        self.session_factory = session_factory

        self.session: Any = None
        self._cm: Any = None
        self._receive_task: asyncio.Task[None] | None = None
        self._close_task: asyncio.Task[None] | None = None

        self.tool_called_event = asyncio.Event()
        self.turn_completed_event = asyncio.Event()
        self.donor_turns_count = 0
        self.is_closed = False
        self.start_time: float | None = None

        self.tool_result: dict[str, Any] | None = None
        # Transcripts kept in memory only — never persisted or written to disk
        self.input_transcripts: list[str] = []
        self.output_transcripts: list[str] = []

    async def start(self) -> None:
        """Opens the Live session and starts background receive loop."""
        settings = get_settings()
        self.start_time = self.clock.now().timestamp()
        instruction = load_live_instruction(self.request, self.lang)

        config = types.LiveConnectConfig(
            response_modalities=[types.Modality.AUDIO],
            system_instruction=types.Content(parts=[types.Part.from_text(text=instruction)]),
            tools=[build_record_reply_tool()],
            input_audio_transcription=types.AudioTranscriptionConfig(),
            output_audio_transcription=types.AudioTranscriptionConfig(),
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name="Puck")
                )
            ),
        )

        if self.session_factory is not None:
            factory_res = self.session_factory(self)
            if asyncio.iscoroutine(factory_res):
                self.session = await factory_res
            else:
                self.session = factory_res
        else:
            client = genai.Client(
                vertexai=True,
                project=settings.GOOGLE_CLOUD_PROJECT or "uyir2uyir-53929",
                location=settings.LIVE_LOCATION,
                http_options=types.HttpOptions(api_version="v1"),
            )
            self._cm = client.aio.live.connect(model=settings.LIVE_MODEL, config=config)
            self.session = await self._cm.__aenter__()

        if hasattr(self.audio_adapter, "set_session"):
            self.audio_adapter.set_session(self.session)

        self._receive_task = asyncio.create_task(self._receive_loop())

    async def send_input_chunk(self, raw_chunk: bytes) -> None:
        """Forwards incoming audio chunk to audio adapter."""
        if self.is_closed:
            return
        await self.audio_adapter.send_input_chunk(raw_chunk)

    async def _receive_loop(self) -> None:
        """Receives events, transcripts, audio, and tool calls from Gemini Live."""
        try:
            async for msg in self.session.receive():
                if self.is_closed:
                    break

                sc = getattr(msg, "server_content", None)
                if sc:
                    if getattr(sc, "interrupted", False):
                        await self.audio_adapter.handle_interrupted()

                    in_tx = getattr(sc, "input_transcription", None)
                    if in_tx and getattr(in_tx, "text", None):
                        self.input_transcripts.append(in_tx.text)

                    out_tx = getattr(sc, "output_transcription", None)
                    if out_tx and getattr(out_tx, "text", None):
                        self.output_transcripts.append(out_tx.text)

                    mt = getattr(sc, "model_turn", None)
                    if mt and getattr(mt, "parts", None):
                        for part in mt.parts:
                            inline = getattr(part, "inline_data", None)
                            if inline and getattr(inline, "data", None):
                                await self.audio_adapter.send_output_audio(inline.data)

                    if getattr(sc, "turn_complete", False):
                        self.turn_completed_event.set()
                        if not self.tool_called_event.is_set():
                            self.donor_turns_count += 1

                tc = getattr(msg, "tool_call", None)
                if tc and getattr(tc, "function_calls", None):
                    for fc in tc.function_calls:
                        if fc.name == "record_reply":
                            await self._handle_record_reply(fc)
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.warning("Live session receive loop exception for call %s: %s", self.call.id, e)

    async def _handle_record_reply(self, fc: Any) -> None:
        """Validates and executes record_reply tool call from Gemini Live."""
        # 1. Ignore if session closed or elapsed > 45s
        if self.is_closed:
            return
        if self.start_time is not None:
            elapsed = self.clock.now().timestamp() - self.start_time
            if elapsed > 45.0:
                logger.info("Ignoring record_reply after %.1fs (exceeded 45s limit)", elapsed)
                return

        self.tool_called_event.set()
        args = fc.args or {}

        # 2. Argument validation
        raw_intent = str(args.get("intent", "")).upper().strip()
        if raw_intent not in ("COMING", "CANT", "STOP", "UNCLEAR"):
            intent = "UNCLEAR"
        else:
            intent = raw_intent

        eta_raw = args.get("etaMinutes")
        if isinstance(eta_raw, (int, float)) and 0 <= int(eta_raw) <= 240:
            eta_minutes: int | None = int(eta_raw)
        else:
            eta_minutes = None

        raw_quote = str(args.get("quote", "")).strip()
        quote = raw_quote[:120] if raw_quote else ""

        applied = False
        centre_name = (self.request.centre_name if self.request else None) or "Blood Centre"
        say_this = "Thank you."
        now_iso = self.clock.now_iso()

        # 3. Apply state transition in store transaction
        if intent == "COMING":

            async def _tx_coming(tx: TransactionStore) -> None:
                nonlocal applied, say_this
                req = await tx.get_request(self.call.request_id)
                if not req:
                    return
                c = await tx.get_call(self.call.request_id, self.call.id)
                if not c:
                    return

                # Idempotent apply: already applied
                if c.state in (CallState.ON_THE_WAY, CallState.LATE_ACCEPT):
                    applied = True
                    say_this = (
                        "Thank you, we already have enough donors."
                        if c.state == CallState.LATE_ACCEPT
                        else f"Thank you. Please go to {centre_name}. Staff will check you on arrival."
                    )
                    return

                try:
                    res = apply_press_1(req, c, timestamp=now_iso)
                    updated_call = res.call.model_copy(
                        update={"eta_minutes": eta_minutes, "quote": quote}
                    )
                    await tx.save_request(res.request)
                    await tx.save_call(self.call.request_id, updated_call)

                    eta_str = f"about {eta_minutes} min, " if eta_minutes is not None else ""
                    quote_str = f"'{quote}'" if quote else "no quote"
                    live_event = TimelineEvent(
                        id=f"evt-{uuid4().hex[:8]}",
                        request_id=self.call.request_id,
                        at=now_iso,
                        kind="DONOR_ON_THE_WAY",
                        text=f"{self.call.donor_alias} talked to Gemini: COMING, {eta_str}{quote_str}",
                    )
                    await tx.append_event(self.call.request_id, live_event)

                    if (
                        res.request.status == RequestStatus.PAUSED
                        and req.status != RequestStatus.PAUSED
                    ):
                        pause_event = TimelineEvent(
                            id=f"evt-{uuid4().hex[:8]}",
                            request_id=self.call.request_id,
                            at=now_iso,
                            kind="REQUEST_PAUSED",
                            text=f"Request paused: {res.request.on_the_way + res.request.accepted} covered (N+1 reached).",
                        )
                        await tx.append_event(self.call.request_id, pause_event)

                    applied = True
                    if (
                        Intent.PLAY_ENOUGH_MESSAGE in res.side_effects
                        or updated_call.state == CallState.LATE_ACCEPT
                    ):
                        say_this = "Thank you, we already have enough donors."
                    else:
                        say_this = f"Thank you. Please go to {centre_name}. Staff will check you on arrival."
                except IllegalTransition:
                    applied = False

            await self.store.run_transaction(_tx_coming)

        elif intent == "CANT":

            async def _tx_cant(tx: TransactionStore) -> None:
                nonlocal applied, say_this
                req = await tx.get_request(self.call.request_id)
                if not req:
                    return
                c = await tx.get_call(self.call.request_id, self.call.id)
                if not c:
                    return

                if c.state in (CallState.DECLINED, CallState.CANCELLED):
                    applied = True
                    say_this = "Thank you for telling us."
                    return

                try:
                    res = apply_press_2(req, c, timestamp=now_iso)
                    updated_call = res.call.model_copy(update={"quote": quote})
                    await tx.save_call(self.call.request_id, updated_call)

                    quote_str = f"'{quote}'" if quote else "no quote"
                    live_event = TimelineEvent(
                        id=f"evt-{uuid4().hex[:8]}",
                        request_id=self.call.request_id,
                        at=now_iso,
                        kind="DONOR_DECLINED",
                        text=f"{self.call.donor_alias} talked to Gemini: CANT, {quote_str}",
                    )
                    await tx.append_event(self.call.request_id, live_event)
                    applied = True
                    say_this = "Thank you for telling us."
                except IllegalTransition:
                    applied = False

            await self.store.run_transaction(_tx_cant)

        elif intent == "STOP":
            parts = self.call.id.split("_", 2)
            donor_id = parts[2] if len(parts) >= 3 else self.call.id

            async def _tx_stop(tx: TransactionStore) -> None:
                nonlocal applied, say_this
                req = await tx.get_request(self.call.request_id)
                if not req:
                    return
                c = await tx.get_call(self.call.request_id, self.call.id)
                if not c:
                    return

                if c.state == CallState.OPTED_OUT:
                    applied = True
                    say_this = "You won't be called again."
                    return

                try:
                    res = apply_press_9(req, c, timestamp=now_iso)
                    updated_call = res.call.model_copy(update={"quote": quote})
                    await tx.save_call(self.call.request_id, updated_call)

                    donor = await tx.get_donor(donor_id)
                    if donor:
                        updated_donor = donor.model_copy(
                            update={"consent_urgent": False, "active": False}
                        )
                        await tx.save_donor(updated_donor)

                    lang_val = (
                        self.call.lang.value
                        if hasattr(self.call.lang, "value")
                        else str(self.call.lang)
                    )
                    await tx.append_consent_event(
                        donor_id,
                        {
                            "id": f"c-evt-{uuid4().hex[:8]}",
                            "donorId": donor_id,
                            "purpose": "urgent_contact",
                            "granted": False,
                            "action": "WITHDRAW",
                            "noticeVersion": "v1",
                            "language": lang_val,
                            "channel": "gemini_live",
                            "at": now_iso,
                        },
                    )

                    quote_str = f"'{quote}'" if quote else "no quote"
                    live_event = TimelineEvent(
                        id=f"evt-{uuid4().hex[:8]}",
                        request_id=self.call.request_id,
                        at=now_iso,
                        kind="DONOR_OPTED_OUT",
                        text=f"{self.call.donor_alias} talked to Gemini: STOP, {quote_str}",
                    )
                    await tx.append_event(self.call.request_id, live_event)
                    applied = True
                    say_this = "You won't be called again."
                except IllegalTransition:
                    applied = False

            await self.store.run_transaction(_tx_stop)

        elif intent == "UNCLEAR":
            applied = False
            say_this = "Thank you."

        self.tool_result = {
            "intent": intent,
            "etaMinutes": eta_minutes,
            "quote": quote,
            "applied": applied,
            "sayThis": say_this,
        }

        # 4. Respond to tool call
        call_id_param = getattr(fc, "id", None) or "record_reply_call"
        await self.session.send_tool_response(
            function_responses=[
                types.FunctionResponse(
                    name=fc.name,
                    id=call_id_param,
                    response={"applied": applied, "sayThis": say_this},
                )
            ]
        )

        # 5. After turn completes or 6 seconds, close session to end call
        self.turn_completed_event.clear()

        async def _delayed_close() -> None:
            with contextlib.suppress(TimeoutError, asyncio.CancelledError):
                await asyncio.wait_for(self.turn_completed_event.wait(), timeout=6.0)
            await self.close()

        self._close_task = asyncio.create_task(_delayed_close())

    async def close(self) -> None:
        """Closes the Live session, flushes audio, and updates daily calling quota."""
        if self.is_closed:
            return
        self.is_closed = True

        if self._receive_task and not self._receive_task.done():
            self._receive_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._receive_task
        if (
            self._close_task
            and not self._close_task.done()
            and asyncio.current_task() != self._close_task
        ):
            self._close_task.cancel()
            with contextlib.suppress(asyncio.CancelledError):
                await self._close_task

        if hasattr(self.audio_adapter, "flush"):
            with contextlib.suppress(Exception):
                await self.audio_adapter.flush()

        if self.session:
            try:
                if hasattr(self.session, "close"):
                    await self.session.close()
                elif hasattr(self, "_cm") and self._cm:
                    await self._cm.__aexit__(None, None, None)
            except Exception as e:
                logger.debug("Exception closing session: %s", e)

        # Update daily minutes quota
        if self.start_time is not None:
            elapsed_sec = self.clock.now().timestamp() - self.start_time
            if elapsed_sec > 0:
                elapsed_mins = elapsed_sec / 60.0
                try:
                    app_conf = await self.store.get_config("app") or {}
                    today_str = self.clock.now().strftime("%Y-%m-%d")
                    stored_date = app_conf.get("liveMinutesDate")
                    current_mins = (
                        app_conf.get("liveMinutesToday", 0.0) if stored_date == today_str else 0.0
                    )
                    app_conf["liveMinutesToday"] = current_mins + elapsed_mins
                    app_conf["liveMinutesDate"] = today_str
                    await self.store.set_config("app", app_conf)
                except Exception as e:
                    logger.debug("Could not update liveMinutesToday: %s", e)
