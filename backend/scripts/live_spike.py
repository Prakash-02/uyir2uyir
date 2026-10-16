#!/usr/bin/env python3
"""Gemini Live API Spike Script for U2U (Uyir2Uyir).

Tests Vertex AI Multimodal Live API capabilities for automated emergency blood donor calling:
1. Discovers live-capable models in asia-south1 and us-central1 for project uyir2uyir-53929.
2. Generates test voice clips via Cloud Text-to-Speech (Tamil, English decline, English opt-out).
3. Connects to Gemini Live with bidirectional audio, input/output transcription, and record_reply tool.
4. Streams audio in 20 ms chunks (640 bytes @ 16 kHz 16-bit PCM).
5. Converts Tamil clip to 8 kHz mu-law and back via audioop to verify telephony quality resilience.
6. Prints detailed measurements and a summary table.
"""

import asyncio
import audioop
import time
from typing import Any

from google import genai
from google.cloud import texttospeech
from google.genai import types

PROJECT_ID = "uyir2uyir-53929"
LOCATIONS = ["asia-south1", "us-central1"]
CANDIDATE_MODELS = [
    "gemini-2.0-flash-exp",
    "gemini-2.0-flash",
    "gemini-2.0-flash-realtime-exp",
    "gemini-2.5-flash",
]

CHUNK_DURATION_MS = 20
SAMPLE_RATE = 16000
BYTES_PER_SAMPLE = 2  # 16-bit mono
CHUNK_BYTES = int(SAMPLE_RATE * (CHUNK_DURATION_MS / 1000.0) * BYTES_PER_SAMPLE)  # 640 bytes


def build_live_tool() -> types.Tool:
    """Declares record_reply tool for donor response recording."""
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
    """Synthesizes text as 16 kHz 16-bit mono LINEAR16 PCM audio."""
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
    # Strip 44-byte WAV header if returned, ensuring raw PCM
    raw_audio = resp.audio_content
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
    """Streams audio in 20 ms chunks, waits up to 10s, and evaluates tool calls and transcription."""
    print(f"\n--- Streaming clip: {clip_name} ({len(audio_data)} bytes PCM) ---")

    tool_args: dict[str, Any] | None = None
    input_transcript = ""
    output_transcript = ""
    audio_bytes_returned = 0
    tool_call_latency_sec: float | None = None

    async def sender():
        offset = 0
        while offset < len(audio_data):
            chunk = audio_data[offset : offset + CHUNK_BYTES]
            offset += CHUNK_BYTES
            blob = types.Blob(data=chunk, mime_type="audio/pcm;rate=16000")
            await session.send(input=[blob], end_of_turn=False)
            await asyncio.sleep(CHUNK_DURATION_MS / 1000.0)
        # Mark end of user turn
        await session.send(input="", end_of_turn=True)

    stream_start = time.time()
    send_task = asyncio.create_task(sender())
    await send_task
    audio_end_time = time.time()
    print(
        f"Audio streaming finished in {audio_end_time - stream_start:.2f}s. Waiting for model response..."
    )

    try:
        async with asyncio.timeout(10.0):
            async for msg in session.receive():
                # Server content / transcription / audio
                if msg.server_content:
                    if msg.server_content.model_turn:
                        for part in msg.server_content.model_turn.parts:
                            if part.text:
                                output_transcript += part.text
                            if part.inline_data and part.inline_data.data:
                                audio_bytes_returned += len(part.inline_data.data)
                    if msg.server_content.turn_complete:
                        print("Turn complete received from server.")
                        break

                # Tool call
                if msg.tool_call and msg.tool_call.function_calls:
                    for fc in msg.tool_call.function_calls:
                        if fc.name == "record_reply":
                            tool_call_latency_sec = time.time() - audio_end_time
                            tool_args = fc.args
                            print(
                                f"-> Tool call received: record_reply({tool_args}) in {tool_call_latency_sec:.3f}s"
                            )
                            # Acknowledge tool call so session completes turn
                            tool_resp = {
                                "name": fc.name,
                                "response": {"status": "ok"},
                                "id": getattr(fc, "id", None) or "call_1",
                            }
                            await session.send(input=[tool_resp])
                            break
                    if tool_args is not None:
                        break

    except TimeoutError:
        print("Timeout (10s) reached waiting for model response.")
    except Exception as e:
        print(f"Error during receive loop: {type(e).__name__}: {e}")

    return {
        "clip": clip_name,
        "tool_args": tool_args,
        "input_transcript": input_transcript,
        "output_transcript": output_transcript,
        "latency_sec": tool_call_latency_sec,
        "audio_bytes_returned": audio_bytes_returned,
    }


