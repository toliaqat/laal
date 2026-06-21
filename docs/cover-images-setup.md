# Campaign cover images — setup

Organizers can now add a cover ("hero") photo of their loved one when creating a
campaign (`/start`) and edit/remove it later (`/dashboard/campaigns/[id]/edit`).
Images are public, served from a **separate public R2 bucket** so they can never
be mixed up with the private verification documents.

The code is done. To turn the feature on you need to create the public bucket
and set two environment variables. ~10 minutes in the Cloudflare dashboard.

## 1. Create a second, public R2 bucket

The existing `R2_BUCKET` (e.g. `laal-documents`) stays **private** — don't touch
it. Cover images go in a new bucket.

1. Cloudflare dashboard → **R2** → **Create bucket**.
2. Name it e.g. `laal-public`. Pick the same location as your other bucket.
3. Open the new bucket → **Settings** → **Public access**.

You have two ways to expose it publicly — pick one:

### Option A (recommended): custom domain

1. Under **Public access → Custom Domains**, click **Connect Domain**.
2. Enter a subdomain you control, e.g. `img.laal.app`. Cloudflare adds the DNS
   record automatically if the zone is on your account.
3. Once it shows **Active**, your base URL is `https://img.laal.app`.

Custom domains get Cloudflare CDN caching and a clean URL. Prefer this for
production.

### Option B (quick): r2.dev managed URL

1. Under **Public access → R2.dev subdomain**, click **Allow Access** and confirm.
2. Cloudflare gives you a URL like `https://pub-xxxxxxxx.r2.dev`.
3. That string (no trailing slash) is your base URL.

Fine for staging. The r2.dev domain is rate-limited and not meant for high
production traffic, so move to Option A before launch.

## 2. Reuse (or scope) your API token

The app authenticates to R2 with the existing `R2_ACCESS_KEY_ID` /
`R2_SECRET_ACCESS_KEY`. An **Account-level** R2 API token with *Object Read &
Write* already covers the new bucket — nothing to change.

If your current token was scoped to only the documents bucket, edit it (R2 →
**Manage R2 API Tokens**) to also allow the new bucket, or create a new
account-scoped token.

> Note: making the **bucket** public (steps above) is what lets the public read
> images over HTTP. The API token is only used by our server to **upload** —
> uploads are always authorized server-side (we check campaign ownership first).

## 3. Set environment variables

Add these alongside the existing R2 vars (`.env`, and your hosting provider's
env settings — Vercel/Fly/etc.). See `.env.example`.

```bash
# Existing — leave as-is (private bucket)
R2_BUCKET=laal-documents

# New — public bucket for cover images
R2_PUBLIC_BUCKET=laal-public
# Base URL from step 1, NO trailing slash:
R2_PUBLIC_BASE_URL=https://img.laal.app      # custom domain
# or: R2_PUBLIC_BASE_URL=https://pub-xxxxxxxx.r2.dev
```

Redeploy after setting them. The app reads env lazily, so a missing var only
errors when someone actually uploads a cover image — not at boot.

## 4. (Recommended) CORS — only if you later move to direct browser uploads

Not needed today: uploads currently go **through our server**, so no browser
CORS is involved. If you later switch to presigned direct-to-R2 uploads from the
browser, add a CORS policy to the public bucket allowing `PUT` from your app
origin. Skip for now.

## How it works (for reviewers)

- **Upload path** is server-side only (`apps/web/lib/cover-image.ts`):
  every image is re-encoded with `sharp` → **strips EXIF/GPS**, neutralizes
  payloads hidden in the container, resizes to max 1600px, converts to WebP.
- **Keys are randomized** (`campaigns/{id}/cover/{rand}.webp`) — not guessable,
  and a fresh key per upload defeats stale CDN caching on replace.
- **Stored value** is the full public URL in `campaigns.cover_image_url`
  (the column already existed). The public campaign page and OG/Twitter image
  tags already read it.
- **Two buckets, two trust models** (`apps/web/lib/r2.ts`): private docs use
  short-lived presigned GET URLs; public covers are world-readable. Keeping them
  separate is the security boundary — a misconfig can't expose a passport scan.

## Moderation / review gate

A cover image only renders on the **public** campaign page, which already only
shows `active` / `completed` / `closed` campaigns. So a pending campaign's photo
is not publicly visible until an admin approves it. Admins see the pending photo
on the campaign review screen (`/admin/campaigns/[id]`) so they can vet it before
approving.

Editing is limited to `draft` / `pending_review` status (existing edit-page
rule), so an organizer can't silently swap in a different image after approval.
If you later allow editing live campaigns, consider re-queuing the photo for
review on change.
