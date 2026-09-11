#!/usr/bin/env python3
"""Render script/SCRIPT.md (the human-readable shooting script) from
script/storyboard.json so the two never drift. Run via `make script`."""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STORY = json.loads((ROOT / "script" / "storyboard.json").read_text())
VO = ROOT / "build" / "vo"

lines = [
    f"# {STORY['title']} — shooting script",
    "",
    "_Generated from `storyboard.json` by `make script`. Edit the JSON, not this file._",
    "",
    f"Format {STORY['format']['width']}×{STORY['format']['height']} @ {STORY['format']['fps']} fps · "
    f"Voice: {STORY['voice']['name']} · Music: `{STORY['music']['file']}`",
    "",
    "| # | Scene | On screen | Voice-over | Lower third | Min |",
    "|---|---|---|---|---|---|",
]
total = 0.0
for s in STORY["scenes"]:
    on = s.get("onscreen") or (f"Title card — “{s['card']['headline']}”" if s.get("card") else "")
    vo_file = VO / f"{s['id']}.json"
    vo_len = json.loads(vo_file.read_text())["duration"] if vo_file.exists() else None
    m = s.get("min_seconds", 0)
    total += max(m, (vo_len or 0) + 1.6)
    lines.append(f"| {s['id']} | {s['title']} | {on} | {s['narration']} | {s.get('lower_third', '')} | "
                 f"{m}s{f' (VO {vo_len:.0f}s)' if vo_len else ''} |")
lines += ["", f"Estimated running time: about {total:.0f}s.", ""]
lines += [
    "## Cast (all faces are AI-generated — nobody real is portrayed as deceased)",
    "",
    "| Person | Fundraiser | Role in the demo |",
    "|---|---|---|",
    "| Amir Hussain, 38, Berlin | Bringing Amir home | the fundraiser we browse to and support |",
    "| Ahmed Raza, Lisbon | Bring Ahmed home to Lahore | created on camera by the organizer, then approved by the admin |",
    "| Noor Begum, Amsterdam | Help Noor's family say goodbye | sits in the admin review queue |",
    "| Bilal Khan · Mariam Sayed · Yusuf Ali · Fatima Begum · Rashid Iqbal | the rest of the browse grid | |",
    "",
    "| Account | Who | Used in |",
    "|---|---|---|",
    "| hamza@laal.demo | Hamza Hussain — organizer (Amir's brother) | 06-start |",
    "| organizer@laal.demo | Ayesha Rahman — Laal admin | 07-review |",
    "| (guest) Sara Malik | supporter | 04-help |",
    "",
]
(ROOT / "script" / "SCRIPT.md").write_text("\n".join(lines))
print("✓ script/SCRIPT.md")
