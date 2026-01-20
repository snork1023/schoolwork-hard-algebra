-- Add settings column to profiles table for user preferences
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS settings jsonb DEFAULT '{}'::jsonb;