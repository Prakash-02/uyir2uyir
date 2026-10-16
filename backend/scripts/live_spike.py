#!/usr/bin/env python3
"""Gemini Live API Spike Script for U2U (Uyir2Uyir).

Tests Vertex AI Multimodal Live API capabilities for automated emergency blood donor calling:
1. Probes live-capable model 'gemini-live-2.5-flash-native-audio' across global, us-central1, asia-south1.
2. Generates test voice clips via Cloud Text-to-Speech (ta-IN, en-IN decline, en-IN opt-out).
3. Connects to Gemini Live with bidirectional audio, input/output transcription, and record_reply tool.
4. Streams audio in 20 ms chunks (640 bytes @ 16 kHz 16-bit PCM) via session.send_realtime_input.
5. Converts Tamil clip to 8 kHz mu-law and back via audioop to verify telephony quality resilience.
6. Acknowledges tool calls via session.send_tool_response.
7. Confirms Request Desk model via generate_content.
8. Prints detailed measurements and a summary table.
"""

import asyncio
import audioop
import os
import sys
import time
from pathlib import Path
from typing import Any

from google import genai
from google.cloud import texttospeech
from google.genai import types

# Ensure UTF-8 output on Windows consoles
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

# Ensure backend directory is in sys.path
BACKEND_DIR = Path(__file__).resolve().parent.parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import Settings, get_settings  # noqa: E402

PROJECT_ID = "uyir2uyir-53929"
MODEL_NAME = "gemini-live-2.5-flash-native-audio"
LOCATIONS_TO_TRY = ["global", "us-central1", "asia-south1"]

CHUNK_DURATION_MS = 20
SAMPLE_RATE = 16000
BYTES_PER_SAMPLE = 2  # 16-bit mono
CHUNK_BYTES = int(SAMPLE_RATE * (CHUNK_DURATION_MS / 1000.0) * BYTES_PER_SAMPLE)  # 640 bytes


def build_live_tool() -> types.Tool:
    """Declares record_reply function declaration for donor response recording."""
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


def synthesize_tts_clip(text: str, language_code: str, voice_name: str) -> bytes:
    """Synthesizes text as 16 kHz 16-bit mono LINEAR16 PCM audio via Cloud Text-to-Speech."""
    client = texttospeech.TextToSpeechClient()
    synthesis_input = texttospeech.SynthesisInput(text=text)
    voice = texttospeech.VoiceSelectionParams(
        language_code=language_code,
        name=voice_name,
    )
    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.LINEAR16,
        sample_rate_hertz=SAMPLE_RATE,
    )
    resp = client.synthesize_speech(
        input=synthesis_input,
        voice=voice,
        audio_config=audio_config,
    )
    raw_audio = resp.audio_content
    # Strip 44-byte WAV header if returned, ensuring raw PCM
    if raw_audio.startswith(b"RIFF") and len(raw_audio) > 44:
        return raw_audio[44:]
    return raw_audio


def convert_to_phone_quality(pcm_16k: bytes) -> bytes:
    """Converts 16 kHz 16-bit PCM to 8 kHz mu-law and back to 16 kHz 16-bit PCM using audioop."""
    # 1. Downsample 16 kHz -> 8 kHz (width=2, channels=1)
    pcm_8k, _ = audioop.ratecv(pcm_16k, 2, 1, 16000, 8000, None)
    # 2. Linear 16-bit -> 8-bit mu-law (G.711u telephony standard)
    mulaw = audioop.lin2ulaw(pcm_8k, 2)
    # 3. 8-bit mu-law -> Linear 16-bit @ 8 kHz
    pcm_8k_recovered = audioop.ulaw2lin(mulaw, 2)
    # 4. Upsample 8 kHz -> 16 kHz
    pcm_16k_phone, _ = audioop.ratecv(pcm_8k_recovered, 2, 1, 8000, 16000, None)
    return pcm_16k_phone


