
-- 1. INPUT VALIDATION: Add database-level CHECK constraints

-- Message content length (allow empty since attachments-only messages exist with '[attachment]' placeholder)
ALTER TABLE public.chat_messages 
ADD CONSTRAINT chat_messages_content_length_check 
CHECK (length(content) <= 5000);

-- Conversation name length
ALTER TABLE public.conversations
ADD CONSTRAINT conversations_name_length_check
CHECK (name IS NULL OR (length(name) <= 100 AND length(name) > 0));

-- Username length
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_username_length_check
CHECK (length(username) <= 50 AND length(username) > 0);

-- Avatar URL length
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_avatar_url_length_check
CHECK (avatar_url IS NULL OR length(avatar_url) <= 2048);

-- Status message length
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_status_message_length_check
CHECK (status_message IS NULL OR length(status_message) <= 200);

-- Poll question length
ALTER TABLE public.polls
ADD CONSTRAINT polls_question_length_check
CHECK (length(question) <= 500 AND length(question) > 0);

-- Reaction emoji length
ALTER TABLE public.message_reactions
ADD CONSTRAINT message_reactions_emoji_length_check
CHECK (length(emoji) > 0 AND length(emoji) <= 10);

-- Poll options validation trigger
CREATE OR REPLACE FUNCTION public.validate_poll_options()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF jsonb_array_length(NEW.options) < 2 OR jsonb_array_length(NEW.options) > 10 THEN
    RAISE EXCEPTION 'Poll must have between 2 and 10 options';
  END IF;
  
  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements_text(NEW.options) AS opt
    WHERE length(opt) > 100 OR length(opt) = 0
  ) THEN
    RAISE EXCEPTION 'Each poll option must be between 1 and 100 characters';
  END IF;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_poll_options_trigger
BEFORE INSERT OR UPDATE ON public.polls
FOR EACH ROW
EXECUTE FUNCTION public.validate_poll_options();

-- 2. PROFILES RLS: Require authentication and respect discoverable flag
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Authenticated users can view discoverable profiles or own profile"
ON public.profiles FOR SELECT
USING (
  auth.uid() IS NOT NULL AND 
  (discoverable = true OR id = auth.uid())
);

-- 3. STORAGE: Make chat-attachments bucket private
UPDATE storage.buckets SET public = false WHERE id = 'chat-attachments';
