# Laal

Crowdfunding for expat bereavement. See [`ARCHITECTURE.md`](./ARCHITECTURE.md)
for the full design (data model, money flow, decisions).

## Monorepo layout

```
apps/
  web/        Next.js — public campaign + donation pages (SEO, link previews)
  mobile/     Expo / React Native — iOS + Android
packages/
  types/      Shared domain types (mirrors the DB schema) + release-gate logic
  supabase/   Supabase client factories (browser + service-role)
supabase/
  migrations/ Postgres schema (0001_init.sql)
```

## Prerequisites

- Node >= 20 (tested on 25)
- pnpm 9

## Setup

```bash
pnpm install
cp .env.example .env        # fill in Supabase / Stripe / Resend keys
```

## Run

```bash
pnpm web        # Next.js dev server      -> http://localhost:3000
pnpm mobile     # Expo dev server (scan QR with Expo Go)
pnpm typecheck  # typecheck all workspaces
```

## Database

Migrations live in `supabase/migrations/`:

| File | Purpose |
|---|---|
| `0001_init.sql` | Tables, enums, `amount_raised` trigger, RLS enabled |
| `0002_rls.sql` | RLS policies + `is_admin()` / `owns_campaign()` |
| `0003_seed.sql` | Pre-registered partner orgs (embassy verifier, funeral homes) |
| `0004_profile_trigger.sql` | Auto-create a profile row on signup |
| `0005_rls_remaining.sql` | RLS on audit_log, communications, org_members, campaign_updates |
| `0006_storage.sql` | Private `documents` storage bucket |

With the Supabase CLI:

```bash
# install once:  brew install supabase/tap/supabase
supabase init
supabase start          # local Postgres + Studio
supabase db reset       # applies all migrations
# regenerate types to replace the hand-written Row types:
supabase gen types typescript --local > packages/types/src/database.types.ts
```

### Make a user an admin

Admin screens (`/admin`) require `profiles.role = 'admin'`. After signing up:

```sql
update profiles set role = 'admin' where email = 'you@example.com';
```

## Stripe (test mode)

1. Create a Stripe account, enable **Connect**, grab test keys into `.env`.
2. Forward webhooks locally:
   ```bash
   stripe listen --forward-to localhost:3000/api/stripe/webhook
   ```
   Put the printed `whsec_...` into `STRIPE_WEBHOOK_SECRET`.
3. The webhook handles `checkout.session.completed` (records paid donations),
   `account.updated` (beneficiary onboarding), and transfer/payout events.

## End-to-end MVP flow

1. **Sign up** → become an organizer.
2. **/start** → create a campaign (pick a verified partner org or an individual
   beneficiary). Created as `pending_review`; death (+ relationship, for
   individuals) verifications are seeded as `pending`.
3. **Admin** approves the campaign → `active`, and it appears in **/campaigns**.
4. A donor opens the campaign and donates via **Stripe Checkout** (no account
   needed). The webhook records the donation and bumps the raised total.
5. **Admin** verifies the death (and relationship), then sends the beneficiary a
   Stripe onboarding link. Once death is approved + onboarding complete (+
   relationship for individuals), the **release gate** opens.
6. **Admin** releases funds → Stripe transfer to the beneficiary, payout
   recorded, beneficiary emailed.

> Note: in-app document **upload** by organizers is a post-MVP follow-up — the
> `documents` bucket + admin signed-URL viewer exist, and verifications are
> approved manually by an admin (verifier_type `admin`) for now.