async def stream_and_evaluate(
    session: Any,
    audio_data: bytes,
    clip_name: str,
) -> dict[str, Any]:
    """Streams audio in 20 ms chunks with send_realtime_input, sends silence + stream end, and waits up to 15s."""
    print(f"\n--- Streaming clip: {clip_name} ({len(audio_data)} bytes PCM) ---")

    tool_call_name: str | None = None
    tool_args: dict[str, Any] | None = None
    input_transcript = ""
    output_transcript = ""
    audio_bytes_returned = 0
    tool_call_latency_sec: float | None = None

    # 1. Stream audio in 20 ms chunks (640 bytes)
    for offset in range(0, len(audio_data), CHUNK_BYTES):
        chunk = audio_data[offset : offset + CHUNK_BYTES]
        await session.send_realtime_input(
            media=types.Blob(data=chunk, mime_type="audio/pcm;rate=16000")
        )
        await asyncio.sleep(CHUNK_DURATION_MS / 1000.0)

    # 2. Send ~1 second of silence + audio stream end
    silence_chunk = b"\x00" * CHUNK_BYTES
    for _ in range(50):
        await session.send_realtime_input(
            media=types.Blob(data=silence_chunk, mime_type="audio/pcm;rate=16000")
        )
        await asyncio.sleep(CHUNK_DURATION_MS / 1000.0)

    await session.send_realtime_input(audio_stream_end=True)
    audio_end_time = time.time()
    print("Audio streamed (with 1s silence + audio_stream_end). Waiting up to 15s for model...")

    # 3. Receive messages up to 15 seconds
    try:
        async with asyncio.timeout(15.0):
            async for msg in session.receive():
                if msg.server_content:
                    sc = msg.server_content
                    if sc.input_transcription and sc.input_transcription.text:
                        input_transcript += sc.input_transcription.text
                    if sc.output_transcription and sc.output_transcription.text:
                        output_transcript += sc.output_transcription.text
                    if sc.model_turn:
                        for part in sc.model_turn.parts:
                            if part.text:
                                output_transcript += part.text
                            if part.inline_data and part.inline_data.data:
                                audio_bytes_returned += len(part.inline_data.data)
                    if sc.turn_complete:
                        print("Turn complete received from server.")
                        break

                if msg.tool_call and msg.tool_call.function_calls:
                    for fc in msg.tool_call.function_calls:
                        if fc.name == "record_reply":
                            tool_call_latency_sec = time.time() - audio_end_time
                            tool_call_name = fc.name
                            tool_args = fc.args
                            print(f"\n[Tool Call Received in {tool_call_latency_sec:.3f}s]")
                            print(f"  Name: {tool_call_name}")
                            print(f"  Args: {tool_args}")
                            print(f"  Input Transcription: {input_transcript}")

                            # Acknowledge tool call with send_tool_response so session finishes cleanly
                            await session.send_tool_response(
                                function_responses=[
                                    types.FunctionResponse(
                                        name=fc.name,
                                        response={"applied": True},
                                        id=fc.id,
                                    )
                                ]
                            )

    except TimeoutError:
        print("Timeout (15s) reached waiting for model response.")
    except Exception as e:
        print(f"Error during receive loop: {type(e).__name__}: {e}")

    print(f"  Returned Audio: {audio_bytes_returned} bytes")

    return {
        "clip": clip_name,
        "tool_name": tool_call_name,
        "tool_args": tool_args,
        "input_transcript": input_transcript,
        "output_transcript": output_transcript,
        "latency_sec": tool_call_latency_sec,
        "audio_bytes_returned": audio_bytes_returned,
    }


