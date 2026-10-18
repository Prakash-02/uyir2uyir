"""Generate tamil_reply.wav using Google Cloud Text-to-Speech.

ta-IN voice, 16 kHz mono PCM WAV, with 1 second silence before and after.
Saves to C:\\Users\\Prakash\\Videos\\U2U_demo\\tamil_reply.wav.
"""

import os
import sys
from google.cloud import texttospeech

OUTPUT_DIR = r"C:\Users\Prakash\Videos\U2U_demo"
OUTPUT_PATH = os.path.join(OUTPUT_DIR, "tamil_reply.wav")


def make_tamil_wav() -> str:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    client = texttospeech.TextToSpeechClient()

    ssml = """<speak>
<break time="1s"/>
நான் இருபது நிமிஷத்துல வரேன்
<break time="1s"/>
</speak>"""
    synthesis_input = texttospeech.SynthesisInput(ssml=ssml)

    voice = texttospeech.VoiceSelectionParams(
        language_code="ta-IN",
        name="ta-IN-Standard-A",
        ssml_gender=texttospeech.SsmlVoiceGender.FEMALE,
    )

    audio_config = texttospeech.AudioConfig(
        audio_encoding=texttospeech.AudioEncoding.LINEAR16,
        sample_rate_hertz=16000,
    )

    print(f"[*] Synthesizing Tamil reply with ta-IN voice to {OUTPUT_PATH}...")
    response = client.synthesize_speech(
        input=synthesis_input,
        voice=voice,
        audio_config=audio_config,
    )

    with open(OUTPUT_PATH, "wb") as out:
        out.write(response.audio_content)
    print(f"[OK] Generated {OUTPUT_PATH} ({len(response.audio_content)} bytes)")
    return OUTPUT_PATH


if __name__ == "__main__":
    make_tamil_wav()
