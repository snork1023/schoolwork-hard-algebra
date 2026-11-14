-- Fix SELECT RLS to allow creators to view newly created conversations
DROP POLICY IF EXISTS "Users can view conversations they're part of" ON public.conversations;

CREATE POLICY "Users can view conversations they created or are part of"
ON public.conversations
FOR SELECT
USING (
  (created_by = auth.uid())
  OR EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = conversations.id
      AND cp.user_id = auth.uid()
  )
);