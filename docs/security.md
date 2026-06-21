# Security considerations

This app moves money and stores sensitive documents (passports, death
certificates, NOCs). Read this before touching auth, money, storage, or RLS.

## Trust boundaries

| Boundary | Enforced by | Notes |
|---|---|---|
| User ↔ their own data | **Postgres RLS** | The real boundary. Web + mobile both hit Supabase with the anon key under RLS. |
| Anon user ↔ protected routes | Next middleware | Convenience redirect only — **not** a security boundary. Never rely on it for data protection. |
| App server ↔ everything | service-role key | Bypasses RLS entirely. Server-only. Guard every use with your own auth check. |
| Stripe ↔ webhook | signature verification | `constructEvent(body, sig, secret)`. A request without a valid signature is rejected with 400. |

## Row Level Security (RLS)

- RLS is **enabled and has policies** — see `supabase/migrations/0002_rls.sql`
  and `0005_rls_remaining.sql`. (Note: README/ARCHITECTURE prose still says
  "deferred" — that's stale; the migrations are authoritative.)
- Policy helpers are `is_admin()` and `owns_campaign(uuid)`, both
  `SECURITY DEFINER` with a pinned `search_path` to avoid RLS recursion and
  search-path hijacking.
- Public campaigns are readable only in `active`/`completed`/`closed` status;
  organizers see their own; admins see all. A pending campaign (and its cover
  photo) is not publicly visible until approved.
- **Adding a table → add RLS + policies in the same migration.** An
  un-policied RLS-enabled table is invisible to the anon key (fails closed),
  but an RLS-disabled table is wide open (fails *open*). Never ship a table
  with RLS off.

## The service-role key

`createAdminSupabase()` (web) / `createServiceClient()` (`@laal/supabase`) use
the service-role key and **bypass all RLS**. Rules:

- Server-only. Both files carry `import 'server-only'` / are documented as such.
  Never import into a client component or the mobile app.
- It is not authorization — it's the *absence* of it. Always authorize the
  caller first (`requireAdminId()` in admin actions; signature check in the
  webhook; `getCurrentUser()` + ownership elsewhere).
- The key lives only in server env (`fly secrets set`), never in
  `NEXT_PUBLIC_*`, never in `[build.args]`.

## Authorization patterns

- **Admin actions** (`app/admin/**/actions.ts`): every action calls
  `requireAdminId()`, which re-reads `profiles.role`. Middleware guarding
  `/admin` is *not* enough — server actions are independently invocable by URL.
- **Organizer ownership**: actions check `organizer_id === user.id` (or rely on
  the `campaigns_update_own_or_admin` policy). Organizers can only edit a
  campaign while it's `draft`/`pending_review`.
- **Beneficiary selection** is validated server-side: only a `verified`,
  `can_be_beneficiary` org can receive funds (see `app/start/actions.ts`).

## Money safety

- **Funds are held, not auto-released.** We use separate charges & transfers —
  donations pool in the platform balance; a transfer happens only when
  `canReleaseFunds(...)` passes and an admin acts. This is also the
  chargeback/dispute buffer.
- **The release gate is one function** (`canReleaseFunds`, `@laal/types`). Don't
  duplicate the rule — call it.
- **Transfers use an idempotency key** (`transferToBeneficiary`) so a retried or
  concurrent release can't double-pay.
- **Webhook is idempotent**: donations upsert on the UNIQUE
  `stripe_payment_intent_id`; non-`paid` sessions are skipped so
  `amount_raised` can't be inflated before funds settle.
- **Audit log** (`logAudit`) records money/verification actions to an
  append-only `audit_log` (no client RLS write path; written via service role).
  Add an audit entry to any new money/verification action.

## File uploads

- **Two buckets, two trust models** (`apps/web/lib/r2.ts`):
  - Private `R2_BUCKET` — verification documents. Reads are **short-lived
    presigned GET URLs** (default 300s); objects are never world-readable.
  - Public `R2_PUBLIC_BUCKET` — campaign cover images only, world-readable.
  - Keeping them physically separate is the security boundary: a misconfig
    can't expose a passport scan. **Never write a document to the public
    bucket.**
- **All uploads are server-side and authorized first** — we check campaign
  ownership before `PutObject`. No direct-to-bucket browser uploads (no CORS
  surface).
- **Cover images are re-encoded with `sharp`** → strips EXIF/GPS, neutralizes
  payloads hidden in the container, resizes, converts to WebP. Validate
  type/size before processing (`assertValidCoverFile`). Apply the same hygiene
  to any future user-uploaded image.
- **Object keys are randomized**, so URLs aren't guessable/enumerable.

## Secrets & config

- Server secrets (`SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`,
  `STRIPE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `R2_*`) are set via
  `fly secrets set` and read at runtime — never baked into the image, never
  `NEXT_PUBLIC_*`. See [`/DEPLOY.md`](../DEPLOY.md).
- Only genuinely public values are `NEXT_PUBLIC_*` (Supabase URL + anon key,
  Stripe publishable key, app URL). The anon key is *meant* to be public — RLS
  is what protects the data behind it.
- `.env` is gitignored; `.env.example` is the template — keep it complete.

## When reviewing a change, ask

1. Did this use the anon client (RLS) where it should, or reach for
   service-role unnecessarily?
2. Is every service-role / admin path authorized *before* the privileged call?
3. New table → RLS enabled + policies added?
4. New money path → idempotent + audit-logged + gated by `canReleaseFunds`?
5. New upload → server-authorized, correct bucket, re-encoded if an image?
