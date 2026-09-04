-- GRANT для feedback (пропущен в migration_feedback.sql — без него
-- PostgREST отвечает "permission denied for table feedback" несмотря на RLS).
-- Применение: supabase db query --linked --file supabase/migration_feedback_grants.sql
grant usage on schema public to authenticated;
grant insert, select on public.feedback to authenticated;
