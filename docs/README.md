# Laal — Developer Docs

Start here if you're new. The high-level design lives in the **root** docs; the
day-to-day "how do I work in this codebase" guides live in **`docs/`**.

## Read in this order

1. [`/README.md`](../README.md) — setup, run commands, DB migrations, the
   end-to-end MVP flow.
2. [`/ARCHITECTURE.md`](../ARCHITECTURE.md) — data model, money flow, the
   release gate, campaign state machine. **The schema and money flow are the
   product — read this twice.**
3. [`development.md`](./development.md) — code conventions, how things actually
   work, how to add a feature, how to fix a bug, gotchas.
4. [`security.md`](./security.md) — trust boundaries, RLS, service-role, secrets,
   file uploads. Read before touching auth, money, or storage.
5. [`/DEPLOY.md`](../DEPLOY.md) — Fly.io deploy, R2 setup, Stripe webhook.
6. [`/BRAND.md`](../BRAND.md) — user-facing copy rules (the word-swap glossary).
7. [`cover-images-setup.md`](./cover-images-setup.md) — the public-bucket feature
   setup (one feature's runbook; a good example of how a feature is documented).

## Repo map

```
apps/
  web/      Next.js 15 (App Router, React 19). Public pages + donate flow +
            organizer dashboard + /admin + the Stripe webhook. Deploys to Fly.
  mobile/   Expo / React Native (Expo Router). iOS + Android. Ships via EAS.
packages/
  types/    Shared domain types (mirror of the DB) + the release-gate rule
            (canReleaseFunds). Imported as @laal/types.
  supabase/ Supabase client factories (browser anon + service-role). @laal/supabase.
supabase/
  migrations/  Postgres schema, RLS policies, triggers, seed. Source of truth
               for the DB. packages/types mirrors these by hand.
```

The web app is the only thing with a backend (server actions + the webhook).
Mobile and web both talk to Supabase directly under RLS.

## One-line mental model

A **payments + trust** app. Funds pool in the platform Stripe balance and are
released to a verified beneficiary only after the **release gate** passes
(`canReleaseFunds` in `packages/types`). Everything else is UI around that rule.

## Glossary (code terms ≠ user-facing copy)

| Code / DB term | What it is |
|---|---|
| `campaign` | A fundraiser for one deceased person. Has a `status` state machine. |
| `beneficiary` | Who receives funds — an **org** or an **individual** (never both). |
| `verification` | A `death` / `relationship` / `identity` check an admin approves. |
| `verifier` ≠ `beneficiary` | The party that *vouches* (e.g. embassy) is decoupled from who *gets paid* (e.g. funeral home). |
| `payout` | A Stripe **transfer** (platform balance → connected account). |
| release gate | The single rule that allows a payout. See ARCHITECTURE §4. |

> In **user-facing copy**, "donation/donor/case" become "support/supporter/story"
> — see [`/BRAND.md`](../BRAND.md). Code, DB, and admin tooling keep the technical
> terms.
