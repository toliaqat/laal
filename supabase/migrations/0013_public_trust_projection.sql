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
--
-- It also fixes a second launch blocker: 'paused' was missing from the public
-- select policies, so sharing a link to a paused fundraiser 404'd instead of
-- rendering the calm "support is paused" state the app already has. Pausing is
-- a *temporary hold* in the state machine (ARCHITECTURE.md §5) — the page must
-- stay reachable, it just stops collecting.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- (1) 'paused' is publicly visible.
-- ---------------------------------------------------------------------------
-- Keep in sync with PUBLIC_STATUSES in
-- apps/web/app/[locale]/campaigns/[slug]/supporters.ts and with the row filter
-- of public.campaign_trust_public below.
drop policy if exists campaigns_select_public on campaigns;
create policy campaigns_select_public on campaigns
  for select using (
    status in ('active','paused','completed','closed')
    or organizer_id = auth.uid()
    or public.is_admin()
  );

-- Updates already posted stay readable while a fundraiser is paused; hiding
-- them would make the paused page look emptier than the active one it replaced.
drop policy if exists campaign_updates_select on campaign_updates;
create policy campaign_updates_select on campaign_updates
  for select using (
    exists (
      select 1 from campaigns c
      where c.id = campaign_updates.campaign_id
        and c.status in ('active','paused','completed','closed')
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
  -- Beneficiary facts. display_name and relationship_to_deceased are copy the
  -- family wrote *for* the public page ("Family of Ahmed K.", "brother"); the
  -- page has always intended to show them. Type is what tells a supporter
  -- whether a partner organization or the family itself receives the funds, and
  -- it selects which verification claims apply (the release gate skips the
  -- relationship check for orgs — ARCHITECTURE.md §4).
  b.type                              as beneficiary_type,
  b.display_name                      as beneficiary_display_name,
  b.relationship_to_deceased          as beneficiary_relationship,
  -- Organization beneficiaries only: who receives the money and what kind of
  -- body they are. Verified partner orgs are already world-readable via
  -- organizations_select_public, so this is a join convenience, not new exposure.
  -- (Their contact_email / stripe_connect_account_id are NOT projected.)
  bo.name                             as organization_name,
  bo.type                             as organization_type,
  -- Derived verification state: booleans only. No notes (free text an admin
  -- wrote for internal use), no reviewer identity, no document references, no
  -- timestamps that would let anyone reconstruct the review timeline.
  exists (
    select 1 from verifications v
    where v.campaign_id = c.id and v.type = 'death' and v.status = 'approved'
  )                                   as death_verified,
  exists (
    select 1 from verifications v
    where v.campaign_id = c.id
      and v.type = 'relationship'
      and v.status = 'approved'
  )                                   as relationship_verified,
  -- Type of the organization that confirmed the death (e.g. 'embassy'), so a
  -- badge can say *what kind* of body confirmed it. Deliberately the type and
  -- not the org's name or id: naming the embassy that handled one specific death
  -- is more than a supporter needs. NULL when our own admins confirmed it from
  -- documents — we then claim no institution at all.
  (
    select o.type
    from verifications v
    join organizations o on o.id = v.verifier_org_id
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
from campaigns c
-- The active beneficiary, if any (`one_active_beneficiary` guarantees <= 1).
left join beneficiaries b
  on b.campaign_id = c.id and b.is_active
left join organizations bo
  on bo.id = b.organization_id
left join profiles p
  on p.id = c.organizer_id
-- Mirrors campaigns_select_public's public branch exactly. Draft,
-- pending_review and rejected fundraisers project nothing at all.
where c.status in ('active','paused','completed','closed');

comment on view public.campaign_trust_public is
  'Public, non-identifying trust facts for publicly-visible fundraisers: '
  'beneficiary display name/type/relationship, partner org name+type, derived '
  'death/relationship verification, verifier org type, organizer given name. '
  'Definer-rights by design; safety = this column allow-list + the status '
  'filter. Never add contact details, Stripe/bank fields, document refs, '
  'surnames, private row ids or anything about donations.';

revoke all on public.campaign_trust_public from public;
grant select on public.campaign_trust_public to anon, authenticated;
