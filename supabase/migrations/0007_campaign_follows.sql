-- ============================================================================
-- 0007_campaign_follows — let a signed-in supporter "follow" (save) a story so
-- they can return to it and, later, receive updates when support arrives.
-- A thin join table keyed by (profile, campaign). Self-service: each user reads
-- and writes only their own follows. Service-role bypasses RLS.
-- ============================================================================

create table campaign_follows (
  profile_id  uuid not null references profiles(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (profile_id, campaign_id)
);

create index idx_campaign_follows_profile on campaign_follows(profile_id);

alter table campaign_follows enable row level security;

-- A user manages only their own follows (admins may read for support).
create policy campaign_follows_select_own on campaign_follows
  for select using (profile_id = auth.uid() or public.is_admin());
create policy campaign_follows_insert_own on campaign_follows
  for insert with check (profile_id = auth.uid());
create policy campaign_follows_delete_own on campaign_follows
  for delete using (profile_id = auth.uid());
