CREATE TABLE public.profile_blocks (
  blocker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CONSTRAINT profile_blocks_not_self_check CHECK (blocker_id <> blocked_id)
);

ALTER TABLE public.profile_blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own blocks"
ON public.profile_blocks
FOR SELECT
TO authenticated
USING (auth.uid() = blocker_id);

CREATE POLICY "Users can block profiles as themselves"
ON public.profile_blocks
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = blocker_id);

CREATE POLICY "Users can unblock profiles as themselves"
ON public.profile_blocks
FOR DELETE
TO authenticated
USING (auth.uid() = blocker_id);

CREATE OR REPLACE FUNCTION public.profile_block_exists_for_current_user(_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.profile_blocks
    WHERE (blocker_id = auth.uid() AND blocked_id = _profile_id)
       OR (blocker_id = _profile_id AND blocked_id = auth.uid())
  )
$$;

CREATE OR REPLACE FUNCTION public.profile_is_hidden_from_current_user(_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.profile_blocks
    WHERE blocker_id = _profile_id
      AND blocked_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.profile_is_blocked_by_current_user(_profile_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.profile_blocks
    WHERE blocker_id = auth.uid()
      AND blocked_id = _profile_id
  )
$$;

CREATE OR REPLACE FUNCTION public.can_add_conversation_participant(
  _conversation_id UUID,
  _participant_id UUID
)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1
    FROM public.conversations AS conversation
    WHERE conversation.id = _conversation_id
      AND conversation.created_by = auth.uid()
      AND (
        conversation.type <> 'dm'
        OR _participant_id = auth.uid()
        OR NOT public.profile_block_exists_for_current_user(_participant_id)
      )
  )
$$;

REVOKE ALL ON FUNCTION public.profile_block_exists_for_current_user(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.profile_is_hidden_from_current_user(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.profile_is_blocked_by_current_user(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.can_add_conversation_participant(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.profile_block_exists_for_current_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_is_hidden_from_current_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.profile_is_blocked_by_current_user(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_add_conversation_participant(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "Authenticated users can view discoverable profiles or own profile" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Authenticated users can view discoverable profiles not blocking them"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.profile_is_blocked_by_current_user(id)
  OR (
    discoverable = true
    AND NOT public.profile_is_hidden_from_current_user(id)
  )
);

DROP POLICY IF EXISTS "Users can follow profiles as themselves" ON public.profile_follows;

CREATE POLICY "Users can follow profiles without a block"
ON public.profile_follows
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = follower_id
  AND NOT public.profile_block_exists_for_current_user(followed_id)
);

DROP POLICY IF EXISTS "Users can add participants when creating conversations" ON public.conversation_participants;

CREATE POLICY "Conversation creators can add permitted participants"
ON public.conversation_participants
FOR INSERT
TO authenticated
WITH CHECK (public.can_add_conversation_participant(conversation_id, user_id));

CREATE OR REPLACE FUNCTION public.prevent_conversation_type_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.type IS DISTINCT FROM OLD.type THEN
    RAISE EXCEPTION 'Conversation type cannot be changed';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER prevent_conversation_type_change_trigger
BEFORE UPDATE OF type ON public.conversations
FOR EACH ROW
EXECUTE FUNCTION public.prevent_conversation_type_change();

CREATE OR REPLACE FUNCTION public.cleanup_blocked_profile_relationships()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.conversations AS conversation
  WHERE conversation.type = 'dm'
    AND EXISTS (
      SELECT 1
      FROM public.conversation_participants AS participant
      WHERE participant.conversation_id = conversation.id
        AND participant.user_id = NEW.blocker_id
    )
    AND EXISTS (
      SELECT 1
      FROM public.conversation_participants AS participant
      WHERE participant.conversation_id = conversation.id
        AND participant.user_id = NEW.blocked_id
    );

  DELETE FROM public.profile_follows
  WHERE (follower_id = NEW.blocker_id AND followed_id = NEW.blocked_id)
     OR (follower_id = NEW.blocked_id AND followed_id = NEW.blocker_id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER cleanup_blocked_profile_relationships_trigger
AFTER INSERT ON public.profile_blocks
FOR EACH ROW
EXECUTE FUNCTION public.cleanup_blocked_profile_relationships();
