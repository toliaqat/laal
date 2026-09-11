#!/usr/bin/env python3
"""
Laal demo video — scene recorder.

    python3 pipeline/record.py              # record every unit
    python3 pipeline/record.py help review  # re-record only these units

A *unit* is one continuous browser session; it yields one or more *scenes*
(the storyboard ids). `help` records 04-help and 05-thankyou in one go because
the thank-you page only exists after a real (test-mode) Stripe payment.

Each scene drives the real web app — running against the LOCAL Supabase stack
(see seed/seed.sh and .env.demo) — in headless Chromium at 1920x1080, captures
frames through the CDP screencast, and encodes

    build/scenes/<scene-id>.mp4   1920x1080, 30 fps, H.264
    build/scenes/<scene-id>.json  duration + named beats (for the assembler)

Everything that makes the recording look "filmed" — the cursor, the click
ripple, eased mouse travel, slow scrolls, human-paced typing — is in the Actor
class below. Change pacing there, not in the scenes.
"""
from __future__ import annotations

import base64
import json
import os
import re
import shutil
import subprocess
import sys
import time
from pathlib import Path

from playwright.sync_api import Locator, Page, sync_playwright

ROOT = Path(__file__).resolve().parents[1]
STORY = json.loads((ROOT / "script" / "storyboard.json").read_text())
BUILD = ROOT / "build"
PORTRAITS = ROOT / "assets" / "portraits"

BASE = os.environ.get("DEMO_BASE_URL", "http://localhost:3000").rstrip("/")

# Language edition: `--lang ur` (or DEMO_LANG=ur). Drives the site locale, the
# UI labels the scenes look for, the on-camera text, and the build folders
# (build/scenes-ur, build/frames-ur, build/cards-ur).
LANG = os.environ.get("DEMO_LANG", "en")
if "--lang" in sys.argv:
    LANG = sys.argv[sys.argv.index("--lang") + 1]
MSG = json.loads((ROOT.parent / "packages" / "i18n" / "messages" / f"{LANG}.json").read_text())


def msg(path: str) -> str:
    """A UI string from the app's own message catalogue, e.g. msg('nav.start')."""
    d = MSG
    for k in path.split("."):
        d = d[k]
    return d


def suffix(base: str) -> str:
    return base if LANG == "en" else f"{base}-{LANG}"


SCENES_DIR = BUILD / suffix("scenes")
FRAMES_DIR = BUILD / suffix("frames")
CARDS_DIR = BUILD / suffix("cards")
PASSWORD = "LaalDemo2026"
ADMIN = "organizer@laal.demo"      # Ayesha Rahman — reviews fundraisers
ORGANIZER = "hamza@laal.demo"      # Hamza Hussain — starts one on camera

W, H, FPS = STORY["format"]["width"], STORY["format"]["height"], STORY["format"]["fps"]
# The app is laid out for ~1440px; a 4/3 CSS zoom fills 1920x1080 with the
# same layout the screenshots in intro-screenshots/ were taken at.
ZOOM = 4 / 3
JPEG_QUALITY = 95

# The fundraiser the organizer creates on camera (scene 06) and approves (07),
# and what the supporter types (scene 04) — per language edition.
ON_CAMERA = {
    "en": {
        "fundraiser": {
            "title": "Bring Ahmed home to Lahore",
            "deceased": "Ahmed Raza",
            "story": (
                "Ahmed came to Lisbon in 2019 and worked in a bakery in Alfama, sending "
                "most of what he earned to his parents and two younger sisters in Lahore. "
                "He collapsed suddenly last week and did not recover.\n\n"
                "His family's only wish is to bring him home, to be buried beside his "
                "grandfather. This fundraiser covers the embassy paperwork, the funeral "
                "home in Lisbon and the flight home, paid directly to Servilusa, the "
                "verified partner handling the repatriation."
            ),
            "goal": "6000", "country": "Portugal", "city": "Lisbon", "burial_city": "Lahore",
        },
        "supporter": {
            "name": "Sara Malik", "email": "sara@laal.demo",
            "message": ("From our family to yours. May Amir reach home soon, and may his "
                        "children always know how loved their father was."),
        },
        "amir_title": "Bringing Amir home",
    },
    "ur": {
        "fundraiser": {
            "title": "احمد کو لاہور واپس لانا",
            "deceased": "احمد رضا",
            "story": (
                "احمد 2019 میں لزبن آئے اور الفاما کی ایک بیکری میں کام کرتے تھے۔ جو کماتے، اُس کا بڑا حصہ "
                "لاہور میں اپنے والدین اور دو چھوٹی بہنوں کو بھیج دیتے۔ پچھلے ہفتے وہ اچانک گر پڑے اور جانبر نہ ہو سکے۔\n\n"
                "خاندان کی ایک ہی خواہش ہے کہ اُنہیں گھر لا کر دادا کے پہلو میں دفن کیا جائے۔ یہ کیمپین ایمبیسی کے کاغذات، "
                "لزبن کے فیونرل ہوم اور گھر تک کی فلائٹ کا خرچ پورا کرتی ہے، جو سیدھا Servilusa کو ادا ہوتا ہے، "
                "جو ویریفائیڈ پارٹنر ہے اور واپسی کا انتظام کر رہا ہے۔"
            ),
            "goal": "6000", "country": "پرتگال", "city": "لزبن", "burial_city": "لاہور",
        },
        "supporter": {
            "name": "سارہ ملک", "email": "sara@laal.demo",
            "message": "ہمارے خاندان کی طرف سے آپ کے خاندان کے لیے۔ دعا ہے امیر جلد گھر پہنچے، اور اُس کے بچے ہمیشہ جانیں کہ اُن کے والد سے کتنی محبت کی جاتی تھی۔",
        },
        "amir_title": "امیر کو گھر واپس لانا",
    },
}
NEW_FUNDRAISER = dict(ON_CAMERA[LANG]["fundraiser"], photo=PORTRAITS / "raw" / "ahmed-raza.jpg", org="Servilusa Agências Funerárias")
SUPPORTER = ON_CAMERA[LANG]["supporter"]
AMIR_TITLE = ON_CAMERA[LANG]["amir_title"]

