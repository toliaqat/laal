#!/usr/bin/env python3
"""
Generate the voice-over for every scene from script/storyboard.json.

    python3 pipeline/narrate.py                 # English (build/vo/)
    python3 pipeline/narrate.py --lang ur       # Urdu    (build/vo-ur/)
    python3 pipeline/narrate.py 04-help         # one scene
    python3 pipeline/narrate.py --samples       # one line in several Deepgram voices → build/vo-samples/

Engines (storyboard `voices.<lang>.engine`):
  deepgram   Aura-2 (English). DEEPGRAM_API_KEY in the environment or .env.demo.
  azure      Azure Speech neural voices (Urdu: ur-PK-UzmaNeural / AsadNeural,
             ur-IN-GulNeural / SalmanNeural). AZURE_SPEECH_KEY + AZURE_SPEECH_REGION.
             `rate` is an SSML prosody rate such as "-3%".
  macos-say  the built-in macOS voice (offline; fine for timing drafts).
If a key is missing the `fallback` engine is used.

Output (what assemble.py reads):
    build/vo[-<lang>]/<scene-id>.wav   48 kHz mono, loudness-normalised
    build/vo[-<lang>]/<scene-id>.json  {"duration": seconds}

To use a human narrator, drop a WAV with the same name into that folder and
run `make assemble`.
"""
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path
from xml.sax.saxutils import escape

ROOT = Path(__file__).resolve().parents[1]
STORY = json.loads((ROOT / "script" / "storyboard.json").read_text())

# Spellings the English voice reads correctly; applied to the spoken text only,
# never to the script. "Laal" is a long "aa" (rhymes with "call"), which the
# voice clips to "lal" when spelled as written.
PRONOUNCE = {r"\bLaal\b": "Laahl", r"\bLaal's\b": "Laahl's"}
PRONOUNCE_TRIALS = ["Lahl", "Laahl", "Lah-l"]
# Urdu: "تاکہ" is read "ta-ka" by the voice; spelling it "تا کے" gives "ta-kay".
PRONOUNCE_UR = {"تاکہ": "تا کے", "تاکے": "تا کے"}

SAMPLE_VOICES = ["aura-2-thalia-en", "aura-2-athena-en", "aura-2-helena-en", "aura-2-luna-en",
                 "aura-2-orion-en", "aura-2-arcas-en"]


def duration(path: Path) -> float:
    return float(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]).strip())


def env_value(name: str) -> str | None:
    val = os.environ.get(name)
    if val:
        return val
    env = ROOT / ".env.demo"
    if env.exists():
        for line in env.read_text().splitlines():
            if line.startswith(name + "="):
                return line.split("=", 1)[1].strip() or None
    return None


def spoken(text: str) -> str:
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


def tts_azure(text: str, voice: dict, key: str, region: str, raw: Path):
    lang = voice.get("lang", "ur-PK")
    if lang.startswith("ur"):
        for src, dst in PRONOUNCE_UR.items():
            text = text.replace(src, dst)
    rate = voice.get("rate", "0%")
    body = escape(text)
    ssml = (f"<speak version='1.0' xmlns='http://www.w3.org/2001/10/synthesis' xml:lang='{lang}'>"
            f"<voice name='{voice['name']}'><lang xml:lang='{lang}'><prosody rate='{rate}'>{body}</prosody></lang></voice></speak>")
    req = urllib.request.Request(
        f"https://{region}.tts.speech.microsoft.com/cognitiveservices/v1",
        data=ssml.encode("utf-8"),
        headers={"Ocp-Apim-Subscription-Key": key, "Content-Type": "application/ssml+xml",
                 "X-Microsoft-OutputFormat": "riff-48khz-16bit-mono-pcm", "User-Agent": "laal-demo"},
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


def resolve_voice(lang: str) -> dict:
    voices = STORY.get("voices") or {"en": STORY["voice"]}
    voice = dict(voices[lang])
    if voice["engine"] == "deepgram" and not env_value("DEEPGRAM_API_KEY"):
        print("!! DEEPGRAM_API_KEY not set — falling back")
        voice = voice.get("fallback", {"engine": "macos-say", "name": "Ava", "rate": 172})
    if voice["engine"] == "azure" and not (env_value("AZURE_SPEECH_KEY") and env_value("AZURE_SPEECH_REGION")):
        sys.exit("AZURE_SPEECH_KEY / AZURE_SPEECH_REGION not set (environment or .env.demo)")
    return voice


def render(text: str, voice: dict, raw: Path):
    if voice["engine"] == "deepgram":
        tts_deepgram(text, voice["name"], env_value("DEEPGRAM_API_KEY"), raw)
    elif voice["engine"] == "azure":
        tts_azure(text, voice, env_value("AZURE_SPEECH_KEY"), env_value("AZURE_SPEECH_REGION"), raw)
    else:
        tts_say(text, voice, raw)


def narration_for(scene: dict, lang: str) -> str:
    if lang == "en":
        return scene["narration"]
    return scene[lang]["narration"]


def main(argv):
    lang = "en"
    if "--lang" in argv:
        lang = argv[argv.index("--lang") + 1]
    out = ROOT / "build" / ("vo" if lang == "en" else f"vo-{lang}")
    out.mkdir(parents=True, exist_ok=True)
    voice = resolve_voice(lang)

    if "--samples" in argv:
        sd = ROOT / "build" / "vo-samples"
        sd.mkdir(parents=True, exist_ok=True)
        line = STORY["scenes"][1]["narration"]
        key = env_value("DEEPGRAM_API_KEY")
        for m in SAMPLE_VOICES:
            raw = sd / f"{m}.raw.wav"
            tts_deepgram(line, m, key, raw)
            normalise(raw, sd / f"{m}.wav")
            print(f"  ✓ sample {m}")
        for sp in PRONOUNCE_TRIALS:
            raw = sd / f"pronounce-{sp}.raw.wav"
            tts_deepgram(f"{sp}. Everyone is someone's {sp}. This is {sp}.", voice["name"], key, raw)
            normalise(raw, sd / f"pronounce-{sp}.wav")
            print(f"  ✓ pronunciation trial '{sp}'")
        return

    wanted = {a for a in argv if not a.startswith("--") and a != lang}
    for sc in STORY["scenes"]:
        if wanted and sc["id"] not in wanted:
            continue
        raw = out / f"{sc['id']}.raw.wav"
        if voice["engine"] == "macos-say":
            raw = raw.with_suffix(".aiff")
        wav = out / f"{sc['id']}.wav"
        text = narration_for(sc, lang)
        render(text, voice, raw)
        normalise(raw, wav)
        d = duration(wav)
        (out / f"{sc['id']}.json").write_text(json.dumps({"duration": round(d, 3)}))
        print(f"  ✓ {sc['id']}: {d:.1f}s  ({voice['engine']}/{voice['name']}) — {text[:40]}…")


if __name__ == "__main__":
    main(sys.argv[1:])
