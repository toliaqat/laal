-- ============================================================================
-- 0012_campaign_updates_hardening — bound the update body and pin authorship.
--
-- campaign_updates is the only place an organizer writes free text that anon
-- visitors read (see 0005_rls_remaining). Two gaps are closed here:
--   1. `body` was unbounded, so a single row could hold megabytes of text.
--   2. The insert policy checked campaign ownership but not `author_id`, so an
--      organizer could attribute a post to someone else's profile id.
-- ============================================================================

-- Pin the schema so the unqualified object names below cannot bind to whatever
-- the migrating session happens to have on its search_path (same reasoning as
-- 0013; the definer functions in 0002/0008 pin theirs on the function itself
-- because a function body is re-resolved at call time).
set search_path = public, pg_catalog;

-- Keep in sync with MAX_BODY in
-- apps/web/app/[locale]/dashboard/campaigns/[id]/updates/actions.ts.
alter table public.campaign_updates
  add constraint campaign_updates_body_length
  check (char_length(body) between 1 and 2000);

-- Replace the insert policy: still organizer-or-admin, but the row must now be
-- stamped with the caller's own id.
drop policy if exists campaign_updates_insert on campaign_updates;
create policy campaign_updates_insert on campaign_updates
  for insert with check (
    author_id = auth.uid()
    and (public.owns_campaign(campaign_id) or public.is_admin())
  );

-- The same authorship gap exists on UPDATE. `campaign_updates_modify`
-- (0005_rls_remaining.sql) checks campaign ownership and nothing else, so
-- pinning author_id on INSERT alone only half-closes the hole: an organizer
-- could insert a correctly-attributed post and then UPDATE the row to
-- attribute it to any profile id (their co-organizer's, an admin's). Recreate
-- the policy with both original branches intact and the author pinned in
-- WITH CHECK, the same way the insert policy does it.
--
-- Deliberately strict (`author_id = auth.uid()`, no admin exemption), matching
-- the insert policy: admin surfaces write through the service-role client,
-- which bypasses RLS entirely, and no app surface edits an update in place.
drop policy if exists campaign_updates_modify on campaign_updates;
create policy campaign_updates_modify on campaign_updates
  for update using (public.owns_campaign(campaign_id) or public.is_admin())
  with check (
    author_id = auth.uid()
    and (public.owns_campaign(campaign_id) or public.is_admin())
  );
