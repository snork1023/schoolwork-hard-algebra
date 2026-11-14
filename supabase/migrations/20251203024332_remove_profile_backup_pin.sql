-- Remove the backup_pin column from profiles table
ALTER TABLE public.profiles DROP COLUMN IF EXISTS backup_pin;