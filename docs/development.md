# Development guide

How the codebase is wired, and how to add a feature, fix a bug, or avoid the
sharp edges. Read [`/ARCHITECTURE.md`](../ARCHITECTURE.md) first for the *why*.

## Commands

```bash
pnpm install
pnpm web         # Next.js dev → http://localhost:3000
pnpm mobile      # Expo dev server
pnpm typecheck   # tsc --noEmit across all workspaces (run before every PR)
pnpm lint        # next lint
pnpm build       # turbo build
```

There is **no test suite** yet. `pnpm typecheck` is the safety net — TypeScript
is strict and shared types are the contract, so a green typecheck catches most
breakage. Verify money/auth changes by hand (see "Fixing a bug" below).

## How the web app is wired

Next.js App Router. Three kinds of server code, each with a clear trust level:

| Construct | File pattern | Auth model |
|---|---|---|
| **Server Component** (page) | `app/**/page.tsx` | Runs on the server; reads via `createServerSupabase()` (anon key, **RLS applies**). |
| **Server Action** | `app/**/actions.ts` (`'use server'`) | Form/mutation handlers. Re-check the caller every time — see below. |
| **Route Handler** | `app/api/**/route.ts` | The Stripe webhook. Verifies a signature, not a session. |

Supabase clients (`apps/web/lib/supabase/server.ts`):

- `createServerSupabase()` — anon key + the user's session cookie. **RLS
  enforced.** Default for anything acting *as the user*.
- `createAdminSupabase()` — service-role key. **Bypasses RLS.** Server-only.
  Use only for trusted backend work (webhook, admin actions, profile bootstrap)
  and only *after* you've authorized the caller yourself.
- `getCurrentUser()` — the authenticated user or `null`.

**Middleware** (`apps/web/middleware.ts` → `lib/supabase/middleware.ts`)
refreshes the session on every request and redirects unauthenticated users away
from `/start`, `/dashboard`, `/admin`. Middleware is a convenience gate, **not**
the security boundary — RLS + per-action checks are. Add new protected route
prefixes to `PROTECTED_PREFIXES`.

Env access goes through `apps/web/lib/env.ts` — never read `process.env`
directly. Values are read **lazily** (a function call per var) so a build
without secrets doesn't crash; a missing var throws on first use, not at boot.
`NEXT_PUBLIC_*` vars must be referenced as static literals (already done in
`env.ts`) so Next inlines them into the client bundle.

## How the mobile app is wired

Expo Router (file-based, `apps/mobile/app/`). Talks to Supabase directly with
the anon key (`lib/supabase.ts`) — same RLS as the web client, no custom
backend. Auth state lives in `lib/auth.tsx`; Google sign-in in
`lib/google-auth.ts`. Theme/tokens in `lib/theme.ts`. Builds ship via EAS
(`eas.json`), not Fly.

## Money flow (where the code lives)

All Stripe calls are in `apps/web/lib/stripe.ts` (lazily-constructed client).
The flow maps 1:1 to ARCHITECTURE §4:

- **Onboard beneficiary** → `createConnectAccount` + `createOnboardingLink`
  (admin actions).
- **Collect** → `createDonationCheckout` (Checkout Session, no `transfer_data` —
  funds land in the platform balance).
- **Webhook** (`app/api/stripe/webhook/route.ts`) records the donation and syncs
  onboarding/transfer/payout state. See gotchas below.
- **Release** → `transferToBeneficiary`, gated by `canReleaseFunds`
  (`@laal/types`) in `app/admin/actions.ts`.

`amount_raised` on a campaign is **not** written by app code — a DB trigger
(`trg_sync_amount_raised`) keeps it in sync as donations change. Don't update it
manually.

## Adding a feature

### A new public/organizer page (web)
1. `app/<route>/page.tsx` as a Server Component. Read data with
   `createServerSupabase()` so RLS scopes it to the caller.
2. Mutations → a sibling `actions.ts` with `'use server'`. Inside it:
   `getCurrentUser()`, validate `FormData`, enforce ownership, write, then
   `revalidatePath()` or `redirect()`. See `app/start/actions.ts` for the
   canonical shape (validate → insert campaign → insert beneficiary → seed
   verifications).
3. If you add a DB column/table, write a migration (next section) **and** update
   the matching type in `packages/types/src/index.ts` — they're kept in sync by
   hand.
