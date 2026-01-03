-- Make the chat-attachments bucket private instead of public
UPDATE storage.buckets 
SET public = false 
WHERE id = 'chat-attachments';

-- Drop existing storage policies and recreate with proper access control
DROP POLICY IF EXISTS "Users can upload attachments to their conversations" ON storage.objects;
DROP POLICY IF EXISTS "Users can view attachments in their conversations" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;

-- Create a helper function in PUBLIC schema to check if user is participant in a conversation
-- The file path follows pattern: {conversation_id}/{filename}
CREATE OR REPLACE FUNCTION public.is_participant_in_attachment_conversation(object_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.conversation_participants cp
    WHERE cp.user_id = auth.uid()
      AND cp.conversation_id::text = split_part(object_path, '/', 1)
  )
$$;

-- Policy: Users can upload attachments only to conversations they participate in
CREATE POLICY "Authenticated users can upload to their conversations"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND public.is_participant_in_attachment_conversation(name)
);

-- Policy: Users can view attachments only from conversations they participate in
CREATE POLICY "Authenticated users can view their conversation attachments"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND public.is_participant_in_attachment_conversation(name)
);

-- Policy: Users can delete their own attachments from their conversations
CREATE POLICY "Users can delete their own attachments"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND public.is_participant_in_attachment_conversation(name)
);