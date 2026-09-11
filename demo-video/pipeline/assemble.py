#!/usr/bin/env python3
"""
Assemble the final demo from the recorded scenes, the voice-over and the score.

    python3 pipeline/assemble.py                 # → build/laal-demo-1920x1080.mp4
    python3 pipeline/assemble.py --no-music
    python3 pipeline/assemble.py --scenes 03-fundraiser 04-help   # quick partial cut

Timing rules (per scene, in storyboard order):
  - a scene lasts max(recorded length, voice-over + 1.0s tail, min_seconds);
    the last frame is held (cloned) when the narration outlasts the footage
  - scenes dissolve into each other (XFADE seconds)
  - narration starts VO_LEAD seconds into its scene
  - the lower third fades in at LT_IN and stays LT_DUR seconds
  - the score loops under everything, ducked while the narrator speaks
"""
import argparse
import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STORY = json.loads((ROOT / "script" / "storyboard.json").read_text())
BUILD = ROOT / "build"

W, H, FPS = STORY["format"]["width"], STORY["format"]["height"], STORY["format"]["fps"]
LANG = "en"
if "--lang" in sys.argv:
    LANG = sys.argv[sys.argv.index("--lang") + 1]


def suffix(base: str) -> str:
    return base if LANG == "en" else f"{base}-{LANG}"


SCENES = BUILD / suffix("scenes")
VO = BUILD / suffix("vo")
CARDS = BUILD / suffix("cards")
XFADE = 0.6
VO_LEAD = 0.6
VO_TAIL = 1.0
LT_IN, LT_DUR, LT_FADE = 1.2, 6.5, 0.45


