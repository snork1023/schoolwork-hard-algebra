-- Update chat-attachments DELETE policy to check ownership via path
DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete their own attachments" ON storage.objects;
CREATE POLICY "Users can delete their own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-attachments'
  AND is_participant_in_attachment_conversation(name)
  AND (auth.uid())::text = split_part(name, '/', 2)
);

-- Update INSERT policy to enforce {conversation_id}/{user_id}/... path format
DROP POLICY IF EXISTS "Participants can upload attachments" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload attachments" ON storage.objects;
CREATE POLICY "Participants can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-attachments'
  AND is_participant_in_attachment_conversation(name)
  AND (auth.uid())::text = split_part(name, '/', 2)
);
