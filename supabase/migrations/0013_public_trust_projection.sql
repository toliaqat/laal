-- ============================================================================
-- 0013_public_trust_projection — let supporters actually SEE the trust facts.
--
-- The product promise is that support reaches a *verified beneficiary* and that
-- every fundraiser is *reviewed*. None of that was visible to a supporter:
--
--   * `beneficiaries_select` (0002_rls.sql) is `owns_campaign() OR is_admin()`,
--     so the "your support reaches X" line rendered empty for every visitor
--     arriving from a shared link — only the organizer and admins ever saw it.
--   * `verifications_select` is likewise organizer-or-admin, so no surface could
--     render a verification badge at all. Mobile compensated with a hard-coded
--     "Verified fundraiser" chip — a false trust claim in a bereavement product.
--   * `profiles_select_self_or_admin` hides the organizer's name, so nothing
--     could say who started the fundraiser.
--
-- Those policies are correct: those tables hold emails, phone numbers, Stripe
-- account ids and document references. Rather than loosening them, this
-- migration adds a narrow **public trust projection**: a definer-rights view
-- that exposes only the handful of non-identifying trust facts a supporter
-- legitimately needs, for publicly-visible fundraisers only.
--
-- Design rules followed here:
--   1. Allow-list, never `select *` — every column is named and justified.
--   2. Nothing about money movement (Stripe ids, bank state, payouts) and
--      nothing about donations.
--   3. No contact details (email/phone), no document rows or storage paths,
--      no primary keys of private rows (no beneficiary/profile/organization ids)
--      — an id is a lookup handle, and handles leak.
--   4. Given name only for the organizer; surnames stay private.
--   5. The row filter mirrors `campaigns_select_public` exactly, so this view can
--      never expose a campaign the campaigns table itself would hide.
--   6. RLS does NOT apply inside a definer view, so every gate a base table's
--      policy would have applied is restated here as a join/where condition
--      (see the organizations `status = 'verified'` join), and anything the view
--      projects that a client could filter on is bounded by a CHECK constraint
--      on the base table rather than by form validation alone.
--
-- ----------------------------------------------------------------------------
-- ON 'paused' — READ THIS BEFORE ADDING IT TO ANYTHING BELOW.
--
-- An earlier draft of this migration added 'paused' to the public select
-- policies so that a shared link to a benignly-paused fundraiser would render
-- the calm "support is paused" card instead of a 404. That was reverted on
-- purpose, because 'paused' is also the platform's ONLY takedown lever:
-- admin `pauseCampaign` (app/[locale]/admin/actions.ts) is what an admin
-- reaches for when they suspect fraud. If 'paused' were publicly readable, a
-- fundraiser we flagged would stay world-readable AND keep displaying
-- "Fundraiser reviewed" / "Need verified" and naming the beneficiary — the
-- platform vouching for content it has itself flagged. Closing the donate path
-- is not enough; the endorsement is the harm.
--
-- So a paused fundraiser is NOT publicly visible: not here, not in the
-- campaigns / campaign_updates policies, not in this view's row filter, and not
-- in PUBLIC_CAMPAIGN_STATUSES (apps/web/lib/campaign-auth.ts). The organizer
-- and admins still see it (their own branches in the policies below), and the
-- page code still has the calm "support is paused" state card for them.
--
-- The follow-up — deliberately out of scope for launch — is a separate benign
-- hold (a distinct status, or a `pause_reason` carried on the campaign) so that
-- an on-hold-but-not-suspect link can stay reachable without the platform
-- vouching for a flagged page. Until that exists, do NOT re-add 'paused' here.
-- ============================================================================

-- Pin the schema for this migration so the unqualified names below (and the
-- base tables inside the view body, which are resolved once at creation time
-- and stored as OIDs) can never bind to whatever the migrating session happens
-- to have on its search_path. The definer *functions* in 0002/0008 additionally
-- pin `set search_path` on the function itself because their bodies are
-- re-resolved at call time; a definer view needs no call-time pin (see the note
-- on the view below), so this is a creation-time measure only.
set search_path = public, pg_catalog;