4. Keep user-facing strings within the [`/BRAND.md`](../BRAND.md) glossary.

### A public view of private data
Need to show a subset of a private (RLS-protected) table publicly — e.g. donor
messages from `donations`? Don't loosen RLS. Read with the service-role client,
re-check public visibility yourself, and return an **explicit allow-list** of
safe columns (never the raw row). See `app/campaigns/[slug]/supporters.ts` and
the security doc's "Exposing public data from a private table".

### A new admin action
Put it in `app/admin/**/actions.ts`. **Always** start with `requireAdminId()`
(re-checks `profiles.role === 'admin'`) even though middleware guards `/admin` —
actions are independently callable. Record money/verification actions with
`logAudit(...)` from `lib/audit.ts`.

### A schema change
1. Add `supabase/migrations/000N_*.sql` (next number; never edit a shipped
   migration — they're append-only). Enable RLS on any new table and add
   policies *in the same migration* — don't ship an unprotected table.
2. `supabase db reset` applies all migrations locally.
3. Mirror the change in `packages/types/src/index.ts` (enums + Row interface).
4. (Optional) regenerate types: `supabase gen types typescript --local`.

### A new Stripe event
Add a `case` to the `switch` in the webhook. Handlers must be **idempotent**
(Stripe retries and re-delivers) and best-effort (log + return 200 on
app-level errors so Stripe stops retrying).

## Fixing a bug

1. **Reproduce locally.** `pnpm web`, sign up, make yourself admin:
   `update profiles set role = 'admin' where email = 'you@example.com';`
2. **Money / webhook bugs:** run `stripe listen --forward-to
   localhost:3000/api/stripe/webhook`, put the printed `whsec_...` in
   `STRIPE_WEBHOOK_SECRET`, and trigger a real test checkout. Webhook handlers
   `console.error` on failure but still return 200 — check the **server logs**,
   not the HTTP status, when a donation doesn't record.
3. **"Permission denied" / empty query results:** almost always RLS. Confirm
   which client you used — `createServerSupabase` (RLS) vs `createAdminSupabase`
   (bypasses). Test the policy directly in Supabase Studio as the user's role.
4. **A value the user can see but shouldn't, or vice versa:** check the policy
   in `0002_rls.sql` / `0005_rls_remaining.sql`, not just the query.
5. **Typecheck after.** `pnpm typecheck`. If you touched the schema, re-check
   that `packages/types` still matches.

## Gotchas

- **`packages/types` is hand-mirrored from the SQL.** Change one, change both,
  or types silently lie. There's no codegen wired in by default.
- **RLS docs are stale (FIXME).** README and ARCHITECTURE §6 still say "RLS
  policies deferred" — but `0002_rls.sql` and `0005_rls_remaining.sql` add them.
  RLS is **on**. Trust the migrations over the prose until those are updated.
- **`createAdminSupabase()` bypasses RLS.** It is the keys-to-the-kingdom client.
  Authorize the caller yourself before using it; never import it into client
  code. It already lives behind `import 'server-only'`.
- **Webhook idempotency rides on a UNIQUE constraint.** Donations upsert on
  `stripe_payment_intent_id` (UNIQUE). Async payment methods (SEPA/iDEAL)
  complete a session while still `unpaid`; the handler skips non-`paid` sessions
  so `amount_raised` isn't inflated before the money exists. Don't "simplify"
  that guard away.
- **`amount_raised` is trigger-maintained.** Never set it from app code.
- **Don't edit shipped migrations.** Always add a new numbered file.
- **Lazy env = errors surface late.** A missing var throws on first *use* (e.g.
  first cover-image upload), not at deploy. Set all of `.env.example` before
  exercising a feature.
- **Cover image keys are random per upload.** Replacing an image writes a fresh
  key (busts CDN cache) and deletes the old object — don't assume a stable key.
- **Two R2 buckets, two trust models.** Private (`R2_BUCKET`, presigned reads)
  vs public (`R2_PUBLIC_BUCKET`, world-readable). Never cross them — a verification
  document must never land in the public bucket. See `lib/r2.ts`.
- **Scale-to-zero cold starts.** Fly runs `min_machines_running = 0`; the first
  request after idle is slow. Not a bug. Stripe webhook retries absorb it.
