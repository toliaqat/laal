# Laal — product demo video

A 3½-minute walkthrough of Laal for potential customers, recorded from the
**real web app** (not a mock-up): browsing fundraisers, supporting a family
through Stripe, an organizer creating a fundraiser with a photo, the admin
review, and the mobile / Urdu experience.

**Deliverable:** `build/laal-demo-1920x1080.mp4` (1080p, 30 fps, H.264 + AAC).

Everything is regenerable from source, so a copy change, a new photo, or a
tweak to one screen is a re-run of one step, not a re-shoot.

```
demo-video/
├── script/
│   ├── storyboard.json   ← THE source of truth: scene order, narration, lower thirds, timing
│   └── SCRIPT.md         ← human-readable shooting script (generated: make script)
├── assets/
│   ├── portraits/        ← the "deceased" portraits (AI-generated faces, 7:9 crops) + raw/
│   └── music/score.wav   ← the bed (original synthesized score from intro-video/)
├── seed/
│   ├── seed.sh           ← resets the LOCAL Supabase to the demo state (accounts, photos, SQL)
│   └── demo-seed.sql
├── pipeline/
│   ├── record.py         ← drives the app in headless Chromium and captures each scene
│   ├── cards.html        ← title cards + lower thirds (brand tokens from globals.css)
│   ├── stage.html        ← the two-phone stage for the mobile scene
│   ├── narrate.py        ← voice-over via Deepgram Aura-2 (macOS `say` fallback)
│   ├── assemble.py       ← ffmpeg: dissolves, lower thirds, VO, ducked music → final mp4
│   └── script_md.py      ← storyboard.json → SCRIPT.md
├── .env.demo             ← web-app env that points at the local stack only
├── Makefile
└── build/                ← generated (frames, per-scene mp4s, vo, cards, final)
```

## Run it

One-time prerequisites: `supabase start` (local stack), Python 3.11 with
`playwright` + `Pillow` (`pip install playwright pillow && playwright install chromium`),
`ffmpeg`, and the Stripe CLI logged in (`stripe login`).

```bash
# terminal 1 — the web app, against the LOCAL Supabase (never production)
make web

# terminal 2 — Stripe test-mode webhooks (optional: only affects the supporter wall)
make stripe

# terminal 3
make all              # seed → record every scene → narrate → assemble
```

Individual steps:

| Command | What it does |
|---|---|
| `make seed` | Reset the local DB: demo accounts, portraits in the local bucket, campaigns, trust rows, supporter wall |
| `make record U=help` | Re-record one *unit* (`home browse fundraiser help start review mobile cards`) |
| `make narrate` | Regenerate the voice-over after editing narration in `storyboard.json` |
| `make assemble` | Re-cut the final video from whatever is in `build/` |
| `make script` | Regenerate `script/SCRIPT.md` |

`pipeline/assemble.py --fast --out build/preview.mp4` gives a quick low-quality
preview; `--scenes 03-fundraiser 04-help` cuts a subset.

## How to change things

- **Words.** Edit `narration` / `lower_third` in `script/storyboard.json`, then
  `make narrate assemble`. Scene length is `max(recorded footage, narration + 1s, min_seconds)`;
  the last frame is held if the narration runs longer than the footage.
- **A photo.** Drop a 1024×1024-ish face into `assets/portraits/raw/<slug>.jpg`,
  re-run the crop (`python3 - <<'EOF'` in the git history of this folder, or just
  save a 700×900 JPEG straight into `assets/portraits/<slug>.jpg`), then
  `make seed` and re-record the units that show it. The slug ↔ person mapping is
  at the top of `seed/demo-seed.sql`; the photo the organizer uploads on camera
  is `assets/portraits/raw/ahmed-raza.jpg` (`NEW_FUNDRAISER` in `record.py`).
- **A story, name, city, amount.** `seed/demo-seed.sql` (seeded fundraisers) or
  `NEW_FUNDRAISER` / `SUPPORTER` in `pipeline/record.py` (what is typed on camera).
- **Pacing / what the cursor does.** The scene functions (`unit_*`) in
  `pipeline/record.py`; the feel (eased mouse travel, click ripple, typing
  speed, scroll easing) lives in the `Actor` class. `a.cut_from()` / `a.cut_to()`
  make a jump cut over a slow page load.
