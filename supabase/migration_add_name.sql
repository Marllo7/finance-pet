-- Migration: add pet_name, currency, language columns to profiles
-- Run this in Supabase SQL Editor

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pet_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS currency text DEFAULT 'EUR';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS language text DEFAULT 'ru';

