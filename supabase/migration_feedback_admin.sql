-- Админка обратной связи: контакт для ответа, ответ админа, таблица админов.
-- Применение: supabase db query --linked --file supabase/migration_feedback_admin.sql
alter table public.feedback
  add column if not exists contact text;
alter table public.feedback
  add column if not exists admin_reply text;
alter table public.feedback
  add column if not exists replied_at timestamptz;

-- Админы по user_id (email в коде не храним — репо публичное).
-- Первого админа добавляет владелец через SQL (см. ниже), дальше — только так же.
create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;

-- Клиентская проверка "я админ": читать можно только свою строку.
-- Insert/update/delete политик НЕТ — писать в admins можно только через SQL/service_role.
drop policy if exists "admins_select_own" on public.admins;
create policy "admins_select_own" on public.admins
  for select using (auth.uid() = user_id);

-- Админ видит все обращения и отвечает/меняет статус.
drop policy if exists "feedback_admin_select_all" on public.feedback;
create policy "feedback_admin_select_all" on public.feedback
  for select using (exists (select 1 from public.admins where user_id = auth.uid()));
drop policy if exists "feedback_admin_update" on public.feedback;
create policy "feedback_admin_update" on public.feedback
  for update using (exists (select 1 from public.admins where user_id = auth.uid()));

grant usage on schema public to authenticated;
grant select on public.admins to authenticated;
grant update on public.feedback to authenticated;

-- Bootstrap первого админа (выполнить один раз, подставив свой user_id):
-- insert into public.admins (user_id) values ('aad090a9-0566-4329-9c4d-c4161641dcd9') on conflict do nothing;
