-- Кроссе-девайс флаги онбординга: localStorage per-device показывал имя/тур
-- заново на каждом новом устройстве. Источник правды — profiles.
-- Применение: supabase db query --linked --file supabase/migration_profiles_onboarding.sql
alter table public.profiles
  add column if not exists name_asked boolean not null default false;
alter table public.profiles
  add column if not exists tour_done boolean not null default false;
