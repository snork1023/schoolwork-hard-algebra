-- Add backup_pin column to profiles table for password recovery
ALTER TABLE public.profiles 
ADD COLUMN backup_pin text;

-- Add index for faster lookups
CREATE INDEX idx_profiles_backup_pin ON public.profiles(backup_pin) WHERE backup_pin IS NOT NULL;