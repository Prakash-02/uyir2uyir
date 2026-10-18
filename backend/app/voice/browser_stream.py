"""WebSocket handler for browser-based Gemini Live calls on /sim.

Allows judges and users on the demo site to take ringing calls via their microphone:
- WebSocket endpoint: WS /sim/live/{callId}
- Demo mode only: closes with policy violation in live mode.
- Authenticates first message: {"type":"auth","idToken":...} with a valid demo token.
- Verifies call is in RINGING state.
- Streams 24 kHz Cloud TTS opening audio to the browser.
- Hands over to LiveBridge using BrowserAudioAdapter (16 kHz PCM in, 24 kHz PCM out).
- Live speech captions: {"type":"transcript","who":"donor|gemini","text":...} (in-memory only).
- Tool results: {"type":"result","intent":...,"etaMinutes":...,"quote":...,"applied":...}.
- Keypad override at any time: {"type":"key","digit":"1|2|9"} immediately closes Live session,
  applies transition in transaction, streams closing audio, and terminates call.
- Limits and fallbacks:
  - 3.0s connect timeout -> fallback to keypad prompt.
  - 45s max duration or 3 donor turns without a tool call -> UNCLEAR result, closing audio, ends.
  - Mid-call drop -> fallback to keypad prompt.
  - Quota cap: checked against LIVE_DAILY_MINUTES.
"""

import asyncio
import base64
import json
import logging
from collections.abc import Callable
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, status

from app.ai.tts import synthesize_stream_audio
from app.auth.dependencies import verify_token
from app.clock.service import get_clock
from app.core.config import get_settings
from app.core.store import Store, TransactionStore, get_store
from app.matching.service import select_donors_for_request
from app.outreach.service import dispatch_round_calls, get_telephony_adapter
from app.requests.models import BloodRequest, Call, CallState, TimelineEvent
from app.requests.transitions import (
    IllegalTransition,
    Intent,
    apply_press_1,
    apply_press_2,
    apply_press_9,
    apply_reminder_press_2,
)
from app.voice.live_session import BrowserAudioAdapter, LiveBridge

logger = logging.getLogger("u2u.voice.browser")

router = APIRouter(tags=["Browser Live Voice"])

LIVE_OPEN_TIMEOUT_SECONDS: float = 3.0
LIVE_CALL_MAX_SECONDS: float = 45.0

# Optional factory override for unit testing with fake live sessions
_BROWSER_LIVE_SESSION_FACTORY: Callable[..., Any] | None = None


def set_browser_live_session_factory(factory: Callable[..., Any] | None) -> None:
    """Sets a global factory for creating live sessions in tests."""
    global _BROWSER_LIVE_SESSION_FACTORY
    _BROWSER_LIVE_SESSION_FACTORY = factory


async def stream_pcm24k_audio(
    websocket: WebSocket,
    audio_bytes: bytes,
    chunk_size: int = 4800,  # 100 ms of 24 kHz 16-bit mono PCM (2400 samples * 2 bytes)
    chunk_delay: float = 0.0,
    stop_event: asyncio.Event | None = None,
) -> None:
    """Streams 24 kHz linear PCM audio chunks to the browser as JSON messages."""
    for i in range(0, len(audio_bytes), chunk_size):
        if stop_event and stop_event.is_set():
            break
        chunk = audio_bytes[i : i + chunk_size]
        payload = base64.b64encode(chunk).decode("ascii")
        msg = {
            "type": "audio",
            "pcm24k": payload,
        }
        await websocket.send_text(json.dumps(msg))
        if chunk_delay > 0:
            await asyncio.sleep(chunk_delay)


async def check_live_daily_quota(store: Store, clock: Any, max_minutes: int) -> bool:
    """Returns True if within daily live quota, False if cap is reached."""
    try:
        app_conf = await store.get_config("app") or {}
        today_str = clock.now().strftime("%Y-%m-%d")
        stored_date = app_conf.get("liveMinutesDate")
        current_mins = app_conf.get("liveMinutesToday", 0.0) if stored_date == today_str else 0.0
        return current_mins < max_minutes
    except Exception:
        return True


