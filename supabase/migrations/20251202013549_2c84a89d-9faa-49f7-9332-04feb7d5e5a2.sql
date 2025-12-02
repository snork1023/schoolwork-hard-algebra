-- Create storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'chat-attachments',
  'chat-attachments',
  true,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'video/mp4', 'video/quicktime']
);

-- Storage policies for chat attachments
CREATE POLICY "Users can upload attachments to their conversations"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'chat-attachments' AND
  auth.uid() IS NOT NULL
);

CREATE POLICY "Users can view attachments in their conversations"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-attachments');

CREATE POLICY "Users can delete their own attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'chat-attachments' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Add attachments column to chat_messages
ALTER TABLE chat_messages
ADD COLUMN attachments jsonb DEFAULT '[]'::jsonb;

-- Create message reactions table
CREATE TABLE IF NOT EXISTS message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES chat_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  emoji text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);

-- Enable RLS on message_reactions
ALTER TABLE message_reactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for message_reactions
CREATE POLICY "Users can view reactions in their conversations"
ON message_reactions FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM chat_messages cm
    JOIN conversation_participants cp ON cp.conversation_id = cm.conversation_id
    WHERE cm.id = message_reactions.message_id
    AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can add reactions to messages in their conversations"
ON message_reactions FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM chat_messages cm
    JOIN conversation_participants cp ON cp.conversation_id = cm.conversation_id
    WHERE cm.id = message_reactions.message_id
    AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can remove their own reactions"
ON message_reactions FOR DELETE
USING (auth.uid() = user_id);

-- Add realtime for reactions
ALTER PUBLICATION supabase_realtime ADD TABLE message_reactions;