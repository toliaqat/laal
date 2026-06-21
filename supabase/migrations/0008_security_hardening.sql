-- ============================================================================
-- 0008_security_hardening — close two privilege-escalation gaps in RLS (0002)
--
-- (1) CRITICAL: profiles_update_self (0002_rls.sql:40) lets any authenticated
--     user UPDATE their own profile row with `with check (id = auth.uid())`.
--     That check does NOT pin the `role` column, so a normal user could run
--     `update profiles set role = 'admin' where id = auth.uid()` and gain full
--     admin (is_admin() reads profiles.role). RLS cannot reference OLD, so we
--     pin role immutability with a BEFORE UPDATE trigger instead.
--
-- (2) MEDIUM: campaigns_update_own_or_admin (0002_rls.sql:59) gates the OLD row
--     to draft/pending_review in USING, but its WITH CHECK only verifies
--     ownership — letting an organizer set status='active' themselves and skip
--     review. Tighten WITH CHECK to also pin the resulting status.
-- ============================================================================

-- (1) Prevent non-admins from changing their own (or any) profile role.
--
-- IMPORTANT: triggers (unlike RLS) are NOT bypassed by the service-role / a
-- superuser, so we scope the restriction to the PostgREST API roles
-- (`authenticated`, `anon`). Server-side admin actions go through the
-- service-role client (createAdminSupabase → connects as `service_role`), and
-- migrations/seeds run as `postgres`; both must remain able to set roles.
--
-- This function is SECURITY INVOKER (the default) on purpose: under SECURITY
-- DEFINER, `current_user` would resolve to the function OWNER (postgres) and
-- the role check below would never match. As invoker, `current_user` is the
-- real caller role. is_admin() is itself SECURITY DEFINER, so it can still read
-- profiles when called from here.
create or replace function public.prevent_role_self_escalation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- Only requests arriving through the public API roles are restricted.
  -- Such a caller may change roles only if they are themselves an admin.
  if new.role is distinct from old.role
     and current_user in ('authenticated', 'anon')
     and not public.is_admin() then
    raise exception 'not authorized to change role';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_profiles_no_role_escalation on profiles;
create trigger trg_profiles_no_role_escalation
  before update on profiles
  for each row execute function public.prevent_role_self_escalation();

-- (2) Pin the resulting campaign status in WITH CHECK so an organizer can only
-- leave a campaign in draft/pending_review; only admins can publish/transition.
drop policy if exists campaigns_update_own_or_admin on campaigns;
create policy campaigns_update_own_or_admin on campaigns
  for update using (
    (organizer_id = auth.uid() and status in ('draft','pending_review'))
    or public.is_admin()
  ) with check (
    public.is_admin()
    or (organizer_id = auth.uid() and status in ('draft','pending_review'))
  );