- **Look of the cards and lower thirds.** `pipeline/cards.html`; the phones in
  `pipeline/stage.html`.
- **Voice.** Narration comes from Deepgram Aura-2 (`voice.engine: deepgram`,
  `voice.name` is the model, e.g. `aura-2-thalia-en`; key in `.env.demo` as
  `DEEPGRAM_API_KEY`). `make narrate` regenerates it; `python3 pipeline/narrate.py --samples`
  renders one line in six voices into `build/vo-samples/` to choose from.
  Without a key it falls back to macOS `say`. To use a recorded human narrator,
  put `build/vo/<scene-id>.wav` in place and run `make assemble`.
- **Music.** Replace `assets/music/score.wav`; `music.gain_db` in the storyboard
  sets the bed level (it is side-chain ducked under the narration).
- **Transitions and overlay timing.** Constants at the top of `pipeline/assemble.py`.

## How a scene is captured

`record.py` opens the app at 1920×1080 with a 4/3 CSS zoom (the app is laid out
for ~1440 px), injects a brand-coloured cursor and click ripple, hides the
Next.js dev badge, and pulls frames through the Chrome DevTools screencast
(JPEG q95). Frames are timestamped, so holds cost nothing and the per-scene
mp4 is exact. Nothing is composited afterwards except the lower thirds.

The Stripe Checkout page is the real hosted test-mode page; two cosmetic text
nodes ("laal sandbox" → "Laal", the *Sandbox* badge) are rewritten before
capture. The thank-you page's share URL is rewritten from `localhost:3000` to
`laal.app` for the same reason.

## Demo data and accounts

Everything runs against the local Supabase (`supabase start`); `.env.demo`
overrides the production URLs in `../.env`. The seed refuses to run if it finds
a non-demo campaign, and cover uploads go to the local storage S3 gateway
(`R2_ENDPOINT`), so the real R2 buckets are never touched.

| Account | Password | Role in the demo |
|---|---|---|
| `hamza@laal.demo` | `LaalDemo2026` | organizer — Amir's brother; creates "Bring Ahmed home to Lahore" on camera |
| `organizer@laal.demo` | `LaalDemo2026` | admin (Ayesha Rahman) — reviews and approves it |
| `sara@laal.demo` | `LaalDemo2026` | supporter (the on-camera donation is made as a guest) |

All portraits are **AI-generated faces** (thispersondoesnotexist), cropped to
the app's 7:9 frame — no real person is shown as deceased. Spare faces are in
`assets/portraits/raw/spare-*.jpg`.

## On the website

The landing-page hero plays the same cut (`apps/web/components/demo-video.tsx`,
URLs from `apps/web/lib/demo-video.ts`): a silent 15 s teaser loop in a 16:9
card, and the full video in a lightbox on click. The poster ships in
`apps/web/public/demo/`; the two video files live in the public R2 bucket under
`site/demo/`, served immutable for a year.

```bash
make web-assets   # 1080p web encode + teaser + poster from the current cut
make publish      # upload both mp4s to R2 (reads R2_* from ../.env; needs the AWS CLI)
```

When the video changes, bump the version in BOTH `pipeline/publish.sh`
(`DEMO_VERSION`) and `apps/web/lib/demo-video.ts` (`VERSION`) so the new files
get new names — otherwise the CDN keeps serving the old ones. Never probe a
new URL before it is uploaded: Cloudflare caches the 404 for hours.

## Known limitations

- Two small product tweaks live outside this folder and are needed for the
  recording: an optional `R2_ENDPOINT` override in `apps/web/lib/r2.ts`, and the
  admin fundraiser page showing the same portrait component as every other
  surface (`apps/web/app/[locale]/admin/campaigns/[id]/page.tsx`).
- The Stripe webhook only reaches the app if `stripe listen` is running on the
  same sandbox as the keys in `.env`; without it the on-camera €50 shows on the
  thank-you page but not on the supporter wall (the video does not depend on it).
- The hero video is English on the Urdu site too; an Urdu narration would be a
  second `voice` + a second publish, the player already reads its labels from
  `home.video.*`.
- The cursor is not drawn on the Stripe page (their page swallows the injected
  overlay); clicks there still show through the form's own focus states.
