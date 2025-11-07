-- Create message read receipts table
CREATE TABLE public.message_read_receipts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id uuid NOT NULL REFERENCES public.chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

-- Enable RLS
ALTER TABLE public.message_read_receipts ENABLE ROW LEVEL SECURITY;

-- Users can view read receipts for messages in their conversations
CREATE POLICY "Users can view read receipts in their conversations"
ON public.message_read_receipts
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.chat_messages cm
    JOIN public.conversation_participants cp ON cp.conversation_id = cm.conversation_id
    WHERE cm.id = message_read_receipts.message_id
    AND cp.user_id = auth.uid()
  )
);

-- Users can insert read receipts for themselves
CREATE POLICY "Users can insert their own read receipts"
ON public.message_read_receipts
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Add DELETE policy for conversation_participants to allow leaving conversations
CREATE POLICY "Users can leave conversations"
ON public.conversation_participants
FOR DELETE
USING (auth.uid() = user_id);