async def main() -> None:
    print("=================================================================")
    print(" U2U GEMINI MULTIMODAL LIVE SPIKE (Vertex AI & Cloud TTS)")
    print(f" Model: {MODEL_NAME}")
    print(f" SDK: google-genai {genai.__version__}")
    print(f" Locations to try: {LOCATIONS_TO_TRY}")
    print("=================================================================\n")

    # Step 3b: Try locations in order: global, us-central1, asia-south1
    working_location: str | None = None
    location_errors: dict[str, str] = {}

    for loc in LOCATIONS_TO_TRY:
        print(f"[*] Probing location '{loc}' for model '{MODEL_NAME}'...", end=" ", flush=True)
        try:
            client = genai.Client(vertexai=True, project=PROJECT_ID, location=loc)
            test_config = types.LiveConnectConfig(
                response_modalities=[types.Modality.AUDIO],
            )
            async with client.aio.live.connect(model=MODEL_NAME, config=test_config):
                print("CONNECTED!")
                working_location = loc
                break
        except Exception as exc:
            err_msg = str(exc).splitlines()[0] if str(exc) else type(exc).__name__
            print(f"FAILED ({type(exc).__name__}: {err_msg[:80]})")
            location_errors[loc] = err_msg

    if not working_location:
        print("\n" + "!" * 65)
        print("RESULT: No working location connected for", MODEL_NAME)
        for loc, err in location_errors.items():
            print(f"  - {loc}: {err}")
        print("!" * 65)
        print("\nSummary Table:")
        print(
            f"| {'Model':<35} | {'Location':<12} | {'Connects':<8} | {'Tamil':<8} | {'Phone Qual':<10} | {'CANT':<6} | {'STOP':<6} | {'Latency':<8} |"
        )
        print(
            f"|{'-' * 37}|{'-' * 14}|{'-' * 10}|{'-' * 10}|{'-' * 12}|{'-' * 8}|{'-' * 8}|{'-' * 10}|"
        )
        print(
            f"| {MODEL_NAME:<35} | {'None':<12} | {'No':<8} | {'N/A':<8} | {'N/A':<10} | {'N/A':<6} | {'N/A':<6} | {'N/A':<8} |"
        )
        return

    print(f"\n[+] Selected Location: {working_location}")

    # Step 3d: Generate three clips with Cloud Text-to-Speech (16 kHz 16-bit mono LINEAR16 PCM)
    print("\n[*] Synthesizing TTS test clips...")
    clips: dict[str, bytes] = {
        "Tamil (Standard)": synthesize_tts_clip(
            text="நான் இருபது நிமிஷத்துல வரேன்",
            language_code="ta-IN",
            voice_name="ta-IN-Standard-A",
        ),
        "English (CANT)": synthesize_tts_clip(
            text="Sorry, it's raining heavily, I can't come",
            language_code="en-IN",
            voice_name="en-IN-Standard-A",
        ),
        "English (STOP)": synthesize_tts_clip(
            text="Please don't call me again",
            language_code="en-IN",
            voice_name="en-IN-Standard-A",
        ),
    }

    # Step 3f: Repeat Tamil clip after converting to 8 kHz mu-law and back to 16 kHz with audioop
    print("[*] Converting Tamil clip to 8 kHz mu-law and back to 16 kHz (phone quality)...")
    clips["Tamil (Phone Quality)"] = convert_to_phone_quality(clips["Tamil (Standard)"])

    for name, pcm in clips.items():
        print(f"  - {name}: {len(pcm)} bytes raw PCM")

    # Step 3c: Session config
    system_instruction = types.Content(
        parts=[
            types.Part.from_text(
                text=(
                    "You are a polite assistant calling a blood donor on behalf of a blood centre. "
                    "Find out if they can come now, can't, or want no more calls, and roughly how many "
                    "minutes they need. As soon as it is clear, call record_reply once with their own "
                    "words as the quote. Never give medical advice."
                )
            )
        ]
    )

    connect_config = types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        input_audio_transcription=types.AudioTranscriptionConfig(),
        output_audio_transcription=types.AudioTranscriptionConfig(),
        system_instruction=system_instruction,
        tools=[build_live_tool()],
    )

    client = genai.Client(vertexai=True, project=PROJECT_ID, location=working_location)
    results: dict[str, dict[str, Any]] = {}

    # Step 3e: Stream each clip and evaluate
    eval_order = [
        "Tamil (Standard)",
        "Tamil (Phone Quality)",
        "English (CANT)",
        "English (STOP)",
    ]

    for clip_name in eval_order:
        pcm_data = clips[clip_name]
        print(f"\n[*] Opening fresh Live session for '{clip_name}'...")
        try:
            async with client.aio.live.connect(model=MODEL_NAME, config=connect_config) as session:
                res = await stream_and_evaluate(session, pcm_data, clip_name)
                results[clip_name] = res
        except Exception as exc:
            print(f"    Failed during session for '{clip_name}': {type(exc).__name__}: {exc}")
            results[clip_name] = {"clip": clip_name, "error": str(exc)}

    # Step 4: Confirm Request Desk model
    print("\n" + "=" * 65)
    print(" STEP 4: CONFIRM REQUEST DESK MODEL")
    print("=" * 65)
    try:
        settings = get_settings()
    except Exception:
        settings = Settings(
            GEMINI_MODEL=os.getenv("GEMINI_MODEL", "gemini-2.5-flash"),
            GOOGLE_CLOUD_PROJECT=os.getenv("GOOGLE_CLOUD_PROJECT", PROJECT_ID),
            VERTEX_LOCATION=os.getenv("VERTEX_LOCATION", "asia-south1"),
        )

    desk_model = settings.GEMINI_MODEL
    desk_location = settings.VERTEX_LOCATION
    print(f"Request Desk Config: model={desk_model}, location={desk_location}")

    try:
        desk_client = genai.Client(
            vertexai=True,
            project=settings.GOOGLE_CLOUD_PROJECT or PROJECT_ID,
            location=desk_location,
        )
        desk_resp = desk_client.models.generate_content(
            model=desk_model,
            contents="Confirm you are operational for blood request parsing. Say OK.",
        )
        print(f"Request Desk Model ({desk_model} in {desk_location}): OK")
        print(f"  Response: {desk_resp.text.strip()[:80]}")
    except Exception as exc:
        print(
            f"Request Desk Model ({desk_model} in {desk_location}): ERROR ({type(exc).__name__}: {exc})"
        )

    # Step 5: Print summary table
    # Columns: model, location, connects, Tamil understood, Tamil at phone quality, English CANT, English STOP, tool latency
    print("\n" + "=" * 65)
    print(" STEP 5: SUMMARY TABLE")
    print("=" * 65)

    def extract_verdict(res: dict[str, Any] | None, expected_intent: str) -> str:
        if not res or "error" in res:
            return "No (Error)"
        args = res.get("tool_args") or {}
        intent = args.get("intent")
        if intent == expected_intent:
            eta = args.get("etaMinutes")
            return f"Yes ({intent}, {eta}m)" if eta is not None else f"Yes ({intent})"
        return f"No ({intent})"

    ta_std_verdict = extract_verdict(results.get("Tamil (Standard)"), "COMING")
    ta_phone_verdict = extract_verdict(results.get("Tamil (Phone Quality)"), "COMING")
    en_cant_verdict = extract_verdict(results.get("English (CANT)"), "CANT")
    en_stop_verdict = extract_verdict(results.get("English (STOP)"), "STOP")

    latencies = [r.get("latency_sec") for r in results.values() if r.get("latency_sec") is not None]
    if latencies:
        avg_lat = sum(latencies) / len(latencies)
        lat_display = f"{avg_lat:.3f}s"
    else:
        lat_display = "N/A"

    print(
        "\n======================================================== GEMINI LIVE SPIKE SUMMARY ========================================================"
    )
    print(
        f"| {'Model':<35} | {'Location':<12} | {'Connects':<8} | {'Tamil understood':<18} | {'Tamil at phone quality':<23} | {'English CANT':<14} | {'English STOP':<14} | {'Tool latency':<12} |"
    )
    print(
        f"|{'-' * 37}|{'-' * 14}|{'-' * 10}|{'-' * 20}|{'-' * 25}|{'-' * 16}|{'-' * 16}|{'-' * 14}|"
    )
    print(
        f"| {MODEL_NAME:<35} | {working_location:<12} | {'Yes':<8} | {ta_std_verdict:<18} | {ta_phone_verdict:<23} | {en_cant_verdict:<14} | {en_stop_verdict:<14} | {lat_display:<12} |"
    )
    print(
        "==========================================================================================================================================\n"
    )


if __name__ == "__main__":
    asyncio.run(main())