-- ---------------------------------------------------------------------------
-- (1) The public status set — restated, unchanged, so it sits next to the view.
-- ---------------------------------------------------------------------------
-- These two policies are recreated verbatim from 0002_rls.sql / 0005_rls_remaining
-- .sql (public branch = active/completed/closed, plus the organizer and admin
-- branches) purely so the public status set is visible in the same file as the
-- projection's row filter. Nothing is widened here.
--
-- 'paused' is deliberately ABSENT — see "ON 'paused'" in the header.
--
-- Single source of truth for the TypeScript side: PUBLIC_CAMPAIGN_STATUSES in
-- apps/web/lib/campaign-auth.ts. This list, that constant, and the row filter of
-- public.campaign_trust_public below must always say the same three statuses.
drop policy if exists campaigns_select_public on campaigns;
create policy campaigns_select_public on campaigns
  for select using (
    status in ('active','completed','closed')
    or organizer_id = auth.uid()
    or public.is_admin()
  );

drop policy if exists campaign_updates_select on campaign_updates;
create policy campaign_updates_select on campaign_updates
  for select using (
    exists (
      select 1 from public.campaigns c
      where c.id = campaign_updates.campaign_id
        and c.status in ('active','completed','closed')
    )
    or public.owns_campaign(campaign_id)
    or public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- (2) The public projection.
-- ---------------------------------------------------------------------------
-- `security_invoker = false` (the pre-PG15 default, pinned explicitly so a
-- future default flip cannot silently blank this view) makes the view read its
-- base tables with the *owner's* rights. That is the whole point: this view is
-- the one controlled hole through which anon may see beneficiary and
-- verification facts, so its safety rests entirely on the column allow-list and
-- the status filter below. Those two things are the reviewable surface of this
-- migration — read them as carefully as an RLS policy.
--
-- Note on the hardening convention: the definer *functions* in 0002/0008 pin
-- `set search_path = public` because their bodies are re-resolved at call time.
-- A view body is parsed once at creation and stored as OIDs, so there is no
-- search_path to hijack here — the equivalent discipline for a definer view is
-- the explicit column list. We deliberately do NOT add a definer helper
-- function for the verification rollup: granting anon EXECUTE on such a helper
-- would let it be called by campaign id directly, leaking verification state
-- for draft and rejected fundraisers. Inlined below, it can only ever be
-- reached through this view's status filter.
create or replace view public.campaign_trust_public
  with (security_invoker = false) as
select
  c.id                                as campaign_id,
  -- Slug: already public (it is the shareable URL), and lets a client fetch the
  -- projection by slug in the same round trip as the campaign itself.
  c.slug                              as slug,
  -- "Fundraiser reviewed": published_at is stamped only by the admin approval
  -- path (approveCampaign in app/[locale]/admin/actions.ts), so it is the honest
  -- signal for *human review happened* — as opposed to any verification claim.
  (c.published_at is not null)        as reviewed,
  -- Beneficiary facts. `type` is what tells a supporter whether a partner
  -- organization or the family itself receives the funds, and it selects which
  -- verification claims apply (the release gate skips the relationship check for
  -- orgs — ARCHITECTURE.md §4).
  b.type                              as beneficiary_type,
  -- display_name is copy the family wrote *for* the public page ("Family of
  -- Ahmed K."). It is the one free-text, human-identifying string in this
  -- projection, and this view is API-exposed to anon — meaning anyone holding
  -- the (shipped, public) anon key can filter and pattern-match on it to ask
  -- "is this person a bereavement beneficiary?" and page the view to bulk-export
  -- one dossier per fundraiser. The form is not the only writer
  -- (beneficiaries_insert lets an organizer POST the row directly), so the shape
  -- is bounded in the DATABASE — see the
  -- beneficiaries_display_name_public_shape constraint at the bottom of this
  -- file: a length bound, and no digits / '@' / URLs, i.e. nothing that reads as
  -- contact information.
  --
  -- Projected for INDIVIDUAL beneficiaries only. For an organization it is just
  -- a copy of organizations.name taken at creation time, and publishing that
  -- copy would route around the `status = 'verified'` join below: a partner org
  -- later suspended would still have its name published through this column.
  -- Organizations are named by organization_name or not at all.
  case
    when b.type = 'individual' then b.display_name
    else null
  end                                 as beneficiary_display_name,
  -- NOTE: `beneficiaries.relationship_to_deceased` is deliberately NOT projected
  -- under a `beneficiary_relationship` column. It is unbounded free text, and
  -- the app only ever writes it when the individual beneficiary IS the organizer
  -- (app/[locale]/start/actions.ts is its only writer), so it was fully
  -- redundant with `organizer_relationship` below — which is the same column,
  -- gated on that exact condition, and is where the page renders the
  -- "Started by Ahmed, brother" line. One filterable free-text column instead of
  -- two, with no loss of a single fact a supporter sees.
  --
  -- Organization beneficiaries only: who receives the money and what kind of
  -- body they are. This is exactly what organizations_select_public already
  -- makes world-readable — but RLS does NOT apply inside a definer view, so that
  -- policy's `status = 'verified'` gate has to be restated here as a join
  -- condition (below); without it this view would publish the name and type of a
  -- 'pending' or 'suspended' org, which the policy itself would refuse.
  -- (Their contact_email / stripe_connect_account_id are NOT projected.)
  bo.name                             as organization_name,
  bo.type                             as organization_type,
  -- Derived verification state: booleans only. No notes (free text an admin
  -- wrote for internal use), no reviewer identity, no document references, no
  -- timestamps that would let anyone reconstruct the review timeline.
  exists (
    select 1 from public.verifications v
    where v.campaign_id = c.id and v.type = 'death' and v.status = 'approved'
  )                                   as death_verified,
  exists (
    select 1 from public.verifications v
    where v.campaign_id = c.id
      and v.type = 'relationship'
      and v.status = 'approved'
  )                                   as relationship_verified,
  -- Type of the organization that confirmed the death (e.g. 'embassy'), so a
  -- badge can say *what kind* of body confirmed it. Deliberately the type and
  -- not the org's name or id: naming the embassy that handled one specific death
  -- is more than a supporter needs. NULL when our own admins confirmed it from
  -- documents — we then claim no institution at all.
  --
  -- The verifier org is gated on `status = 'verified'` for the same reason as the
  -- beneficiary org join: RLS is not applied inside a definer view, and we should
  -- not go on claiming "confirmed with an embassy" on the authority of a partner
  -- we have since suspended. Fails closed to "no institution claimed".
  (
    select o.type
    from public.verifications v
    join public.organizations o
      on o.id = v.verifier_org_id and o.status = 'verified'
    where v.campaign_id = c.id and v.type = 'death' and v.status = 'approved'
    order by v.reviewed_at desc nulls last, v.created_at desc
    limit 1
  )                                   as death_verifier_type,
  -- "Started by Ahmed, brother". First token of the organizer's name only —
  -- never the surname, never their profile id, email, phone or avatar.
  nullif(split_part(coalesce(p.full_name, ''), ' ', 1), '')
                                      as organizer_first_name,
  -- The organizer's own stated relationship to the deceased. It exists only
  -- when the organizer *is* the individual beneficiary (the only place the app
  -- collects a relationship — see app/[locale]/start/actions.ts); otherwise we
  -- say nothing rather than guess.
  case
    when b.individual_profile_id = c.organizer_id
      then b.relationship_to_deceased
    else null
  end                                 as organizer_relationship
from public.campaigns c
-- The active beneficiary, if any (`one_active_beneficiary` guarantees <= 1).
left join public.beneficiaries b
  on b.campaign_id = c.id and b.is_active
-- `status = 'verified'` restates organizations_select_public. RLS is not applied
-- inside a definer view, so this join condition is the only thing keeping a
-- pending or suspended partner org's name and type out of the public payload.
-- A non-verified org simply yields NULLs here; the beneficiary_type column still
-- tells the page that an organization receives the funds.
left join public.organizations bo
  on bo.id = b.organization_id
 and bo.status = 'verified'
left join public.profiles p
  on p.id = c.organizer_id
-- Mirrors campaigns_select_public's public branch exactly (see "ON 'paused'" in
-- the header for why 'paused' is not in it). Draft, pending_review, paused and
-- rejected fundraisers project nothing at all.
where c.status in ('active','completed','closed');

comment on view public.campaign_trust_public is
  'Public, non-identifying trust facts for publicly-visible fundraisers '
  '(active/completed/closed only — paused is a takedown, not a public state): '
  'beneficiary display name + type, VERIFIED partner org name+type, derived '
  'death/relationship verification, verifier org type, organizer given name and '
  'stated relationship. Definer-rights by design; safety = this column '
  'allow-list + the status filter + the shape constraint on '
  'beneficiaries.display_name. Never add contact details, Stripe/bank fields, '
  'document refs, surnames, private row ids or anything about donations.';

revoke all on public.campaign_trust_public from public;
grant select on public.campaign_trust_public to anon, authenticated;

-- ---------------------------------------------------------------------------
-- (3) Bound the one free-text human name this view publishes.
-- ---------------------------------------------------------------------------
-- `beneficiaries.display_name` is intended to read like "Family of Ahmed K." —
-- deliberately vague about who the family is. Nothing enforced that: the start
-- flow only checked it was non-empty, and beneficiaries_insert (0002_rls.sql)
-- lets an organizer write the row straight through PostgREST with any string at
-- all. Because the projection above hands this column to `anon` on an
-- API-exposed view, a legal name, a phone number, an address or an email typed
-- here becomes world-readable AND world-*searchable*: the anon key ships in the
-- mobile app, so anyone can select, filter and pattern-match this column and
-- page the whole view to bulk-export a dossier per bereaved family.
--
-- The bound therefore lives in the database, next to the projection, where it
-- cannot drift from it — a form check would not cover the direct-POST writer.
--
-- Documented shape (individual beneficiaries only):
--   * 2–60 characters, so it can hold "Family of Ahmed K." and nothing
--     essay-shaped;
--   * no digits, in ASCII or Arabic-Indic/Extended Arabic-Indic form — that is
--     what removes phone numbers, house numbers and ID numbers;
--   * no '@' and no URL, which removes emails and social handles/links;
--   * no control characters or newlines, so it stays a single display line.
--
-- Scoped to `type = 'individual'` on purpose: an organization beneficiary's
-- display_name is a copy of organizations.name, which is an institution's name
-- (already world-readable for verified orgs, legitimately may contain digits,
-- and is not a bereaved family's identity). Constraining it would break partner
-- onboarding without protecting anybody.
--
-- NOT VALID: 0012 and 0013 have not been applied anywhere yet, but earlier
-- migrations have, so beneficiary rows created by the start flow before this
-- constraint existed may already violate it. NOT VALID applies the check to
-- every INSERT/UPDATE from now on while leaving legacy rows alone, so this
-- migration cannot fail a deploy on historical data. To finish the job once the
-- handful of pre-launch rows has been reviewed by hand:
--   alter table public.beneficiaries
--     validate constraint beneficiaries_display_name_public_shape;
alter table public.beneficiaries
  add constraint beneficiaries_display_name_public_shape
  check (
    type <> 'individual'
    or (
      char_length(btrim(display_name)) between 2 and 60
      -- ASCII, Arabic-Indic (٠-٩) and Extended Arabic-Indic (۰-۹) digits.
      and display_name !~ '[0-9٠-٩۰-۹]'
      and display_name not like '%@%'
      and display_name !~* '(https?://|www\.)'
      and display_name !~ '[[:cntrl:]]'
    )
  )
  not valid;

comment on constraint beneficiaries_display_name_public_shape on public.beneficiaries is
  'display_name is projected to anon by public.campaign_trust_public, so its '
  'shape is bounded here (2-60 chars, no digits, no @, no URL, no control '
  'chars) to keep a legal name, phone, email or address out of a world-'
  'readable and world-searchable column. Individual beneficiaries only; '
  'organization display names mirror organizations.name. NOT VALID: legacy '
  'rows predate the rule.';
