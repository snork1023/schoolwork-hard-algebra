-- Remove the old INSERT policy that doesn't enforce user_id in path
DROP POLICY IF EXISTS "Authenticated users can upload to their conversations" ON storage.objects;