@router.websocket("/sim/live/{call_id}")
async def sim_live_websocket(websocket: WebSocket, call_id: str) -> None:
    """WebSocket endpoint for browser-based Gemini Live calls on /sim."""
    settings = get_settings()

    # 1. Demo mode only: close with policy violation if live
    if settings.DATA_MODE != "demo":
        logger.warning("Attempted to connect to /sim/live in non-demo mode; rejecting.")
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    await websocket.accept()

    # 2. First message must be auth with idToken
    try:
        first_msg_raw = await asyncio.wait_for(websocket.receive_text(), timeout=5.0)
        first_msg = json.loads(first_msg_raw)
    except Exception as e:
        logger.warning("Failed receiving initial auth message for %s: %s", call_id, e)
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    if first_msg.get("type") != "auth" or not first_msg.get("idToken"):
        logger.warning("First message for %s was not auth; closing", call_id)
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    id_token = str(first_msg["idToken"])
    try:
        decoded = verify_token(id_token)
        env = decoded.get("env")
        if env is not None and env != settings.DATA_MODE:
            logger.warning("Environment mismatch on token for %s: %s != demo", call_id, env)
            await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
            return
    except Exception as e:
        logger.warning("Invalid authentication token for %s: %s", call_id, e)
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # 3. Verify call exists and is in RINGING state
    parts = call_id.split("_", 2)
    if len(parts) < 3:
        logger.warning("Malformed call_id for /sim/live: %s", call_id)
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    request_id = parts[0]
    donor_id = parts[2]

    store = get_store()
    clock = get_clock()

    req = await store.get_request(request_id)
    call_obj = await store.get_call(request_id, call_id) if req else None

    if not req or not call_obj or call_obj.state != CallState.RINGING:
        logger.warning(
            "Call %s is not in RINGING state (state=%s); closing",
            call_id,
            call_obj.state if call_obj else "not_found",
        )
        await websocket.close(code=status.WS_1008_POLICY_VIOLATION)
        return

    # Call parameters
    call_lang = call_obj.lang.value if hasattr(call_obj.lang, "value") else str(call_obj.lang)
    donor_alias = call_obj.donor_alias
    blood_group_str = (
        req.blood_group.value if hasattr(req.blood_group, "value") else str(req.blood_group)
    )
    component_str = req.component.value if hasattr(req.component, "value") else str(req.component)
    centre_name_str = req.centre_name or req.hospital_name or "Blood Centre"

    app_conf = await store.get_config("app") or {}
    weather_alert = bool(app_conf.get("weatherAlert", False))

    # Control events
    stop_playback = asyncio.Event()
    keypad_pressed = asyncio.Event()
    call_ended = asyncio.Event()

    adapter = BrowserAudioAdapter(websocket)
    live_bridge: LiveBridge | None = None
    live_watcher_task: asyncio.Task[None] | None = None

    async def _watch_live_session(bridge: LiveBridge) -> None:
        """Monitors live session duration, turns, and completion."""
        start_t = clock.now().timestamp()
        try:
            while not bridge.is_closed and not keypad_pressed.is_set() and not call_ended.is_set():
                await asyncio.sleep(0.5)
                elapsed = clock.now().timestamp() - start_t

                # 1. Did tool call complete cleanly?
                if bridge.tool_called_event.is_set() and bridge.is_closed:
                    logger.info("Live bridge tool call completed for browser call %s", call_id)
                    await adapter.send_ended()
                    await websocket.close()
                    return

                # 2. Check 45s total or 3 donor turns without a tool call -> UNCLEAR
                if not bridge.tool_called_event.is_set() and (
                    elapsed >= LIVE_CALL_MAX_SECONDS or bridge.donor_turns_count >= 3
                ):
                    logger.info(
                        "Live session limit reached (elapsed=%.1fs, turns=%d) for browser call %s; UNCLEAR",
                        elapsed,
                        bridge.donor_turns_count,
                        call_id,
                    )
                    await bridge.close()
                    await store.append_event(
                        request_id,
                        TimelineEvent(
                            id=f"evt-{uuid4().hex[:8]}",
                            request_id=request_id,
                            at=clock.now_iso(),
                            kind="CALL_UNCLEAR",
                            text=f"{donor_alias} talked to Gemini: UNCLEAR, no decision after 45s",
                        ),
                    )
                    await adapter.send_result(
                        intent="UNCLEAR",
                        eta_minutes=None,
                        quote="",
                        applied=False,
                    )
                    closing_audio = await synthesize_stream_audio(
                        "closing_cant",
                        lang=call_lang,
                        centre_name=centre_name_str,
                        output_format="pcm_24k",
                    )
                    await stream_pcm24k_audio(websocket, closing_audio)
                    await adapter.send_ended()
                    await websocket.close()
                    return

                # 3. Session dropped mid-call unexpectedly before tool call
                if (
                    bridge.is_closed
                    and not bridge.tool_called_event.is_set()
                    and not keypad_pressed.is_set()
                    and not call_ended.is_set()
                ):
                    logger.warning(
                        "Gemini Live session dropped mid-call for browser call %s", call_id
                    )
                    await adapter.send_fallback("session_dropped")
                    keypad_audio = await synthesize_stream_audio(
                        "keypad_prompt",
                        lang=call_lang,
                        output_format="pcm_24k",
                    )
                    await stream_pcm24k_audio(websocket, keypad_audio, stop_event=stop_playback)
                    return
        except asyncio.CancelledError:
            pass
        except Exception as e:
            logger.debug("Live watcher exception for browser call %s: %s", call_id, e)

    # 4. Check Daily Minutes Quota
    within_quota = await check_live_daily_quota(store, clock, settings.LIVE_DAILY_MINUTES)

    # 5. Play fixed opening audio (24 kHz PCM)
    opening_audio = await synthesize_stream_audio(
        "opening",
        lang=call_lang,
        blood_group=blood_group_str,
        component=component_str,
        centre_name=centre_name_str,
        weather_alert=weather_alert,
        output_format="pcm_24k",
    )
    await stream_pcm24k_audio(websocket, opening_audio, stop_event=stop_playback)

    # 6. Hand over to Gemini Live session if within quota
    if not stop_playback.is_set():
        if within_quota:
            try:
                live_bridge = LiveBridge(
                    call=call_obj,
                    lang=call_lang,
                    audio_adapter=adapter,
                    request=req,
                    store=store,
                    clock=clock,
                    session_factory=_BROWSER_LIVE_SESSION_FACTORY,
                )
                await asyncio.wait_for(live_bridge.start(), timeout=LIVE_OPEN_TIMEOUT_SECONDS)
                live_watcher_task = asyncio.create_task(_watch_live_session(live_bridge))
                logger.info("Gemini Live session connected for browser call %s", call_id)
            except Exception as e:
                logger.warning(
                    "Gemini Live session open failed or timed out for browser call %s: %s; fallback",
                    call_id,
                    e,
                )
                await store.append_event(
                    request_id,
                    TimelineEvent(
                        id=f"evt-{uuid4().hex[:8]}",
                        request_id=request_id,
                        at=clock.now_iso(),
                        kind="LIVE_FALLBACK",
                        text="Gemini Live unavailable, keypad used",
                    ),
                )
                live_bridge = None
                await adapter.send_fallback("connection_failed")
                keypad_audio = await synthesize_stream_audio(
                    "keypad_prompt",
                    lang=call_lang,
                    output_format="pcm_24k",
                )
                await stream_pcm24k_audio(websocket, keypad_audio, stop_event=stop_playback)
        else:
            logger.info(
                "Live daily minutes quota exceeded; browser call %s is keypad only", call_id
            )
            await adapter.send_fallback("quota_exceeded")
            keypad_audio = await synthesize_stream_audio(
                "keypad_prompt",
                lang=call_lang,
                output_format="pcm_24k",
            )
            await stream_pcm24k_audio(websocket, keypad_audio, stop_event=stop_playback)

    # 7. Receiver loop: audio chunks, keypad overrides, end call
    try:
        while True:
            text = await websocket.receive_text()
            try:
                msg = json.loads(text)
            except Exception:
                continue

            msg_type = msg.get("type")

            # A. Audio input from browser microphone (16 kHz PCM)
            if msg_type == "audio":
                if live_bridge and not live_bridge.is_closed:
                    pcm16k_b64 = msg.get("pcm16k")
                    if pcm16k_b64:
                        try:
                            pcm_bytes = base64.b64decode(pcm16k_b64)
                            await live_bridge.send_input_chunk(pcm_bytes)
                        except Exception as e:
                            logger.debug("Error decoding or sending pcm16k: %s", e)
                continue

            # B. Keypad override (1, 2, 9)
            if msg_type == "key":
                digit = str(msg.get("digit", "")).strip()
                if digit not in ("1", "2", "9"):
                    continue

                keypad_pressed.set()
                stop_playback.set()

                # Close live session immediately
                if live_bridge:
                    await live_bridge.close()
                    live_bridge = None
                if live_watcher_task and not live_watcher_task.done():
                    live_watcher_task.cancel()

                # Dispatch clear to browser
                await adapter.handle_interrupted()

                now_iso = clock.now_iso()
                should_dispatch_round = False
                chosen_closing = "closing_cant"

                def _build_dtmf_handler(
                    d: str, ts: str, target_req: BloodRequest, target_call: Call
                ):
                    async def _handler(tx: TransactionStore) -> Call | None:
                        nonlocal should_dispatch_round, chosen_closing
                        r = await tx.get_request(target_req.id)
                        if not r:
                            return None
                        c = await tx.get_call(target_req.id, target_call.id)
                        if not c:
                            return None

                        # Idempotency
                        if d == "1" and c.state in (CallState.ON_THE_WAY, CallState.LATE_ACCEPT):
                            chosen_closing = (
                                "closing_enough"
                                if c.state == CallState.LATE_ACCEPT
                                else "closing_coming"
                            )
                            return c
                        if d == "2" and c.state in (CallState.DECLINED, CallState.CANCELLED):
                            chosen_closing = "closing_cant"
                            return c
                        if d == "9" and c.state == CallState.OPTED_OUT:
                            chosen_closing = "closing_stop"
                            return c

                        try:
                            if d == "1":
                                result = apply_press_1(r, c, timestamp=ts)
                                if Intent.PLAY_ENOUGH_MESSAGE in result.side_effects:
                                    chosen_closing = "closing_enough"
                                else:
                                    chosen_closing = "closing_coming"
                            elif d == "2":
                                chosen_closing = "closing_cant"
                                if c.state == CallState.ON_THE_WAY:
                                    result = apply_reminder_press_2(r, c, timestamp=ts)
                                else:
                                    result = apply_press_2(r, c, timestamp=ts)
                            elif d == "9":
                                chosen_closing = "closing_stop"
                                result = apply_press_9(r, c, timestamp=ts)

                                donor = await tx.get_donor(donor_id)
                                if donor:
                                    updated_donor = donor.model_copy(
                                        update={"consent_urgent": False, "active": False}
                                    )
                                    await tx.save_donor(updated_donor)

                                lang_val = c.lang.value if hasattr(c.lang, "value") else str(c.lang)
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
                                        "channel": "browser_keypad",
                                        "at": ts,
                                    },
                                )
                            else:
                                return None

                            if result.call:
                                await tx.save_call(target_req.id, result.call)
                            await tx.save_request(result.request)
                            for event in result.timeline_events:
                                await tx.append_event(target_req.id, event)
                            for other_call in result.other_calls:
                                await tx.save_call(target_req.id, other_call)

                            if Intent.START_ROUND in result.side_effects:
                                should_dispatch_round = True

                            return result.call
                        except IllegalTransition:
                            return None

                    return _handler

                await store.run_transaction(_build_dtmf_handler(digit, now_iso, req, call_obj))

                if should_dispatch_round:
                    refreshed_req = await store.get_request(request_id)
                    if refreshed_req:
                        donors = await select_donors_for_request(
                            store, refreshed_req, clock=clock, limit=5
                        )
                        tel_adapter = await get_telephony_adapter(store, clock=clock)
                        await dispatch_round_calls(
                            store, refreshed_req, donors, tel_adapter, clock=clock
                        )

                closing_audio = await synthesize_stream_audio(
                    chosen_closing,
                    lang=call_lang,
                    centre_name=centre_name_str,
                    output_format="pcm_24k",
                )
                await stream_pcm24k_audio(websocket, closing_audio)
                await adapter.send_ended()
                await websocket.close()
                return

            # C. Call ended by user
            if msg_type == "end":
                call_ended.set()
                stop_playback.set()
                if live_bridge:
                    await live_bridge.close()
                    live_bridge = None
                if live_watcher_task and not live_watcher_task.done():
                    live_watcher_task.cancel()

                await adapter.send_ended()
                await websocket.close()
                return

    except (WebSocketDisconnect, asyncio.CancelledError):
        pass
    except Exception as e:
        logger.debug("Browser stream exception for call %s: %s", call_id, e)
    finally:
        stop_playback.set()
        if live_bridge:
            await live_bridge.close()
        if live_watcher_task and not live_watcher_task.done():
            live_watcher_task.cancel()
