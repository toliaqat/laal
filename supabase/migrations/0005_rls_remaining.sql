-- ============================================================================
-- 0005_rls_remaining — enable RLS on the tables 0001 left open.
-- Without this, the anon/auth key could read/write these via PostgREST.
-- Uses is_admin() / owns_campaign() from 0002.
-- ============================================================================

-- audit_log: compliance trail. NO client access at all (service-role only).
-- Enabling RLS with no policy denies anon/auth entirely.
alter table audit_log enable row level security;

-- communications: contains PII (recipient emails, payloads). Service-role only.
alter table communications enable row level security;

-- organization_members: membership drives future authz — lock writes to admins.
alter table organization_members enable row level security;
create policy org_members_select_self_or_admin on organization_members
  for select using (profile_id = auth.uid() or public.is_admin());
create policy org_members_admin_write on organization_members
  for all using (public.is_admin()) with check (public.is_admin());

-- campaign_updates: public can read updates for visible campaigns; only the
-- owning organizer (or an admin) may post.
alter table campaign_updates enable row level security;
create policy campaign_updates_select on campaign_updates
  for select using (
    exists (
      select 1 from campaigns c
      where c.id = campaign_updates.campaign_id
        and c.status in ('active','completed','closed')
    )
    or public.owns_campaign(campaign_id)
    or public.is_admin()
  );
create policy campaign_updates_insert on campaign_updates
  for insert with check (public.owns_campaign(campaign_id) or public.is_admin());
create policy campaign_updates_modify on campaign_updates
  for update using (public.owns_campaign(campaign_id) or public.is_admin())
  with check (public.owns_campaign(campaign_id) or public.is_admin());
create policy campaign_updates_delete on campaign_updates
  for delete using (public.owns_campaign(campaign_id) or public.is_admin());