def probe(path: Path) -> float:
    return float(subprocess.check_output(
        ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]).strip())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scenes", nargs="*", help="subset of scene ids (storyboard order is kept)")
    ap.add_argument("--no-music", action="store_true")
    ap.add_argument("--lang", default="en", help="language edition (folders build/*-<lang>)")
    ap.add_argument("--out", default=str(BUILD / (f"laal-demo-{W}x{H}.mp4" if LANG == "en" else f"laal-demo-{LANG}-{W}x{H}.mp4")))
    ap.add_argument("--fast", action="store_true", help="quick low-quality preview encode")
    args = ap.parse_args()

    scenes = [s for s in STORY["scenes"] if not args.scenes or s["id"] in set(args.scenes)]
    plan = []
    for s in scenes:
        mp4 = SCENES / f"{s['id']}.mp4"
        if not mp4.exists():
            sys.exit(f"missing {mp4} — run `make record` (unit for {s['id']}) first")
        vo = VO / f"{s['id']}.wav"
        vo_d = probe(vo) if vo.exists() else 0.0
        rec_d = probe(mp4)
        dur = max(rec_d, VO_LEAD + vo_d + VO_TAIL, float(s.get("min_seconds", 0)))
        lt = CARDS / f"lt-{s['id']}.png"
        has_lt = bool(s.get("lower_third") if LANG == "en" else s.get(LANG, {}).get("lower_third"))
        plan.append({"id": s["id"], "mp4": mp4, "rec": rec_d, "vo": vo if vo.exists() else None,
                     "vo_d": vo_d, "dur": dur, "lt": lt if (lt.exists() and has_lt) else None})

    n = len(plan)
    starts, t = [], 0.0
    for i, p in enumerate(plan):
        starts.append(t)
        t += p["dur"] - (XFADE if i < n - 1 else 0)
    total = t
    print("scene            rec    vo    dur   start")
    for p, st in zip(plan, starts):
        print(f"{p['id']:<15} {p['rec']:5.1f} {p['vo_d']:5.1f} {p['dur']:6.1f} {st:7.1f}")
    print(f"total {total:.1f}s")

    inputs, fc = [], []
    idx = 0
    vids, aud_vo = [], []

    for i, p in enumerate(plan):
        inputs += ["-i", str(p["mp4"])]
        vi = idx; idx += 1
        pad = max(0.0, p["dur"] - p["rec"])
        chain = f"[{vi}:v]fps={FPS},scale={W}:{H},setsar=1,format=yuv420p"
        if pad > 0.01:
            chain += f",tpad=stop_mode=clone:stop_duration={pad + 0.2:.3f}"
        # trim/setpts drop the frame-rate metadata and xfade insists on CFR
        chain += f",trim=duration={p['dur']:.3f},setpts=PTS-STARTPTS,fps={FPS}[v{i}base]"
        fc.append(chain)
        label = f"v{i}base"
        if p["lt"]:
            inputs += ["-loop", "1", "-framerate", str(FPS), "-t", f"{p['dur']:.3f}", "-i", str(p["lt"])]
            li = idx; idx += 1
            lt_end = min(LT_IN + LT_DUR, p["dur"] - 0.8)
            fc.append(f"[{li}:v]format=rgba,fade=t=in:st={LT_IN}:d={LT_FADE}:alpha=1,"
                      f"fade=t=out:st={lt_end - LT_FADE:.3f}:d={LT_FADE}:alpha=1[lt{i}]")
            # xfade needs a constant frame rate; overlay leaves it unknown, so re-stamp it
            fc.append(f"[{label}][lt{i}]overlay=0:0:enable='between(t,{LT_IN},{lt_end:.3f})':format=auto,fps={FPS}[v{i}]")
            label = f"v{i}"
        vids.append(label)
        if p["vo"]:
            inputs += ["-i", str(p["vo"])]
            ai = idx; idx += 1
            delay = int((starts[i] + VO_LEAD) * 1000)
            fc.append(f"[{ai}:a]aformat=sample_rates=48000:channel_layouts=stereo,adelay={delay}|{delay}[vo{i}]")
            aud_vo.append(f"[vo{i}]")

    # video: chained dissolves
    cur = f"[{vids[0]}]"
    acc = plan[0]["dur"]
    for i in range(1, n):
        off = acc - XFADE
        fc.append(f"{cur}[{vids[i]}]xfade=transition=fade:duration={XFADE}:offset={off:.3f}[x{i}]")
        cur = f"[x{i}]"
        acc = off + plan[i]["dur"]
    # No fade-in: messaging apps use the very first frame as the thumbnail, so
    # frame one must already be the finished title card (see unit_cards).
    fc.append(f"{cur}fade=t=out:st={total - 1.2:.3f}:d=1.2[vout]")

    # audio: narration bed
    if aud_vo:
        fc.append("".join(aud_vo) + f"amix=inputs={len(aud_vo)}:normalize=0:dropout_transition=0,"
                  f"apad,atrim=duration={total:.3f}[vomix]")
    else:
        fc.append(f"anullsrc=r=48000:cl=stereo,atrim=duration={total:.3f}[vomix]")

    music = ROOT / STORY["music"]["file"]
    if not args.no_music and music.exists():
        inputs += ["-i", str(music)]
        mi = idx; idx += 1
        gain = STORY["music"].get("gain_db", -20)
        fc.append(f"[{mi}:a]aformat=sample_rates=48000:channel_layouts=stereo,aloop=loop=-1:size=2147483647,"
                  f"atrim=duration={total:.3f},afade=t=in:st=0:d=2.5,afade=t=out:st={total - 4:.3f}:d=4,"
                  f"volume={gain}dB[mus]")
        fc.append("[vomix]asplit=2[voA][voB]")
        fc.append("[mus][voB]sidechaincompress=threshold=0.02:ratio=10:attack=50:release=800:makeup=1[duck]")
        fc.append("[duck][voA]amix=inputs=2:normalize=0:dropout_transition=0,alimiter=limit=0.95[aout]")
    else:
        fc.append("[vomix]alimiter=limit=0.95[aout]")

    graph = BUILD / "filtergraph.txt"
    graph.write_text(";\n".join(fc) + "\n")
    quality = ["-crf", "28", "-preset", "ultrafast"] if args.fast else ["-crf", "18", "-preset", "slow"]
    cmd = ["ffmpeg", "-y", "-loglevel", "error", "-nostats", *inputs,
           "-filter_complex_script", str(graph), "-map", "[vout]", "-map", "[aout]",
           "-c:v", "libx264", *quality, "-pix_fmt", "yuv420p", "-r", str(FPS),
           "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", "-t", f"{total:.3f}", args.out]
    (BUILD / "ffmpeg-cmd.sh").write_text(" \\\n  ".join(subprocess.list2cmdline([c]) for c in cmd) + "\n")
    print("encoding …")
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode:
        sys.exit("ffmpeg failed:\n" + "\n".join(res.stderr.strip().splitlines()[-12:]))
    print(f"✓ {args.out}  ({total:.1f}s)")


if __name__ == "__main__":
    main()
