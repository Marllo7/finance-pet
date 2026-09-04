-- Пользовательское управление обращениями: архив + удаление своих.
-- Применение: supabase db query --linked --file supabase/migration_feedback_user_mgmt.sql
alter table public.feedback
  add column if not exists archived boolean not null default false;

-- Свои можно архивировать (update) и удалять
drop policy if exists "feedback_update_own" on public.feedback;
create policy "feedback_update_own" on public.feedback
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "feedback_delete_own" on public.feedback;
create policy "feedback_delete_own" on public.feedback
  for delete using (auth.uid() = user_id);

-- Админ может удалять чужое (спам)
drop policy if exists "feedback_admin_delete" on public.feedback;
create policy "feedback_admin_delete" on public.feedback
  for delete using (exists (select 1 from public.admins where user_id = auth.uid()));

grant update, delete on public.feedback to authenticated;
