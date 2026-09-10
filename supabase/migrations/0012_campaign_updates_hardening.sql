-- ============================================================================
-- 0012_campaign_updates_hardening — bound the update body and pin authorship.
--
-- campaign_updates is the only place an organizer writes free text that anon
-- visitors read (see 0005_rls_remaining). Two gaps are closed here:
--   1. `body` was unbounded, so a single row could hold megabytes of text.
--   2. The insert policy checked campaign ownership but not `author_id`, so an
--      organizer could attribute a post to someone else's profile id.
-- ============================================================================

-- Keep in sync with MAX_BODY in
-- apps/web/app/[locale]/dashboard/campaigns/[id]/updates/actions.ts.
alter table campaign_updates
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
