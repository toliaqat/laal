#!/usr/bin/env python3
"""
Build the landing-page cut of the demo for every language edition:

    build/web/laal-demo[-<lang>]-1080p.mp4    the walkthrough, 1080p, with sound (fetched on play)
    build/web/laal-demo[-<lang>]-teaser.mp4   silent 15 s loop for the hero card (browse → fundraiser)
    apps/web/public/demo/laal-demo[-<lang>]-poster.jpg   first thing the hero paints

    python3 pipeline/web_assets.py            # en + ur (whichever masters exist)
    python3 pipeline/web_assets.py --lang ur

The teaser and poster are cut at the same story beats in every language, found
from the scene timings the assembler used, so a re-narration never shifts them.
"""
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STORY = json.loads((ROOT / "script" / "storyboard.json").read_text())
PUBLIC = ROOT.parent / "apps" / "web" / "public" / "demo"
XFADE, VO_LEAD, VO_TAIL = 0.6, 0.6, 1.0   # keep in step with assemble.py
BG = "0xf3eee4"


def probe(p: Path) -> float:
    return float(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(p)]).strip())


def scene_starts(lang: str) -> dict:
    sfx = "" if lang == "en" else f"-{lang}"
    scenes, vo = ROOT / "build" / f"scenes{sfx}", ROOT / "build" / f"vo{sfx}"
    starts, t = {}, 0.0
    ids = [s["id"] for s in STORY["scenes"]]
    for i, s in enumerate(STORY["scenes"]):
        rec = probe(scenes / f"{s['id']}.mp4")
        v = vo / f"{s['id']}.wav"
        vo_d = probe(v) if v.exists() else 0.0
        dur = max(rec, VO_LEAD + vo_d + VO_TAIL, float(s.get("min_seconds", 0)))
        starts[s["id"]] = t
        t += dur - (XFADE if i < len(ids) - 1 else 0)
    return starts


def build(lang: str):
    sfx = "" if lang == "en" else f"-{lang}"
    master = ROOT / "build" / f"laal-demo{sfx}-1920x1080.mp4"
    if not master.exists():
        print(f"  – {lang}: no master at {master.name}, skipping")
        return
    out = ROOT / "build" / "web"
    out.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(parents=True, exist_ok=True)
    st = scene_starts(lang)
    teaser_at = st["02-browse"] + 0.4            # the grid of portraits → Amir's page
    poster_at = st["03-fundraiser"] + 3.0        # Amir's page, badges settled
    ff = ["ffmpeg", "-y", "-loglevel", "error"]
    subprocess.run(ff + ["-i", str(master), "-c:v", "libx264", "-crf", "26", "-preset", "slow", "-profile:v", "high",
                         "-level", "4.1", "-pix_fmt", "yuv420p", "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart",
                         str(out / f"laal-demo{sfx}-1080p.mp4")], check=True)
    subprocess.run(ff + ["-ss", f"{teaser_at:.2f}", "-t", "15", "-i", str(master), "-an",
                         "-vf", f"scale=1280:720,fade=t=in:st=0:d=0.5:color={BG},fade=t=out:st=14.5:d=0.5:color={BG}",
                         "-c:v", "libx264", "-crf", "29", "-preset", "slow", "-pix_fmt", "yuv420p", "-movflags", "+faststart",
                         str(out / f"laal-demo{sfx}-teaser.mp4")], check=True)
    subprocess.run(ff + ["-ss", f"{poster_at:.2f}", "-i", str(master), "-frames:v", "1", "-vf", "scale=1280:720", "-q:v", "3",
                         str(PUBLIC / f"laal-demo{sfx}-poster.jpg")], check=True)
    print(f"  ✓ {lang}: 1080p + teaser (from {teaser_at:.0f}s) + poster (at {poster_at:.0f}s)")


if __name__ == "__main__":
    langs = [sys.argv[sys.argv.index("--lang") + 1]] if "--lang" in sys.argv else ["en", "ur"]
    for lang in langs:
        build(lang)
