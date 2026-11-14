-- Add discoverable column to profiles for privacy setting
-- When false, user won't appear in "Create new chat" user search
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS discoverable boolean NOT NULL DEFAULT true;

-- Add comment for clarity
COMMENT ON COLUMN public.profiles.discoverable IS 'When false, user will not appear in message request / new chat searches';