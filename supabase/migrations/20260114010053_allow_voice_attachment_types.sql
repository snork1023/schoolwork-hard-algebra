-- Allow common voice message MIME types for the chat-attachments storage bucket
DO $$
BEGIN
  -- Ensure the bucket exists
  IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'chat-attachments') THEN
    RAISE EXCEPTION 'Bucket % does not exist', 'chat-attachments';
  END IF;

  -- Expand allowed MIME types to include audio recordings from browsers
  UPDATE storage.buckets
  SET allowed_mime_types = ARRAY[
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
    'audio/mpeg',
    'audio/wav',
    'audio/x-wav',
    'audio/aac'
  ],
  -- keep limit aligned with the app upload limits (20MB)
  file_size_limit = 20971520
  WHERE id = 'chat-attachments';
END $$;