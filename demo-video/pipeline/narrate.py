#!/usr/bin/env python3
"""
Generate the voice-over for every scene from script/storyboard.json.

    python3 pipeline/narrate.py            # all scenes
    python3 pipeline/narrate.py 04-help    # one scene
    python3 pipeline/narrate.py --samples  # one line in several Deepgram voices → build/vo-samples/

Engines (storyboard `voice.engine`):
  deepgram   Aura-2 text-to-speech (https://developers.deepgram.com/docs/text-to-speech).
             Needs DEEPGRAM_API_KEY in the environment or in .env.demo.
             `voice.name` is the model, e.g. aura-2-thalia-en, aura-2-athena-en,
             aura-2-helena-en (female) · aura-2-orion-en, aura-2-arcas-en (male).
  macos-say  the built-in macOS voice (offline, robotic; fine for timing drafts).
If the Deepgram key is missing the `voice.fallback` engine is used.

Output (what assemble.py reads):
    build/vo/<scene-id>.wav   48 kHz mono, loudness-normalised
    build/vo/<scene-id>.json  {"duration": seconds}

To use a human narrator, drop a WAV with the same name into build/vo/ and run
`make assemble`.
"""
import json
import os
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STORY = json.loads((ROOT / "script" / "storyboard.json").read_text())
OUT = ROOT / "build" / "vo"
# Spellings the voice reads correctly; applied to the spoken text only, never
# to the script. "Laal" is a long "aa" (rhymes with "call"), which the voice
# clips to "lal" when spelled as written.
PRONOUNCE = {r"\bLaal\b": "Laahl", r"\bLaal's\b": "Laahl's"}
PRONOUNCE_TRIALS = ["Lahl", "Laahl", "Lah-l"]

SAMPLE_VOICES = ["aura-2-thalia-en", "aura-2-athena-en", "aura-2-helena-en", "aura-2-luna-en",
                 "aura-2-orion-en", "aura-2-arcas-en"]


def duration(path: Path) -> float:
    return float(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]).strip())


def deepgram_key() -> str | None:
    key = os.environ.get("DEEPGRAM_API_KEY")
    if key:
        return key
    env = ROOT / ".env.demo"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith("DEEPGRAM_API_KEY="):
                return line.split("=", 1)[1].strip() or None
    return None


def spoken(text: str) -> str:
    import re
    for pat, rep in PRONOUNCE.items():
        text = re.sub(pat, rep, text)
    return text


def tts_deepgram(text: str, model: str, key: str, raw: Path):
    text = spoken(text)
    q = urllib.parse.urlencode({"model": model, "encoding": "linear16", "sample_rate": 48000, "container": "wav"})
    req = urllib.request.Request(
        f"https://api.deepgram.com/v1/speak?{q}",
        data=json.dumps({"text": text}).encode(),
        headers={"Authorization": f"Token {key}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=120) as r:
        raw.write_bytes(r.read())


def tts_say(text: str, voice: dict, raw: Path):
    name = voice["name"].split(" (")[0]
    subprocess.run(["say", "-v", name, "-r", str(voice.get("rate", 175)), "-o", str(raw), text], check=True)


def normalise(raw: Path, wav: Path):
    # Same loudness for every line, a hair of room below 0 dBFS, and a short
    # silence either side so a scene's first word never lands on the dissolve.
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(raw), "-ar", "48000", "-ac", "1",
                    "-af", "loudnorm=I=-18:TP=-2:LRA=9,adelay=150|150,apad=pad_dur=0.25", str(wav)], check=True)
    raw.unlink()


def main(argv):
    OUT.mkdir(parents=True, exist_ok=True)
    voice = dict(STORY["voice"])
    key = deepgram_key()
    if voice["engine"] == "deepgram" and not key:
        print("!! DEEPGRAM_API_KEY not set — falling back to", voice.get("fallback", {}).get("engine", "macos-say"))
        voice = voice.get("fallback", {"engine": "macos-say", "name": "Ava", "rate": 172})

    if "--samples" in argv:
        sd = ROOT / "build" / "vo-samples"
        sd.mkdir(parents=True, exist_ok=True)
        line = STORY["scenes"][1]["narration"]
        for m in SAMPLE_VOICES:
            raw = sd / f"{m}.raw.wav"
            tts_deepgram(line, m, key, raw)
            normalise(raw, sd / f"{m}.wav")
            print(f"  ✓ sample {m}")
        # and the brand name in each candidate spelling, in the chosen voice
        for sp in PRONOUNCE_TRIALS:
            raw = sd / f"pronounce-{sp}.raw.wav"
            tts_deepgram(f"{sp}. Everyone is someone's {sp}. This is {sp}.", voice["name"], key, raw)
            normalise(raw, sd / f"pronounce-{sp}.wav")
            print(f"  ✓ pronunciation trial '{sp}'")
        return

    wanted = {a for a in argv if not a.startswith("--")}
    for sc in STORY["scenes"]:
        if wanted and sc["id"] not in wanted:
            continue
        raw = OUT / f"{sc['id']}.raw.wav"
        wav = OUT / f"{sc['id']}.wav"
        if voice["engine"] == "deepgram":
            tts_deepgram(sc["narration"], voice["name"], key, raw)
        else:
            raw = raw.with_suffix(".aiff")
            tts_say(sc["narration"], voice, raw)
        normalise(raw, wav)
        d = duration(wav)
        (OUT / f"{sc['id']}.json").write_text(json.dumps({"duration": round(d, 3)}))
        print(f"  ✓ {sc['id']}: {d:.1f}s  ({voice['engine']}/{voice['name']}) — {sc['narration'][:50]}…")


if __name__ == "__main__":
    main(sys.argv[1:])