async def main() -> None:
    print("=================================================================")
    print(" U2U GEMINI MULTIMODAL LIVE SPIKE (Vertex AI & Cloud TTS)")
    print("=================================================================")
    print(f"Project: {PROJECT_ID}")
    print(f"Locations to test: {LOCATIONS}")
    print(f"Candidate Models: {CANDIDATE_MODELS}\n")

    # Step 2a: Test Vertex AI Live models across regions
    discovered_model: str | None = None
    discovered_location: str | None = None
    location_errors: dict[str, str] = {}

    for loc in LOCATIONS:
        print(f"[*] Probing Vertex AI in region: {loc}...")
        client = genai.Client(vertexai=True, project=PROJECT_ID, location=loc)
        for model in CANDIDATE_MODELS:
            print(f"    Connecting to model '{model}' in {loc}...", end=" ", flush=True)
            try:
                config = types.LiveConnectConfig(
                    response_modalities=[types.Modality.AUDIO],
                )
                async with client.aio.live.connect(model=model, config=config):
                    print("CONNECTED!")
                    discovered_model = model
                    discovered_location = loc
                    break
            except Exception as exc:
                err_line = str(exc).splitlines()[0] if str(exc) else type(exc).__name__
                print(f"FAILED ({type(exc).__name__}: {err_line[:80]})")
                location_errors[f"{loc}/{model}"] = err_line
        if discovered_model:
            break

    # If Vertex AI live connection is not accessible in either region:
    if not discovered_model or not discovered_location:
        print("\n" + "!" * 65)
        print("FACTUAL RESULT: No working Gemini Live model found on Vertex AI.")
        print(f"Project: {PROJECT_ID}")
        print(f"Tested Regions: {LOCATIONS}")
        print("Errors encountered across candidate models:")
        for target, err in location_errors.items():
            print(f"  - {target}: {err}")
        print("!" * 65)

        # Print summary table reflecting factual reality
        print("\n================== GEMINI LIVE SPIKE SUMMARY ==================")
        print(
            f"| {'Model':<24} | {'Location':<12} | {'Works':<8} | {'Tamil':<8} | {'Phone Qual':<10} | {'Latency':<8} |"
        )
        print(f"|{'-' * 26}|{'-' * 14}|{'-' * 10}|{'-' * 10}|{'-' * 12}|{'-' * 10}|")
        first_model = CANDIDATE_MODELS[0]
        for loc in LOCATIONS:
            err_summary = location_errors.get(f"{loc}/{first_model}", "Not found")
            err_short = (
                "404/Policy" if ("1008" in err_summary or "404" in err_summary) else "Failed"
            )
            print(
                f"| {first_model:<24} | {loc:<12} | {err_short:<8} | {'N/A':<8} | {'N/A':<10} | {'N/A':<8} |"
            )
        print("===============================================================\n")
        print("Conclusion: Vertex AI Gemini Live API is currently unavailable in both")
        print("asia-south1 and us-central1 for project uyir2uyir-53929.")
        return

    # If a live model works:
    print(f"\n[+] Selected Model: {discovered_model} in {discovered_location}")
    print("[*] Generating TTS audio test clips (16 kHz 16-bit mono LINEAR16 PCM)...")

    clips = {
        "clip1_ta": synthesize_tts_clip(
            text="நான் இருபது நிமிஷத்துல வரேன்",
            language_code="ta-IN",
            voice_name="ta-IN-Standard-A",
        ),
        "clip2_en_rain": synthesize_tts_clip(
            text="Sorry, it's raining heavily, I can't come",
            language_code="en-IN",
            voice_name="en-IN-Standard-A",
        ),
        "clip3_en_stop": synthesize_tts_clip(
            text="Please don't call me again",
            language_code="en-IN",
            voice_name="en-IN-Standard-A",
        ),
    }

    # Step 2e: Convert clip 1 to 8 kHz mu-law and back to 16 kHz
    clips["clip1_ta_phone"] = convert_to_phone_quality(clips["clip1_ta"])
    print(f"  Clip 1 (ta-IN): {len(clips['clip1_ta'])} bytes")
    print(f"  Clip 2 (en-IN decline): {len(clips['clip2_en_rain'])} bytes")
    print(f"  Clip 3 (en-IN opt-out): {len(clips['clip3_en_stop'])} bytes")
    print(f"  Clip 1 phone-quality (8k mu-law -> 16k PCM): {len(clips['clip1_ta_phone'])} bytes")

    system_instruction = types.Content(
        parts=[
            types.Part.from_text(
                text=(
                    "You are a polite emergency blood donation call assistant. "
                    "When the donor answers, you must call the record_reply function once "
                    "with the donor's intent (COMING, CANT, STOP, UNCLEAR), "
                    "etaMinutes (integer if coming, null otherwise), and quote (verbatim quote)."
                )
            )
        ]
    )

    connect_config = types.LiveConnectConfig(
        response_modalities=[types.Modality.AUDIO],
        system_instruction=system_instruction,
        tools=[build_live_tool()],
    )

    client = genai.Client(vertexai=True, project=PROJECT_ID, location=discovered_location)
    results: list[dict[str, Any]] = []

    for name, pcm_data in clips.items():
        print(f"\n[*] Opening Live session for {name}...")
        try:
            async with client.aio.live.connect(
                model=discovered_model, config=connect_config
            ) as session:
                res = await stream_and_evaluate(session, pcm_data, name)
                results.append(res)
                print(f"    Result for {name}:")
                print(f"      Tool Call: {res['tool_args']}")
                print(f"      Latency: {res['latency_sec']}s")
                print(f"      Audio returned: {res['audio_bytes_returned']} bytes")
                print(f"      Output transcript: {res['output_transcript'][:80]}")
        except Exception as exc:
            print(f"    Failed during {name}: {exc}")
            results.append({"clip": name, "error": str(exc)})

    # Summary table
    print("\n================== GEMINI LIVE SPIKE SUMMARY ==================")
    print(f"| {'Clip':<20} | {'Intent':<10} | {'ETA':<5} | {'Latency':<8} | {'Audio Bytes':<11} |")
    print(f"|{'-' * 22}|{'-' * 12}|{'-' * 7}|{'-' * 10}|{'-' * 13}|")
    for r in results:
        args = r.get("tool_args") or {}
        intent = args.get("intent", "None")
        eta = str(args.get("etaMinutes", "-"))
        lat = f"{r.get('latency_sec', 0.0):.2f}s" if r.get("latency_sec") else "N/A"
        aud = str(r.get("audio_bytes_returned", 0))
        print(f"| {r['clip']:<20} | {intent:<10} | {eta:<5} | {lat:<8} | {aud:<11} |")
    print("===============================================================\n")


if __name__ == "__main__":
    asyncio.run(main())
