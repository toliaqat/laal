# Ashfaat

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

The schema lives in `supabase/migrations/0001_init.sql`. With the Supabase CLI:

```bash
# install once:  brew install supabase/tap/supabase
supabase init
supabase start          # local Postgres + Studio
supabase db reset       # applies migrations
# generate types to replace the hand-written Row types:
supabase gen types typescript --local > packages/types/src/database.types.ts
```

> RLS is **enabled but unpoliced** in the migration (service-role works, anon is
> locked out). Author policies before any public exposure — intent is documented
> inline in the migration and in ARCHITECTURE.md §3.
