-- Add foreign key relationship between chat_messages and profiles
ALTER TABLE public.chat_messages
ADD CONSTRAINT fk_chat_messages_profiles
FOREIGN KEY (user_id) REFERENCES public.profiles(id) ON DELETE CASCADE;