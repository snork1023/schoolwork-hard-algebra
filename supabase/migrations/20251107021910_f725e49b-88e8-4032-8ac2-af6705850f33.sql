-- Add edited_at column to track message edits
ALTER TABLE public.chat_messages ADD COLUMN edited_at timestamp with time zone;

-- Add UPDATE policy for users to edit their own messages
CREATE POLICY "Users can update their own messages"
ON public.chat_messages
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);