# UI labels the scenes look for, from the app's own catalogue (so the Urdu
# edition finds Urdu buttons). `supportReaches` carries a <name/> placeholder;
# only the text before it is matched.
L = {
    "nav_fundraisers": msg("nav.fundraisers"),
    "nav_start": msg("nav.start"),
    "sign_in": msg("auth.login.submit"),
    "closest": msg("campaigns.list.sortClosestToGoal"),
    "reviewed": msg("campaigns.detail.trust.reviewed"),
    "need_verified": msg("campaigns.detail.trust.needVerified"),
    "reaches": re.split(r"<", msg("campaigns.detail.supportReaches"))[0].strip(),
    "story": msg("campaigns.detail.storyHeading"),
    "updates": msg("campaigns.detail.updatesHeading"),
    "supporters": msg("campaigns.detail.wordsOfSupport"),
    "help_now": msg("campaigns.detail.helpNow"),
    "donate_heading": msg("campaigns.donate.heading"),
    "donate_submit": msg("campaigns.donate.submit"),
    "choose_photo": msg("start.cover.choose"),
    # The start form no longer offers an individual beneficiary (organisations
    # only, since the repatriation-first change), so this label is optional.
    "org_option": (MSG.get("start", {}).get("beneficiary", {}).get("organizationOption")),
    "submit_review": msg("start.form.submit"),
    "pending": msg("dashboard.status.pending_review"),
    "other_lang": "English" if LANG == "ur" else "اردو",
}

# --------------------------------------------------------------------------
# Injected into every document: brand cursor, click ripple, zoom, and hiding
# the Next.js dev badge. Runs in the Stripe Checkout page too.
# --------------------------------------------------------------------------
OVERLAY_JS = r"""
(() => {
  const ZOOM = __ZOOM__;
  const isTop = window.top === window;
  const applyZoom = () => { if (document.documentElement) document.documentElement.style.zoom = String(ZOOM); };
  if (isTop) { applyZoom(); document.addEventListener('DOMContentLoaded', applyZoom); }

  const css = `
    nextjs-portal { display: none !important; }
    html { scrollbar-width: none; }
    ::-webkit-scrollbar { display: none; }
    #__demo_cursor { position: fixed; left: 0; top: 0; width: 22px; height: 30px;
      z-index: 2147483647; pointer-events: none; opacity: 0; transition: opacity .25s;
      filter: drop-shadow(0 1px 1px rgba(0,0,0,.25)) drop-shadow(0 4px 8px rgba(42,38,32,.25)); }
    #__demo_cursor.on { opacity: 1; }
    .__demo_ripple { position: fixed; width: 36px; height: 36px; border-radius: 50%;
      background: rgba(138,90,60,.28); border: 2px solid rgba(138,90,60,.85);
      z-index: 2147483646; pointer-events: none; transform: translate(-50%,-50%) scale(.35);
      animation: __demo_rip .55s cubic-bezier(.2,.7,.3,1) forwards; }
    @keyframes __demo_rip { 60% { opacity: .9; } to { transform: translate(-50%,-50%) scale(1.5); opacity: 0; } }
  `;
  const addStyle = () => {
    if (!document.documentElement || document.getElementById('__demo_style')) return;
    const s = document.createElement('style'); s.id = '__demo_style'; s.textContent = css;
    (document.head || document.documentElement).appendChild(s);
  };
  const svg = `<svg viewBox="0 0 22 30" xmlns="http://www.w3.org/2000/svg">
    <path d="M2 2 L2 23 L7.4 18.2 L11 27 L15 25.4 L11.4 16.8 L19 16.8 Z" fill="#2a2620" stroke="#fffdf8" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  let cur = null;
  const ensureCursor = () => {
    if (!isTop || !document.body) return;
    if (!cur || !cur.isConnected) {
      cur = document.createElement('div'); cur.id = '__demo_cursor'; cur.innerHTML = svg;
      document.body.appendChild(cur);
    }
  };
  const onMove = (e) => {
    ensureCursor(); if (!cur) return;
    const z = isTop ? ZOOM : 1;
    cur.style.transform = `translate(${e.clientX / z - 2}px, ${e.clientY / z - 2}px)`;
    cur.classList.add('on');
  };
  const onDown = (e) => {
    if (!document.body) return;
    const r = document.createElement('div'); r.className = '__demo_ripple';
    const z = isTop ? ZOOM : 1;
    r.style.left = (e.clientX / z) + 'px'; r.style.top = (e.clientY / z) + 'px';
    document.body.appendChild(r); setTimeout(() => r.remove(), 700);
  };
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('mousedown', onDown, true);
  document.addEventListener('DOMContentLoaded', () => { addStyle(); ensureCursor(); });
  addStyle();
})();
""".replace("__ZOOM__", repr(ZOOM))

