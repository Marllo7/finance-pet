-- Migration: sync chat messages across devices
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id bigint primary key generated always as identity,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);

-- Index for fast user lookup
create index if not exists idx_chat_messages_user_id on public.chat_messages(user_id);
create index if not exists idx_chat_messages_user_created on public.chat_messages(user_id, created_at);

-- Row Level Security
alter table public.chat_messages enable row level security;

drop policy if exists "Users can view own messages" on public.chat_messages;
create policy "Users can view own messages"
  on public.chat_messages for select
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own messages" on public.chat_messages;
create policy "Users can insert own messages"
  on public.chat_messages for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own messages" on public.chat_messages;
create policy "Users can delete own messages"
  on public.chat_messages for delete
  using (auth.uid() = user_id);

grant all on public.chat_messages to authenticated;
grant usage, select on sequence public.chat_messages_id_seq to authenticated;

-- Realtime: live-sync чата между устройствами без reload (клиент подписан на postgres_changes).
-- Идемпотентно: повторный прогон не падает.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;
end
$$;
