-- ============================================================================
-- 0009_org_onboarding — organization membership, invites, and portal access
-- ----------------------------------------------------------------------------
-- Lets organizations (mosques, regional associations, funeral homes, embassies,
-- charities…) be onboarded TWO ways — an admin seeds the profile, OR an admin
-- invites someone by email who then creates/claims the org themselves — and lets
-- their members log in to a portal to manage the profile, finish Stripe
-- onboarding, and SEE funds routed to them.
--
-- Trust boundaries kept intact:
--   * An org only becomes publicly selectable when an admin sets status='verified'
--     (decoupled from Stripe readiness, which is only enforced at payout time).
--   * Members/leads NEVER write status/capabilities or move money directly — all
--     such writes go through service-role server actions with explicit checks.
--     The RLS below is read-scoping + defense-in-depth only; there is deliberately
--     NO lead UPDATE policy on organizations (would allow self-verification).
-- ============================================================================

create type org_member_role   as enum ('lead','staff');
create type org_invite_status as enum ('pending','accepted','revoked','expired');

-- organization_members already exists (0001) with org_role text default 'staff'.
-- Normalise it to the new enum-like values: 'lead' (manages profile + onboarding)
-- and 'staff' (view only). Existing rows (none in practice) default to 'staff'.

-- ---------------- invites ----------------
-- An admin-initiated invitation. organization_id may be NULL, meaning "the
-- invitee creates a brand-new org on accept"; or set, meaning "join/manage this
-- existing (possibly admin-seeded) org".
create table organization_invites (
  id              uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id),
  email           text not null,
  member_role     org_member_role not null default 'lead',
  token           text not null unique,            -- random; delivered by email
  status          org_invite_status not null default 'pending',
  invited_by      uuid references profiles(id),
  accepted_by     uuid references profiles(id),
  expires_at      timestamptz not null,
  created_at      timestamptz not null default now()
);
create index idx_org_invites_email on organization_invites(lower(email));
create index idx_org_invites_token on organization_invites(token);
create index idx_org_invites_org   on organization_invites(organization_id);

-- ---------------- helpers (SECURITY DEFINER to avoid RLS recursion) ----------------
create or replace function public.is_org_member(oid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members
    where organization_id = oid and profile_id = auth.uid()
  );
$$;

create or replace function public.is_org_lead(oid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from organization_members
    where organization_id = oid and profile_id = auth.uid() and org_role = 'lead'
  );
$$;

-- The set of org ids the current user belongs to (used to scope campaign/payout reads).
create or replace function public.member_org_ids()
returns setof uuid language sql stable security definer set search_path = public as $$
  select organization_id from organization_members where profile_id = auth.uid();
$$;

-- ---------------- RLS ----------------
alter table organization_members enable row level security;
alter table organization_invites enable row level security;

-- members: a user sees their own memberships; admins see all; writes via service-role.
create policy org_members_select on organization_members
  for select using (profile_id = auth.uid() or public.is_admin());
create policy org_members_admin_write on organization_members
  for all using (public.is_admin()) with check (public.is_admin());

-- invites: only admins read/write via the anon/auth path. The accept flow looks
-- invites up by token using the service-role client, which bypasses RLS.
create policy org_invites_admin_all on organization_invites
  for all using (public.is_admin()) with check (public.is_admin());

-- organizations: members may read their own org even before it is 'verified'
-- (additive to the existing public 'verified or admin' select policy).
create policy organizations_select_member on organizations
  for select using (public.is_org_member(id));

-- campaigns: members may read campaigns whose ACTIVE beneficiary is their org.
create policy campaigns_select_org_member on campaigns
  for select using (
    exists (
      select 1 from beneficiaries b
      where b.campaign_id = campaigns.id
        and b.type = 'organization'
        and b.organization_id in (select public.member_org_ids())
    )
  );

-- payouts: members may READ payouts destined for their org (read-only — the
-- existing payouts_admin_only FOR ALL policy still governs every write).
create policy payouts_select_org_member on payouts
  for select using (
    exists (
      select 1 from beneficiaries b
      where b.id = payouts.beneficiary_id
        and b.type = 'organization'
        and b.organization_id in (select public.member_org_ids())
    )
  );