# Stripe's hosted page is in test mode: hide the "Sandbox" badge and show the
# account name as production would. Cosmetic only — the payment is real (test).
STRIPE_TIDY_JS = r"""
(() => {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const t = n.nodeValue.trim();
    if (/laal sandbox/i.test(t)) n.nodeValue = n.nodeValue.replace(/laal sandbox/ig, 'Laal');
    if (/^sandbox$/i.test(t)) { const el = n.parentElement.closest('span,div'); if (el) el.style.visibility = 'hidden'; }
  }
})();
"""


def log(*a):
    print(*a, flush=True)


# --------------------------------------------------------------------------
# Frame capture
# --------------------------------------------------------------------------
class Recorder:
    """CDP screencast → JPEG frames on disk → per-scene H.264 via ffmpeg."""

    def __init__(self, context, page: Page, unit: str):
        self.page = page
        self.unit = unit
        self.dir = FRAMES_DIR / unit
        shutil.rmtree(self.dir, ignore_errors=True)
        self.dir.mkdir(parents=True)
        self.frames: list[tuple[float, Path]] = []
        self.segments: list[dict] = []   # {id, start_index, start_ts, beats}
        self.cuts: list[list[int]] = []  # [from_index, to_index) frame ranges to drop
        self.cdp = context.new_cdp_session(page)
        self.cdp.send("Page.enable")
        self.cdp.on("Page.screencastFrame", self._on_frame)
        # A cross-process navigation (e.g. to checkout.stripe.com) can end the
        # screencast; re-arm it whenever the main frame navigates.
        self.cdp.on("Page.frameNavigated", self._on_nav)
        self.running = False

    def _cast(self):
        self.cdp.send("Page.startScreencast", {
            "format": "jpeg", "quality": JPEG_QUALITY,
            "maxWidth": W, "maxHeight": H, "everyNthFrame": 1,
        })

    def _on_nav(self, ev):
        if self.running and not ev.get("frame", {}).get("parentId"):
            try:
                self._cast()
            except Exception:
                pass

    def _on_frame(self, ev):
        try:
            self.cdp.send("Page.screencastFrameAck", {"sessionId": ev["sessionId"]})
        except Exception:
            pass
        if not self.running:
            return
        path = self.dir / f"{len(self.frames):06d}.jpg"
        path.write_bytes(base64.b64decode(ev["data"]))
        self.frames.append((ev["metadata"]["timestamp"], path))

    def scene(self, scene_id: str):
        """Start (or switch to) a scene: frames from now on belong to it."""
        if not self.running:
            self.running = True
            self._cast()
        self.cut_to()   # a cut left open by the previous scene ends here
        self.segments.append({"id": scene_id, "start_index": len(self.frames),
                              "start_ts": time.time(), "beats": []})
        log(f"  ▶ {scene_id}")

    def cut_from(self):
        """Start a jump cut: frames captured from now on are dropped …"""
        self.cuts.append([len(self.frames), None])

    def cut_to(self):
        """… until here (a page that took 20s to load shows as a clean cut)."""
        if self.cuts and self.cuts[-1][1] is None:
            self.cuts[-1][1] = len(self.frames)

    def beat(self, name: str):
        seg = self.segments[-1]
        seg["beats"].append({"name": name, "t": round(time.time() - seg["start_ts"], 2)})

    def finish(self, tail: float = 1.0):
        self.running = False
        try:
            self.cdp.send("Page.stopScreencast")
        except Exception:
            pass
        SCENES_DIR.mkdir(parents=True, exist_ok=True)
        for i, seg in enumerate(self.segments):
            end = self.segments[i + 1]["start_index"] if i + 1 < len(self.segments) else len(self.frames)
            frames = self._with_durations(seg["start_index"], end)
            if len(frames) < 2:
                log(f"  !! {seg['id']}: only {len(frames)} frames, skipping")
                continue
            self._encode(seg, frames, tail)

    def _with_durations(self, start: int, end: int):
        """Frames [start, end) as (duration, path), minus the cut ranges. The
        duration of each kept frame is measured against its original
        neighbour, so a cut removes time instead of freezing a frame."""
        out = []
        for i in range(start, end):
            if any(a <= i < (b if b is not None else len(self.frames)) for a, b in self.cuts):
                continue
            ts = self.frames[i][0]
            nts = self.frames[i + 1][0] if i + 1 < len(self.frames) else ts + 1 / FPS
            out.append((max(nts - ts, 1 / 120), self.frames[i][1]))
        return out

    def _encode(self, seg, frames, tail):
        lst = self.dir / f"{seg['id']}.txt"
        lines = []
        for d, p in frames:
            lines.append(f"file '{p.name}'\nduration {d:.4f}")
        last = frames[-1][1]
        lines.append(f"file '{last.name}'\nduration {tail:.3f}")
        lines.append(f"file '{last.name}'")
        lst.write_text("\n".join(lines) + "\n")
        out = SCENES_DIR / f"{seg['id']}.mp4"
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", str(lst),
               "-vf", f"fps={FPS},scale={W}:{H}:flags=lanczos,format=yuv420p",
               "-c:v", "libx264", "-crf", "17", "-preset", "medium", "-movflags", "+faststart", str(out)]
        subprocess.run(cmd, check=True)
        dur = float(subprocess.check_output(
            ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(out)]).strip())
        (SCENES_DIR / f"{seg['id']}.json").write_text(json.dumps(
            {"id": seg["id"], "duration": round(dur, 3), "frames": len(frames), "beats": seg["beats"]}, indent=2))
        log(f"  ✓ {seg['id']}: {len(frames)} frames → {dur:.1f}s")


