-- Add DELETE policy for conversations (only creator can delete)
CREATE POLICY "Users can delete conversations they created"
ON public.conversations
FOR DELETE
USING (auth.uid() = created_by);

-- Add cascade delete for conversation_participants
ALTER TABLE public.conversation_participants
DROP CONSTRAINT IF EXISTS conversation_participants_conversation_id_fkey;

ALTER TABLE public.conversation_participants
ADD CONSTRAINT conversation_participants_conversation_id_fkey
FOREIGN KEY (conversation_id)
REFERENCES public.conversations(id)
ON DELETE CASCADE;

-- Add cascade delete for chat_messages
ALTER TABLE public.chat_messages
DROP CONSTRAINT IF EXISTS chat_messages_conversation_id_fkey;

ALTER TABLE public.chat_messages
ADD CONSTRAINT chat_messages_conversation_id_fkey
FOREIGN KEY (conversation_id)
REFERENCES public.conversations(id)
ON DELETE CASCADE;