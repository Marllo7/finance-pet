-- Finance Pet — RLS hardening (iteration B)
-- Run AFTER supabase/schema.sql in Supabase SQL Editor.
-- Tightens update/delete policies with WITH CHECK so a row can never
-- be moved to another user, and hardens the signup trigger.

-- Policies: transactions (update/delete with WITH CHECK)
drop policy if exists "Transactions update own" on public.transactions;
create policy "Transactions update own" on public.transactions
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Transactions delete own" on public.transactions;
create policy "Transactions delete own" on public.transactions
  for delete using (auth.uid() = user_id);

-- Policies: categories (update/delete with WITH CHECK)
drop policy if exists "Categories update own" on public.categories;
create policy "Categories update own" on public.categories
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Categories delete own" on public.categories;
create policy "Categories delete own" on public.categories
  for delete using (auth.uid() = user_id);

-- Policies: goals (update/delete with WITH CHECK)
drop policy if exists "Goals update own" on public.goals;
create policy "Goals update own" on public.goals
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Goals delete own" on public.goals;
create policy "Goals delete own" on public.goals
  for delete using (auth.uid() = user_id);

-- Policies: profiles (update with WITH CHECK — id нельзя сменить на чужой)
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Trigger: hardened — pinned search_path + idempotent insert
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;
