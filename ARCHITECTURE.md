# Ashfaat — Architecture

Crowdfunding for expat bereavement. Anyone can create a donation campaign for
someone who has died abroad; others donate; the platform handles communications
and disburses funds to a **verified beneficiary** only after verification passes.

> **One-line mental model:** this is a *payments + trust* app that happens to
> have a UI. The schema and money flow are the product; the screens are skin.

---

## 1. Scope & decisions made

| Decision | Choice | Why |
|---|---|---|
| Corridors (v1) | Western only — US / UK / EU / CA / AU | Stripe Connect fully supports collect **and** payout here; no exotic local rails |
| Primary surface | **Mobile-first**, thin web for shared donation/campaign pages | Donations spread via shared links; a link must open *somewhere* on the web without forcing an install |
| Beneficiary | **Two-track**: a verified partner organization **or** the organizer's own Stripe account | High-trust default with a graceful fallback; works with *zero* orgs onboarded |
| Verifier vs. beneficiary | **Decoupled** — they are different roles | An embassy *verifies* a death; a funeral home *gets paid*. Real-world flow (e.g. Pakistan embassy issues NOC, Servilusa handles burial) |
| Custody | Funds sit in the **platform Stripe balance**, released by transfer | Platform is a *router*, not a custodian — keeps us out of money-transmitter territory |

### Verifier ≠ beneficiary
This is the core insight. `verifications.verifier_org_id` (e.g. the embassy)
is a *different* column from `beneficiaries.organization_id` (e.g. the funeral
home or the family). One campaign can have an embassy verifier **and** a
funeral-home beneficiary at the same time. Embassies are hard to onboard as
money recipients but natural as *verifiers* — so we ask them only for the light
lift.

---

## 2. Tech stack

| Layer | Choice | Notes |
|---|---|---|
| Mobile | **Expo / React Native** | iOS + Android from one codebase; EAS builds |
| Web (thin) | **Next.js** (Vercel / Cloudflare) | Public campaign + donate pages; SEO + Open Graph link previews |
| Backend / DB | **Supabase** — Postgres + Auth + Storage + Edge Functions | Cheap/free to start; real SQL (portable) |
| Payments | **Stripe Connect (Express accounts)** | Stripe hosts beneficiary KYC/bank onboarding → carries the compliance load |
| Email | **Resend** | |
| Push / SMS | **Expo Push** / **Twilio** | |
| Language | **TypeScript everywhere** | Shared types across web, mobile, Edge Functions |

**App-store note:** Apple/Google charge 30% on *digital goods* via in-app
purchase, but **donations / person-to-person payments are exempt** and *must*
use a real processor (Stripe), not IAP. So Stripe-in-app is correct and allowed
— just present it clearly as charitable giving.

---

## 3. Data model

Full DDL: [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).

Tables: `profiles`, `organizations`, `organization_members`, `campaigns`,
`beneficiaries`, `verifications`, `documents`, `donations`, `payouts`,
`campaign_updates`, `communications`, `audit_log`.

Design points baked into the schema:

- **Two-track beneficiary, enforced by a CHECK** — a beneficiary is *either* an
  org or an individual, never both, never neither. A partial unique index
  (`one_active_beneficiary`) guarantees one active beneficiary per campaign.
- **Trust tier is derived, not stored** — it falls out of the release gate
  (below); no `trust_tier` column to drift.
- **Money never touches our bank** — `payouts` records Stripe *transfers*
  (platform balance → connected account). Donations land in the platform
  balance and stay `held` until release.
- **Guest donations are first-class** — `donations.donor_profile_id` is
  nullable; most donors arrive from a shared link and won't sign up.
- **`amount_raised` is a cached column** kept in sync by the
  `trg_sync_amount_raised` trigger (handles insert, success-transition, refund,
  delete).
- **`audit_log`** captures every money/verification action for trust &
  compliance.

---

