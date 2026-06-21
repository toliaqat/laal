-- ============================================================================
-- 0002_rls — Row Level Security policies
-- Implements the policy intent documented in 0001_init.sql / ARCHITECTURE.md §3.
-- RLS was already ENABLED on the sensitive tables in 0001; here we add policies.
-- The service-role key (server backend) bypasses RLS entirely.
-- ============================================================================

-- Helper: is the current user an admin? SECURITY DEFINER so it can read the
-- profiles table without tripping that table's own RLS (avoids recursion).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Helper: does the current user own this campaign?
create or replace function public.owns_campaign(cid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from campaigns where id = cid and organizer_id = auth.uid()
  );
$$;

-- ---------------- profiles ----------------
create policy profiles_select_self_or_admin on profiles
  for select using (id = auth.uid() or public.is_admin());
create policy profiles_insert_self on profiles
  for insert with check (id = auth.uid());
create policy profiles_update_self on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- ---------------- organizations ----------------
create policy organizations_select_public on organizations
  for select using (status = 'verified' or public.is_admin());
create policy organizations_admin_write on organizations
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------- campaigns ----------------
create policy campaigns_select_public on campaigns
  for select using (
    status in ('active','completed','closed')
    or organizer_id = auth.uid()
    or public.is_admin()
  );
create policy campaigns_insert_own on campaigns
  for insert with check (organizer_id = auth.uid());
-- organizer may edit only while still in draft/pending_review; admins anytime
create policy campaigns_update_own_or_admin on campaigns
  for update using (
    (organizer_id = auth.uid() and status in ('draft','pending_review'))
    or public.is_admin()
  ) with check (
    organizer_id = auth.uid() or public.is_admin()
  );

-- ---------------- beneficiaries ----------------
create policy beneficiaries_select on beneficiaries
  for select using (public.owns_campaign(campaign_id) or public.is_admin());
create policy beneficiaries_insert on beneficiaries
  for insert with check (public.owns_campaign(campaign_id) or public.is_admin());
create policy beneficiaries_admin_write on beneficiaries
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------- verifications (approval is admin/service-role only) ----------------
create policy verifications_select on verifications
  for select using (public.owns_campaign(campaign_id) or public.is_admin());
create policy verifications_admin_write on verifications
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------- documents (never public; private storage bucket) ----------------
create policy documents_select on documents
  for select using (public.owns_campaign(campaign_id) or public.is_admin());
create policy documents_insert on documents
  for insert with check (public.owns_campaign(campaign_id) or public.is_admin());
create policy documents_admin_write on documents
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------- donations (donor reads own; inserts via service-role only) ----------------
create policy donations_select_own on donations
  for select using (donor_profile_id = auth.uid() or public.is_admin());

-- ---------------- payouts (money movement — admin/service-role only) ----------------
create policy payouts_admin_only on payouts
  for all using (public.is_admin()) with check (public.is_admin());
