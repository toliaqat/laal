# Pre-launch follow-ups

Written during the pre-launch polish pass (branch `polish/pre-launch-ux`). Everything
here was found and deliberately left undone, or must happen at deploy time.

## Must happen at deploy

- **Apply migrations `0012`, `0013`, `0014`.** They were verified end to end against a
  throwaway Postgres but have not been applied to any real database.
- **`0014` must land before the new webhook code.** It adds `donations.receipt_sent_at`,
  which the webhook now uses to claim a receipt send atomically. Deploy the code first
  and every claim fails with an undefined-column error, which is classed as a permanent
  failure and answers 200 — so receipts would be dropped silently.
- **Validate the beneficiary name constraint once.** `0013` adds
  `beneficiaries_display_name_public_shape` as `NOT VALID`, so it governs new writes but
  ignores rows written before it. Until it is validated, a legacy row can still publish
  an unbounded name through the public trust view:

  ```sql
  -- after eyeballing the handful of pre-launch beneficiary rows
  alter table public.beneficiaries
    validate constraint beneficiaries_display_name_public_shape;
  ```

## Product

- **Split the meaning of `paused`.** It currently doubles as the fraud takedown, which is
  why it is deliberately absent from the public status list. A separate benign-hold
  status, or a reason carried on the pause, would let a shared link stay reachable
  without the platform displaying trust badges on a page it has flagged. `paused` must
  stay non-public until that exists.
- **Supporter count on cards.** Donations are private under row-level security, so the
  count cannot come from the anonymous client. It needs a denormalised counter on
  `campaigns`, maintained by the same trigger that keeps `amount_raised` in sync.
- **`deadline` is captured nowhere and displayed nowhere,** so there is no urgency or
  time-left signal on any surface. Cards were deliberately built without that slot.
- **"Closest to goal" sorting** ranks a 200-row window in memory, because the ratio of
  raised to goal cannot be an `ORDER BY` through the REST client. It needs a generated,
  indexed progress column before that window becomes a real cap.
- **`communications` is still unwritten by the application,** so there is no outbound mail
  log. The receipt path now records `receipt_sent_at` on the donation instead.

## Engineering

- **`formatMoney` lives in two places,** one per app. It wants to be a shared package
  consumed by both, along with the locale policy that pins Western digits for Urdu.
- **Two share components exist** (`share-buttons.tsx` and `share-support.tsx`) because
  they were written by different agents in the same pass. Consolidate them.
- **`ActionState.detail` always serializes to the client,** regardless of the `showDetail`
  flag that appears to gate it. Admin surfaces rely on it deliberately; organizer,
  supporter and partner surfaces no longer pass it. Consider removing the field.
- **The organization-member select policy from `0009`** lets partner staff read a campaign
  at any status, so a fraud takedown is not invisible to the beneficiary organization.
- **`beneficiaries_insert`** lets an organizer write the beneficiary row directly through
  the API, which is why the display-name guarantee has to live in the database rather
  than in the form.

## Urdu

Translations are model-generated and were reviewed by a model, not a native speaker. For
a memorial product that deserves a human pass before launch. Specific judgement calls a
native speaker should settle:

| Term | Current choice | Alternative |
|---|---|---|
| memorial label, "in memory of" | بیاد | restructure so "{name} کی یاد میں" works |
| funeral home | تجہیز و تکفین کے ادارے | something less formal |
| reviewed | جانچ شدہ (adjective), جائزہ لینا (verb) | جانچ everywhere |
| update (noun) | تازہ خبر | تازہ احوال, warmer for grief |