# --------------------------------------------------------------------------
# Human-looking interaction
# --------------------------------------------------------------------------
class Actor:
    def __init__(self, page: Page, rec: Recorder):
        self.page = page
        self.rec = rec
        self.pos = (W * 0.55, H * 0.6)

    # -- time ---------------------------------------------------------------
    def hold(self, seconds: float):
        self.page.wait_for_timeout(int(seconds * 1000))

    def beat(self, name: str):
        self.rec.beat(name)

    def cut_from(self):
        self.rec.cut_from()

    def cut_to(self):
        self.rec.cut_to()

    # -- navigation ---------------------------------------------------------
    def goto(self, path: str, settle: float = 0.4):
        url = path if path.startswith("http") else BASE + path
        self.page.goto(url, wait_until="networkidle")
        self.page.evaluate("document.fonts && document.fonts.ready")
        self.hold(settle)

    def wait_url(self, pattern, timeout: float = 30):
        """`pattern` is a glob or a compiled regex (globs choke on Stripe's URLs)."""
        self.page.wait_for_url(pattern, timeout=timeout * 1000, wait_until="commit")
        try:
            self.page.wait_for_load_state("networkidle", timeout=15000)
        except Exception:
            pass

    # -- mouse --------------------------------------------------------------
    def move_to(self, x: float, y: float, dur: float = 0.7):
        sx, sy = self.pos
        n = max(8, int(dur * 60))
        for i in range(1, n + 1):
            t = i / n
            e = t * t * (3 - 2 * t)  # smoothstep
            # a slight arc so travel doesn't look ruler-straight
            arc = (1 - abs(2 * t - 1)) * min(40, abs(x - sx) * 0.06)
            self.page.mouse.move(sx + (x - sx) * e, sy + (y - sy) * e - arc)
            self.page.wait_for_timeout(1000 // 60)
        self.pos = (x, y)

    def _center(self, loc: Locator, dx: float = 0, dy: float = 0):
        loc.first.scroll_into_view_if_needed()
        box = loc.first.bounding_box()
        if not box:
            raise RuntimeError("element has no box")
        return box["x"] + box["width"] * (0.5 + dx), box["y"] + box["height"] * (0.5 + dy)

    def hover(self, loc: Locator, dur: float = 0.7, dx: float = 0, dy: float = 0):
        x, y = self._center(loc, dx, dy)
        self.move_to(x, y, dur)

    def click(self, loc: Locator, dur: float = 0.55, settle: float = 0.22, dx: float = 0, dy: float = 0):
        self.hover(loc, dur, dx, dy)
        self.hold(settle)
        self.page.mouse.down()
        self.hold(0.09)
        self.page.mouse.up()

    def type(self, loc: Locator, text: str, cps: float = 22, settle: float = 0.12):
        """Click into a field and type like a person (cps = chars/second)."""
        self.click(loc, dur=0.45, settle=settle)
        self.hold(0.1)
        self.page.keyboard.type(text, delay=int(1000 / cps))

    def type_long(self, loc: Locator, text: str, lead: int = 48, cps: float = 26):
        """Type the first `lead` characters, then drop in the rest at once —
        a long story would otherwise eat ten seconds of screen time."""
        self.type(loc, text[:lead], cps=cps)
        self.hold(0.25)
        self.page.keyboard.insert_text(text[lead:])

    def press(self, key: str, times: int = 1, gap: float = 0.12):
        for _ in range(times):
            self.page.keyboard.press(key)
            self.hold(gap)

    # -- scrolling ----------------------------------------------------------
    def scroll_into_view(self, loc: Locator, offset: float = 110, dur: float = 1.4):
        """Ease the page so `loc` sits `offset` px below the top (closed-loop,
        so it is independent of the CSS zoom's coordinate space)."""
        handle = loc.first.element_handle()
        self.page.evaluate(
            """([el, offset, ms]) => new Promise(res => {
                 const start = performance.now();
                 const from = el.getBoundingClientRect().top - offset;
                 const ease = t => 1 - Math.pow(1 - t, 3);
                 const step = now => {
                   const t = Math.min(1, (now - start) / ms);
                   const want = from * (1 - ease(t));           // where el should be now
                   const cur = el.getBoundingClientRect().top - offset;
                   window.scrollBy(0, cur - want);
                   if (t < 1) requestAnimationFrame(step); else res();
                 };
                 requestAnimationFrame(step);
               })""",
            [handle, offset, int(dur * 1000)],
        )
        self.hold(0.1)

    def scroll_by(self, px: float, dur: float = 1.2):
        self.page.evaluate(
            """([px, ms]) => new Promise(res => {
                 const start = performance.now(); let done = 0;
                 const ease = t => 1 - Math.pow(1 - t, 3);
                 const step = now => {
                   const t = Math.min(1, (now - start) / ms);
                   const want = px * ease(t); window.scrollBy(0, want - done); done = want;
                   if (t < 1) requestAnimationFrame(step); else res();
                 };
                 requestAnimationFrame(step);
               })""",
            [px, int(dur * 1000)],
        )
        self.hold(0.1)

    # -- auth ---------------------------------------------------------------
    def sign_in(self, email: str, via_nav: bool = False):
        """Type credentials on the login form that is currently on screen."""
        self.type(self.page.locator("#email"), email, cps=26)
        self.type(self.page.locator("#password"), PASSWORD, cps=30)
        self.click(self.page.locator("form").get_by_role("button", name=re.compile(re.escape(L["sign_in"]), re.I)))


# --------------------------------------------------------------------------
# Locators shared by scenes
# --------------------------------------------------------------------------
def nav_link(page: Page, name: str) -> Locator:
    return page.locator("header nav, header").get_by_role("link", name=name, exact=True).first


def card_link(page: Page, title: str) -> Locator:
    return page.get_by_role("link", name=re.compile(re.escape(title))).first


# --------------------------------------------------------------------------
# Units
# --------------------------------------------------------------------------
# The thank-you page prints the fundraiser's share URL; show the real domain
# rather than the dev server's (cosmetic, text nodes only).
PRETTY_URL_JS = r"""
(() => {
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const nodes = []; while (w.nextNode()) nodes.push(w.currentNode);
  for (const n of nodes) if (/localhost:\d+/.test(n.nodeValue)) n.nodeValue = n.nodeValue.replace(/https?:\/\/localhost:\d+/g, 'https://laal.app');
})();
"""

# A "tap" ripple inside a phone iframe, then a click — used by the mobile scene.
TAP_JS = r"""
el => new Promise(res => {
  const r = el.getBoundingClientRect();
  const d = document.createElement('div'); d.className = '__demo_ripple';
  d.style.left = (r.left + r.width / 2) + 'px'; d.style.top = (r.top + r.height / 2) + 'px';
  document.body.appendChild(d);
  setTimeout(() => { el.click(); res(); }, 260);
})
"""

SMOOTH_SCROLL_JS = """([y, ms]) => new Promise(res => {
  const s = performance.now(), from = window.scrollY;
  const step = n => { const t = Math.min(1, (n - s) / ms); window.scrollTo(0, from + (y - from) * (1 - Math.pow(1 - t, 3))); if (t < 1) requestAnimationFrame(step); else res(); };
  requestAnimationFrame(step);
})"""


def unit_home(a: Actor, page: Page):
    a.goto(f"/{LANG}")
    a.rec.scene("01-home")
    a.move_to(W * 0.62, H * 0.55, 0.01)
    a.hold(2.6)
    a.beat("values")
    a.scroll_into_view(page.locator("section.value-band"), offset=70, dur=1.5)
    a.hold(2.0)
    a.beat("how")
    heads = page.locator("main section h2")
    a.scroll_into_view(heads.nth(1), offset=90, dur=1.5)   # "What Laal is"
    a.hold(1.6)
    a.scroll_into_view(heads.nth(2), offset=90, dur=1.5)   # "How it works"
    a.hold(2.4)


def unit_browse(a: Actor, page: Page):
    a.goto(f"/{LANG}")
    a.rec.scene("02-browse")
    a.move_to(W * 0.5, H * 0.5, 0.01)
    a.hold(0.6)
    a.click(nav_link(page, L["nav_fundraisers"]), dur=0.8)
    a.wait_url("**/campaigns")
    a.hold(1.2)
    a.beat("grid")
    cards = page.locator("main a[href*='/campaigns/']")
    a.hover(cards.nth(0), dur=0.7, dy=-0.15)
    a.hold(0.5)
    a.hover(cards.nth(2), dur=0.7, dy=-0.15)
    a.hold(0.5)
    a.click(page.get_by_role("link", name=L["closest"]), dur=0.7)
    a.hold(1.2)
    a.beat("open")
    a.click(card_link(page, AMIR_TITLE), dur=0.8, dy=-0.1)
    a.wait_url("**/demo-bringing-amir-home")
    a.hold(1.0)


def unit_fundraiser(a: Actor, page: Page):
    a.goto(f"/{LANG}/campaigns/demo-bringing-amir-home")
    a.rec.scene("03-fundraiser")
    a.move_to(W * 0.72, H * 0.62, 0.01)
    a.hold(2.2)
    a.beat("badges")
    a.hover(page.get_by_text(L["reviewed"]).first, dur=0.8)
    a.hold(0.7)
    a.hover(page.get_by_text(L["need_verified"]).first, dur=0.5)
    a.hold(0.7)
    a.hover(page.get_by_text(L["reaches"]).first, dur=0.7, dx=0.15)
    a.hold(2.2)
    a.beat("story")
    a.scroll_into_view(page.get_by_role("heading", name=L["story"]), offset=120, dur=1.4)
    a.hold(2.8)
    a.beat("updates")
    a.scroll_into_view(page.get_by_role("heading", name=re.compile(re.escape(L["updates"]))), offset=120, dur=1.4)
    a.hold(2.6)
    a.beat("supporters")
    a.scroll_into_view(page.get_by_role("heading", name=re.compile(re.escape(L["supporters"]))), offset=120, dur=1.4)
    a.hold(3.0)


def unit_help(a: Actor, page: Page):
    a.goto(f"/{LANG}/campaigns/demo-bringing-amir-home")
    a.rec.scene("04-help")
    a.move_to(W * 0.7, H * 0.7, 0.01)
    a.hold(0.7)
    a.beat("help-now")
    a.hover(page.get_by_role("link", name=L["help_now"]).first, dur=0.8)
    a.hold(0.3)
    a.scroll_into_view(page.get_by_role("heading", name=L["donate_heading"]), offset=90, dur=1.3)
    a.hold(0.5)
    a.beat("amount")
    a.click(page.get_by_role("button", name=re.compile(r"50")), dur=0.7)
    a.hold(0.5)
    a.type(page.locator("input[name=donorName]"), SUPPORTER["name"], cps=26)
    a.type(page.locator("input[name=donorEmail]"), SUPPORTER["email"], cps=30)
    a.beat("message")
    a.type(page.locator("textarea[name=message]"), SUPPORTER["message"], cps=44)
    a.hold(0.5)
    submit = page.get_by_role("button", name=re.compile("^" + re.escape(L["donate_submit"])))
    a.scroll_into_view(submit, offset=H / ZOOM * 0.55, dur=0.9)
    a.beat("pay")
    a.click(submit, dur=0.7)
    a.hold(0.8)                      # the button's "Preparing checkout…" state
    a.cut_from()                     # … then jump over the Stripe round-trip
    a.wait_url(re.compile(r"checkout\.stripe\.com/"), timeout=60)
    page.wait_for_selector("text=Payment method", timeout=45000)
    a.hold(0.4)
    page.evaluate(STRIPE_TIDY_JS)
    a.hold(0.3)
    a.cut_to()
    a.move_to(W * 0.5, H * 0.6, 0.01)
    a.hold(1.0)
    a.beat("stripe")
    a.click(page.get_by_text("Card", exact=True).first, dur=0.8)
    page.wait_for_selector("#cardNumber", timeout=15000)
    a.hold(0.4)
    a.type(page.locator("#cardNumber"), "4242 4242 4242 4242", cps=28)
    a.type(page.locator("#cardExpiry"), "1234", cps=16)
    a.type(page.locator("#cardCvc"), "123", cps=14)
    if page.locator("#billingName").count():
        a.type(page.locator("#billingName"), SUPPORTER["name"], cps=30)
    if page.locator("#billingCountry").count():
        page.locator("#billingCountry").select_option("DE")
    if page.locator("#billingPostalCode").count():
        a.type(page.locator("#billingPostalCode"), "10115", cps=14)
    save = page.locator("#enableStripePass")
    if save.count() and save.is_checked():
        a.click(save, dur=0.5)
    a.hold(0.4)
    pay = page.locator("[data-testid=hosted-payment-submit-button], button:has-text('Pay')").first
    a.click(pay, dur=0.7)
    a.hold(1.0)                      # Stripe's "Processing…" state
    a.cut_from()
    a.wait_url(re.compile(r"/thank-you"), timeout=90)
    page.wait_for_selector("h1", timeout=30000)
    page.evaluate(PRETTY_URL_JS)
    a.hold(0.3)
    a.cut_to()
    a.rec.scene("05-thankyou")
    a.move_to(W * 0.62, H * 0.62, 0.01)
    a.hold(2.4)
    a.beat("share")
    wa = page.get_by_role("link", name=re.compile("WhatsApp|واٹس")).first
    if wa.count():
        a.hover(wa, dur=0.9)
    a.hold(1.2)
    a.scroll_by(320, dur=1.3)
    a.hold(2.0)


def unit_start(a: Actor, page: Page):
    # Re-seed so the fundraiser created on camera never exists twice.
    subprocess.run([str(ROOT / "seed" / "seed.sh"), LANG], check=True, stdout=subprocess.DEVNULL)
    a.goto(f"/{LANG}")
    a.rec.scene("06-start")
    a.move_to(W * 0.5, H * 0.5, 0.01)
    a.hold(0.6)
    a.beat("sign-in")
    a.click(nav_link(page, L["nav_start"]), dur=0.8)
    a.wait_url("**/login**")
    a.hold(0.5)
    a.sign_in(ORGANIZER)
    a.hold(0.5)
    a.cut_from()
    a.wait_url("**/start**", timeout=30)
    page.wait_for_selector("input[name=title]", timeout=30000)
    a.hold(0.3)
    a.cut_to()
    a.move_to(W * 0.5, H * 0.5, 0.01)
    a.hold(0.6)
    a.beat("form")
    n = NEW_FUNDRAISER
    a.type(page.locator("input[name=title]"), n["title"], cps=26)
    a.type(page.locator("input[name=deceased_name]"), n["deceased"], cps=26)
    a.type_long(page.locator("textarea[name=story]"), n["story"], lead=52, cps=30)
    a.hold(0.3)
    a.beat("photo")
    choose = page.get_by_role("button", name=re.compile(re.escape(L["choose_photo"]))).first
    a.scroll_into_view(choose, offset=H / ZOOM * 0.55, dur=1.1)
    a.hover(choose, dur=0.7)
    a.hold(0.3)
    page.locator("input[type=file]").set_input_files(str(n["photo"]))
    a.hold(1.0)
    frame = page.locator("[aria-label]").filter(has=page.locator("img, canvas")).first
    a.scroll_into_view(frame, offset=140, dur=0.9)
    zoom = page.locator("input[type=range]").first
    if zoom.count():
        a.click(zoom, dur=0.6, dx=-0.5)
        a.press("ArrowRight", times=3, gap=0.1)
        a.hold(0.3)
    # nudge the photo so the face sits in the oval
    a.hover(frame, dur=0.5)
    page.mouse.down()
    a.move_to(a.pos[0], a.pos[1] + 10, 0.45)
    page.mouse.up()
    a.hold(0.8)
    a.beat("goal")
    goal = page.locator("input[name=goal_amount]")
    a.scroll_into_view(goal, offset=220, dur=1.0)
    a.type(goal, n["goal"], cps=14)
    use = page.locator("select[name=intended_use]")
    a.hover(use, dur=0.5)
    use.select_option("repatriation")
    a.hold(0.4)
    a.type(page.locator("input[name=death_country]"), n["country"], cps=26)
    a.type(page.locator("input[name=death_city]"), n["city"], cps=26)
    burial = page.locator("input[name=repatriation_city]")
    if burial.count():
        a.type(burial, n["burial_city"], cps=26)
    a.beat("beneficiary")
    org = page.locator("select[name=organization_id]")
    a.scroll_into_view(org, offset=260, dur=1.0)
    radio = page.locator("input[type=radio][name=beneficiary_kind][value=organization]")
    if L["org_option"] and radio.count() and not radio.is_checked():
        a.click(page.get_by_text(L["org_option"]), dur=0.6)
    a.hover(org, dur=0.5)
    org.select_option(label=n["org"])
    a.hold(0.6)
    a.beat("submit")
    submit = page.get_by_role("button", name=re.compile(re.escape(L["submit_review"])))
    a.scroll_into_view(submit, offset=H / ZOOM * 0.6, dur=0.9)
    a.click(submit, dur=0.7)
    a.hold(1.0)                      # "Creating your fundraiser…"
    a.cut_from()                     # photo re-encode + upload
    a.wait_url(re.compile(r"/dashboard"), timeout=90)
    page.get_by_text(L["pending"]).first.wait_for(timeout=30000)
    a.hold(0.3)
    page.evaluate("window.scrollTo(0, 0)")   # the redirect can land mid-page
    a.cut_to()
    a.move_to(W * 0.5, H * 0.5, 0.01)
    a.hold(0.8)
    a.beat("dashboard")
    a.hover(page.get_by_text(L["pending"]).first, dur=0.9)
    a.hold(2.6)


def unit_review(a: Actor, page: Page):
    a.goto(f"/{LANG}/login")
    a.rec.scene("07-review")
    a.move_to(W * 0.5, H * 0.5, 0.01)
    a.hold(0.4)
    a.sign_in(ADMIN)
    a.hold(0.6)
    a.cut_from()                     # skip the organizer dashboard on the way to admin
    a.wait_url(re.compile(r"/dashboard"))
    a.goto(f"/{LANG}/admin/campaigns")
    a.cut_to()
    a.move_to(W * 0.55, H * 0.5, 0.01)
    a.hold(1.4)
    a.beat("queue")
    a.click(card_link(page, NEW_FUNDRAISER["title"]), dur=0.9)
    a.wait_url(re.compile(r"/admin/campaigns/[0-9a-f-]+"))
    a.hold(1.4)
    a.beat("verify")
    section = page.locator("section", has=page.get_by_role("heading", name="Fundraiser review"))
    a.scroll_into_view(section, offset=110, dur=1.2)
    a.hold(0.6)
    # Approve each verification that is still pending/submitted (an org
    # beneficiary only carries the death check; a family also has relationship).
    pending = section.get_by_text(re.compile(r"^(pending|submitted)$")).count()
    for i in range(pending):
        a.click(section.get_by_role("button", name="Mark need verified").nth(i), dur=0.7)
        for _ in range(60):   # poll up to ~12s for the badge to flip
            if section.get_by_text("approved", exact=True).count() >= i + 1:
                break
            page.wait_for_timeout(200)
        a.hold(0.5)
    a.hold(0.4)
    a.beat("approve")
    a.scroll_into_view(page.get_by_role("heading", level=1), offset=120, dur=1.1)
    a.click(page.get_by_role("button", name="Approve fundraiser"), dur=0.8)
    a.hold(0.6)
    a.cut_from()
    page.locator("h1").locator("..").get_by_text("active", exact=True).wait_for(timeout=30000)
    a.hold(0.2)
    a.cut_to()
    a.hold(1.6)
    a.beat("live")
    a.goto(f"/{LANG}/campaigns")
    a.hover(card_link(page, NEW_FUNDRAISER["title"]), dur=1.0, dy=-0.15)
    a.hold(2.2)


def unit_mobile(a: Actor, page: Page):
    """Two phone-framed views of the mobile web app, driven from a stage page."""
    stage = (ROOT / "pipeline" / "stage.html").resolve().as_uri()
    page.goto(f"{stage}?base={BASE}&lang={LANG}")
    page.wait_for_timeout(2500)
    for f in page.frames[1:]:
        try:
            f.wait_for_load_state("networkidle", timeout=15000)
        except Exception:
            pass
    a.rec.scene("08-mobile")
    a.hold(1.8)
    detail = page.frame(name="phone-detail")
    lst = page.frame(name="phone-list")
    a.beat("scroll")
    if lst:
        lst.evaluate(SMOOTH_SCROLL_JS, [560, 1800])
    a.hold(0.3)
    if detail:
        detail.evaluate(SMOOTH_SCROLL_JS, [700, 2000])
    a.hold(1.4)
    a.beat("urdu")
    if detail:
        detail.evaluate(SMOOTH_SCROLL_JS, [0, 1100])
        a.hold(0.3)
        switched = False
        menu = detail.get_by_role("button", name=re.compile("menu", re.I)).first
        if menu.count():
            menu.evaluate(TAP_JS)
            a.hold(0.8)
        link = detail.get_by_role("link", name=re.compile(L["other_lang"])).first
        if link.count():
            try:
                link.evaluate(TAP_JS)
                switched = True
            except Exception:
                pass
        if not switched:
            detail.evaluate("([a, b]) => { location.pathname = location.pathname.replace('/' + a + '/', '/' + b + '/') }", [LANG, "en" if LANG == "ur" else "ur"])
        try:
            detail.wait_for_load_state("networkidle", timeout=15000)
        except Exception:
            pass
    a.hold(3.4)


def scene_text(sc: dict, key: str):
    """A storyboard field for the current language ('en' is the top level)."""
    if LANG == "en":
        return sc.get(key)
    return sc.get(LANG, {}).get(key, sc.get(key))


def unit_cards(a: Actor, page: Page):
    """Animated title cards (00-open, 09-close) rendered from cards.html, plus
    the transparent lower-third PNGs the assembler overlays on screen scenes."""
    cards = (ROOT / "pipeline" / "cards.html").resolve().as_uri()
    out = CARDS_DIR
    out.mkdir(parents=True, exist_ok=True)
    for sc in STORY["scenes"]:
        lt = scene_text(sc, "lower_third")
        if lt:
            page.goto(f"{cards}?lang={LANG}&lower={lt}")
            page.evaluate("document.fonts ? document.fonts.ready : 0")
            page.wait_for_timeout(600)
            page.screenshot(path=str(out / f"lt-{sc['id']}.png"), omit_background=True)
            log(f"  ✓ lower third {sc['id']}")
    for sc in STORY["scenes"]:
        if sc["kind"] != "card":
            continue
        c = scene_text(sc, "card")
        q = f"eyebrow={c['eyebrow']}&headline={c['headline']}&sub={c['sub']}"
        page.goto(f"{cards}?card=1&lang={LANG}&{q}")
        page.evaluate("document.fonts ? document.fonts.ready : 0")
        page.wait_for_timeout(400)
        if sc is STORY["scenes"][0]:
            # The opening card must be complete on frame one (it becomes the
            # share thumbnail), so let its entrance play before recording.
            page.evaluate("window.__play && window.__play()")
            page.wait_for_timeout(2600)
            a.rec.scene(sc["id"])
        else:
            a.rec.scene(sc["id"])
            page.evaluate("window.__play && window.__play()")
        a.hold(sc.get("min_seconds", 6))
        a.cut_from()    # drop the blank frames while the next card loads


UNITS = {
    "cards": unit_cards,
    "home": unit_home,
    "browse": unit_browse,
    "fundraiser": unit_fundraiser,
    "help": unit_help,
    "start": unit_start,
    "review": unit_review,
    "mobile": unit_mobile,
}
# units whose page must NOT be zoomed (they already lay out at 1920x1080)
NO_ZOOM = {"cards", "mobile"}


def run_unit(pw, name: str):
    log(f"● unit {name}")
    browser = pw.chromium.launch(args=[
        "--hide-scrollbars", "--force-color-profile=srgb", "--disable-lcd-text",
        "--font-render-hinting=none", "--disable-features=TranslateUI",
    ])
    ctx = browser.new_context(viewport={"width": W, "height": H}, device_scale_factor=1,
                              locale="en-US", timezone_id="Europe/Lisbon")
    # The site defaults to Urdu for locale-less redirects (e.g. after sign-in);
    # an English visitor who used the language switcher carries this cookie.
    ctx.add_cookies([{"name": "NEXT_LOCALE", "value": LANG, "url": BASE}])
    if name not in NO_ZOOM:
        ctx.add_init_script(OVERLAY_JS)
    else:
        ctx.add_init_script(OVERLAY_JS.replace(repr(ZOOM), "1"))
    page = ctx.new_page()
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    rec = Recorder(ctx, page, name)
    try:
        UNITS[name](Actor(page, rec), page)
    finally:
        rec.finish()
        browser.close()
    if errors:
        log(f"  (page errors seen: {len(errors)}) " + errors[0][:160])


WARM_PATHS = [f"/{LANG}", f"/{LANG}/campaigns", f"/{LANG}/campaigns/demo-bringing-amir-home", f"/{LANG}/login",
              f"/{LANG}/start", f"/{LANG}/dashboard", f"/{LANG}/admin/campaigns"]


def warm(pw):
    """Hit the routes once so Next's on-demand compile never lands in a take."""
    b = pw.chromium.launch()
    pg = b.new_page()
    for path in WARM_PATHS:
        try:
            pg.goto(BASE + path, wait_until="networkidle", timeout=60000)
        except Exception:
            pass
    b.close()


def main(argv):
    if "--lang" in argv:
        i = argv.index("--lang")
        argv = argv[:i] + argv[i + 2:]
    names = argv or list(UNITS)
    unknown = [n for n in names if n not in UNITS]
    if unknown:
        sys.exit(f"unknown unit(s): {unknown}. Choose from: {', '.join(UNITS)}")
    with sync_playwright() as pw:
        if any(n != "cards" for n in names):
            warm(pw)
        for n in names:
            run_unit(pw, n)


if __name__ == "__main__":
    main(sys.argv[1:])
