"""Records every text the game reads aloud with Piper's German voices, as audio/<voice>/<name>.mp3.

Usage: python scripts/build-audio.py audio-texts.json   (the list comes from scripts/list-spoken.js)
Needs: pip install piper-tts, and ffmpeg. Voices download from Hugging Face on first use.
Files that already exist are kept (CI caches audio/), and recordings of texts the game no longer uses are removed.
With AUDIO_MINUTES set, recording stops after that many minutes and the rest waits for the next run (CI saves what was
made in its cache either way). Texts without a recording are read by the device voice, so a partial set still works.
"""
import json
import os
import shutil
import subprocess
import sys
import tempfile
import time
import wave
from pathlib import Path

from piper import PiperVoice, SynthesisConfig
from piper.download_voices import download_voice

# Folder name in audio/ -> Piper voice. Licences are in the .onnx.json files copied next to the recordings.
# Kerstin (de_DE-kerstin-low) was dropped in November 2026: she mispronounced too much.
VOICES = {"thorsten": "de_DE-thorsten-high"}
# Slow and clear, for learners: 1.0 is Piper's normal speed. Lower noise makes the voice steadier and less breathy.
LENGTH_SCALE = 1.4
NOISE_SCALE = 0.45
NOISE_W_SCALE = 0.5
# Even loudness for every file, with a short pause first so phones don't clip the first sound.
AUDIO_FILTER = "adelay=150:all=1,loudnorm=I=-16:TP=-1.5:LRA=11"
MP3_BITRATE = "64k"
ROOT = Path(__file__).resolve().parent.parent
MODELS = ROOT / ".piper-voices"


def main() -> None:
    budget = float(os.environ.get("AUDIO_MINUTES") or 0) * 60
    deadline = time.monotonic() + budget if budget else None
    items = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    MODELS.mkdir(exist_ok=True)
    # Voices no longer in VOICES (restored from an older CI cache) are removed with their model cards.
    audio = ROOT / "audio"
    if audio.exists():
        for old in audio.iterdir():
            if old.is_dir() and old.name not in VOICES:
                shutil.rmtree(old)
            elif old.name.endswith(".onnx.json") and old.name[: -len(".onnx.json")] not in VOICES.values():
                old.unlink()
    for folder, model in VOICES.items():
        if not (MODELS / f"{model}.onnx").exists():
            download_voice(model, MODELS)
        voice = PiperVoice.load(MODELS / f"{model}.onnx")
        out = ROOT / "audio" / folder
        # Recordings made with other settings (restored from an older CI cache) are thrown away.
        settings = f"{model} {LENGTH_SCALE} {NOISE_SCALE} {NOISE_W_SCALE} {AUDIO_FILTER} {MP3_BITRATE}\n"
        marker = out / "settings.txt"
        if marker.exists() and marker.read_text() != settings:
            shutil.rmtree(out)
        out.mkdir(parents=True, exist_ok=True)
        marker.write_text(settings)
        wanted = {f"{i['name']}.mp3" for i in items}
        for old in out.glob("*.mp3"):
            if old.name not in wanted:
                old.unlink()
        made = 0
        for item in items:
            mp3 = out / f"{item['name']}.mp3"
            if mp3.exists():
                continue
            if deadline and time.monotonic() > deadline:
                break
            with tempfile.NamedTemporaryFile(suffix=".wav") as tmp:
                with wave.open(tmp.name, "wb") as wav:
                    voice.synthesize_wav(item["text"], wav, syn_config=SynthesisConfig(
                        length_scale=LENGTH_SCALE, noise_scale=NOISE_SCALE, noise_w_scale=NOISE_W_SCALE))
                subprocess.run(
                    ["ffmpeg", "-loglevel", "error", "-y", "-i", tmp.name, "-af", AUDIO_FILTER, "-ar", "24000", "-ac", "1", "-b:a", MP3_BITRATE, str(mp3)],
                    check=True,
                )
            made += 1
        have = sum(1 for i in items if (out / f"{i['name']}.mp3").exists())
        print(f"{folder}: {made} new, {have} of {len(wanted)} recorded")
    # Keep each voice's model card (with its licence) next to the recordings.
    for model in VOICES.values():
        shutil.copy(MODELS / f"{model}.onnx.json", audio / f"{model}.onnx.json")


if __name__ == "__main__":
    main()
