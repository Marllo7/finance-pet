-- Обратная связь из приложения: жалобы/идеи/благодарности.
-- Применение: supabase db query --linked --file supabase/migration_feedback.sql
create table if not exists public.feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('bug', 'idea', 'thanks')),
  message text not null check (char_length(message) between 1 and 1000),
  app_version text,
  status text not null default 'new' check (status in ('new', 'progress', 'done')),
  created_at timestamptz not null default now()
);

alter table public.feedback enable row level security;

drop policy if exists "feedback_insert_own" on public.feedback;
create policy "feedback_insert_own" on public.feedback
  for insert with check (auth.uid() = user_id);

drop policy if exists "feedback_select_own" on public.feedback;
create policy "feedback_select_own" on public.feedback
  for select using (auth.uid() = user_id);

create index if not exists feedback_user_created_idx
  on public.feedback (user_id, created_at desc);

-- Data API grants (без них PostgREST отвечает permission denied несмотря на RLS)
grant usage on schema public to authenticated;
grant insert, select on public.feedback to authenticated;