## 4. Money flow (Stripe Connect — "separate charges and transfers")

We collect now but release later, conditionally — so we do **not** attach
`transfer_data`/`application_fee` at charge time. Funds pool in the platform
balance and are transferred on release.

```
① ONBOARD BENEFICIARY (once per org, once per individual)
   accounts.create({type:'express', capabilities:{transfers}})  -> save acct id
   accountLinks.create(...)        -> beneficiary does KYC + bank on Stripe UI
   webhook account.updated         -> when payouts_enabled, set onboarding_complete

② COLLECT DONATION  (-> lands in PLATFORM balance)
   paymentIntents.create({amount, currency})    // platform is merchant
   webhook payment_intent.succeeded -> donations row 'succeeded',
                                       amount_raised += amount (trigger),
                                       queue donation_receipt

③ HOLD            funds wait in platform balance while verification runs
                  (this is also the chargeback/dispute buffer)

④ RELEASE         when gate passes (see below), admin releases:
   transfers.create({amount, currency, destination: connectedAcct})
   -> payouts row, stripe_transfer_id, status 'in_transit'

⑤ PAYOUT TO BANK  Stripe auto-pays the connected account's balance to its bank
   webhook payout.paid -> payouts.status 'paid'
```

### The release gate (= the trust mechanic)

> Release is allowed when:
> **`death` verification approved** **AND** beneficiary `stripe_onboarding_complete`
> **AND** (for `individual` beneficiaries) a `relationship` verification approved.
> **Organization** beneficiaries skip the relationship check (vetted at onboarding).

This single rule is the entire "high-trust path is the easy path" design — org
beneficiaries clear the gate faster, which steers campaigns toward verified
partners.

### Money policy decisions (recommended defaults)

| Question | Recommendation |
|---|---|
| Platform fee | 0% + optional donor "tip to cover costs" (keeps "100% to the family") |
| Stripe processing fee (~1.5–3%) | Optional donor cover at checkout |
| **Chargebacks after release** (real risk) | Mandatory hold window (e.g. release ≥7 days post-donation + verification) so disputes settle while funds are still in our balance |
| Refunds | Allowed **only before release** (post-release requires reversing a transfer) |
| Partial / tranche releases | Supported — `payouts` is one-campaign-to-many |
| FX (e.g. GBP donor → EUR funeral home) | Stripe converts at transfer/payout (~2% fee); donor-cover same as above |

---

## 5. Campaign state machine

```
draft ──> pending_review ──> active (collecting) ──[gate passes]──> releasable
                                                                       │
                                                                       ▼
                                                          completed (funds transferred)
                                                                       │
                                                                       ▼
                                                                     closed

  pending_review / active ──> rejected   (failed review or verification)
  active ──> paused ──> active            (temporary hold)
```

The `held → releasable` boundary **is** the verification gate. Everything
upstream is content/review; everything downstream is money movement.

---

## 6. MVP scope

**In:**
- Auth + profiles (Supabase Auth).
- Create campaign (organizer) → admin review → activate.
- Public campaign page + guest donation (Stripe Checkout/PaymentIntent).
- Document upload + admin verification (death / relationship).
- Manual payout release by admin once the gate passes.
- A handful of partner `organizations` created **manually by admin** (we have
  connections; their Stripe Connect set up out-of-band, or first payouts done as
  recorded manual bank transfers).
- Transactional email (receipts, payout-released) via Resend.

**Deferred (post-MVP):**
- Org self-serve signup, org dashboards, `organization_members` invites.
- Automated payout scheduling (release manually in v1 — safer while learning
  fraud patterns).
- `campaign_updates` feed, push/SMS.
- **RLS policies** — migration enables RLS but defers policies; author them
  before public launch (intent documented inline in the migration).

**Orgs are additive, not blocking:** the individual-beneficiary track makes the
app useful with zero orgs onboarded; partners are a trust upgrade layered on top.
