-- 0014 — an explicit "receipt delivered" marker on donations.
--
-- The Stripe webhook used to gate the receipt on "did MY insert create the
-- row?" (ON CONFLICT DO NOTHING ... RETURNING id). That is not the same
-- question as "has the receipt been sent?", and the difference loses receipts:
-- if the insert COMMITS and our 200 is then lost (the very timeout the
-- 500-and-retry path exists for), Stripe redelivers, the redelivery takes the
-- duplicate branch, and nobody ever sends the receipt. The money is banked and
-- the supporter is never told.
--
-- With this column the webhook CLAIMS the send atomically
--   update donations set receipt_sent_at = now()
--    where stripe_payment_intent_id = $1 and receipt_sent_at is null
--   returning id
-- which is a single-statement compare-and-set: exactly one delivery wins,
-- whichever one that is, and a failed send releases the claim (back to null) so
-- a later delivery can try again.
--
-- Nullable and additive: existing rows read as "no receipt recorded", which is
-- correct — they predate the marker, and their receipts were already sent under
-- the old scheme, so nothing re-sends for them (no delivery re-runs for a
-- donation Stripe has long since stopped retrying).
--
-- No RLS change needed: donations RLS is unchanged, inserts/updates here happen
-- through the service-role admin client, and a supporter reading their own row
-- (`donations_select_own`) learning when their own receipt went out is harmless.

alter table donations
  add column if not exists receipt_sent_at timestamptz;

comment on column donations.receipt_sent_at is
  'Set by the Stripe webhook when the donation receipt email was handed to the mail provider. Used as an atomic once-only claim (update ... where receipt_sent_at is null); cleared again if the send fails so a Stripe redelivery retries.';
