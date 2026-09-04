-- Finance Pet — schema for iteration A
-- Run this in Supabase SQL Editor (https://supabase.com/dashboard/project/ngtwzexyduomyaongegd/sql)

-- 1. profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  name text,
  pet_name text,
  currency text,
  language text,
  name_asked boolean not null default false,
  tour_done boolean not null default false,
  created_at timestamptz default now()
);

-- 2. categories (default + custom)
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  label text not null,
  icon text not null default '📦',
  type text not null check (type in ('income','expense','both')),
  is_default boolean not null default false,
  created_at timestamptz default now(),
  unique (user_id, label)
);
create index if not exists categories_user_id_idx on public.categories(user_id);

-- 3. transactions
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('income','expense')),
  amount numeric(12,2) not null check (amount > 0),
  category_id uuid references public.categories(id) on delete set null,
  -- fallback for old string category, keep for migration flexibility
  category_label text,
  date date not null,
  comment text,
  created_at timestamptz default now()
);
create index if not exists transactions_user_id_date_idx on public.transactions(user_id, date desc);
create index if not exists transactions_user_id_idx on public.transactions(user_id);

-- 4. goals
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default '🎯',
  target_amount numeric(12,2) not null check (target_amount > 0),
  saved_amount numeric(12,2) not null default 0 check (saved_amount >= 0),
  deadline date,
  color text default '#7c5cff',
  created_at timestamptz default now()
);
create index if not exists goals_user_id_idx on public.goals(user_id);

-- Enable RLS
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.transactions enable row level security;
alter table public.goals enable row level security;

-- Policies: profiles
drop policy if exists "Users can view own profile" on public.profiles;
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Policies: categories
-- Everyone can read default categories (user_id is null), users can read own
drop policy if exists "Categories read" on public.categories;
create policy "Categories read" on public.categories
  for select using (user_id is null or auth.uid() = user_id);

drop policy if exists "Categories insert own" on public.categories;
create policy "Categories insert own" on public.categories
  for insert with check (auth.uid() = user_id and is_default = false);

drop policy if exists "Categories update own" on public.categories;
create policy "Categories update own" on public.categories
  for update using (auth.uid() = user_id);

drop policy if exists "Categories delete own" on public.categories;
create policy "Categories delete own" on public.categories
  for delete using (auth.uid() = user_id and is_default = false);

-- Policies: transactions
drop policy if exists "Transactions read own" on public.transactions;
create policy "Transactions read own" on public.transactions
  for select using (auth.uid() = user_id);
drop policy if exists "Transactions insert own" on public.transactions;
create policy "Transactions insert own" on public.transactions
  for insert with check (auth.uid() = user_id);
drop policy if exists "Transactions update own" on public.transactions;
create policy "Transactions update own" on public.transactions
  for update using (auth.uid() = user_id);
drop policy if exists "Transactions delete own" on public.transactions;
create policy "Transactions delete own" on public.transactions
  for delete using (auth.uid() = user_id);

-- Policies: goals
drop policy if exists "Goals read own" on public.goals;
create policy "Goals read own" on public.goals
  for select using (auth.uid() = user_id);

drop policy if exists "Goals insert own" on public.goals;
create policy "Goals insert own" on public.goals
  for insert with check (auth.uid() = user_id);

drop policy if exists "Goals update own" on public.goals;
create policy "Goals update own" on public.goals
  for update using (auth.uid() = user_id);

drop policy if exists "Goals delete own" on public.goals;
create policy "Goals delete own" on public.goals
  for delete using (auth.uid() = user_id);

-- Trigger: auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Дефолтные категории должны быть уникальны по label среди user_id is null.
-- Обычный unique (user_id, label) NULL-значения не сдерживает, поэтому частичный индекс.
create unique index if not exists categories_default_label_uidx on public.categories (label) where user_id is null;

-- Seed default categories (global, user_id = null), idempotent
-- Атомарно-устойчив к параллельному прогону через ON CONFLICT (предикат совпадает с индексом).
insert into public.categories (user_id, label, icon, type, is_default) values
  (null, 'Еда', '🍔', 'expense', true),
  (null, 'Транспорт', '🚆', 'expense', true),
  (null, 'Покупки', '🛍️', 'expense', true),
  (null, 'Дом', '🏠', 'expense', true),
  (null, 'Развлечения', '🎬', 'expense', true),
  (null, 'Здоровье', '💊', 'expense', true),
  (null, 'Зарплата', '💰', 'income', true),
  (null, 'Фриланс', '💻', 'income', true),
  (null, 'Другое', '📦', 'both', true)
on conflict (label) where user_id is null do nothing;

-- Grant access for Data API (if "Automatically expose new tables" is OFF, need manual grants)
grant usage on schema public to anon, authenticated;
grant all on public.profiles to authenticated;
grant all on public.categories to authenticated, anon;
grant all on public.transactions to authenticated;
grant all on public.goals to authenticated;
grant usage, select on all sequences in schema public to authenticated, anon;
