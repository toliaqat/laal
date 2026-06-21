-- ============================================================================
-- 0006_storage — private bucket for verification documents.
-- Reads happen via short-lived signed URLs generated server-side with the
-- service-role client, so no public/anon storage policies are added here.
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('documents', 'documents', false)
on conflict (id) do nothing;
