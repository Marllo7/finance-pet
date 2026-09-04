-- Мягкое удаление обращений: юзер "удаляет" → строка помечается user_deleted,
-- у админа остаётся с бейджем, админ добивает (hard delete) или архивирует.
-- Применение: supabase db query --linked --file supabase/migration_feedback_soft_delete.sql
alter table public.feedback
  add column if not exists user_deleted boolean not null default false;

-- Юзеру hard delete больше не нужен (иначе админ терял бы обращение) — политику убираем.
drop policy if exists "feedback_delete_own" on public.feedback;
-- update_own (archived, user_deleted) уже есть из migration_feedback_user_mgmt.sql.
