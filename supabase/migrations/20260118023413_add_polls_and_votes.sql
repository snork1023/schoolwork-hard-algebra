-- Create polls table
CREATE TABLE public.polls (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES public.profiles(id),
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  multiple_choice BOOLEAN NOT NULL DEFAULT false,
  anonymous BOOLEAN NOT NULL DEFAULT false,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create poll votes table
CREATE TABLE public.poll_votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  option_index INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(poll_id, user_id, option_index)
);

-- Enable RLS
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes ENABLE ROW LEVEL SECURITY;

-- Polls RLS policies
CREATE POLICY "Users can view polls in their conversations"
ON public.polls FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_participants.conversation_id = polls.conversation_id
    AND conversation_participants.user_id = auth.uid()
  )
);

CREATE POLICY "Users can create polls in their conversations"
ON public.polls FOR INSERT
WITH CHECK (
  auth.uid() = created_by AND
  EXISTS (
    SELECT 1 FROM conversation_participants
    WHERE conversation_participants.conversation_id = polls.conversation_id
    AND conversation_participants.user_id = auth.uid()
  )
);

CREATE POLICY "Poll creators can delete their polls"
ON public.polls FOR DELETE
USING (auth.uid() = created_by);

-- Poll votes RLS policies
CREATE POLICY "Users can view votes in their conversations"
ON public.poll_votes FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM polls p
    JOIN conversation_participants cp ON cp.conversation_id = p.conversation_id
    WHERE p.id = poll_votes.poll_id
    AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can vote on polls in their conversations"
ON public.poll_votes FOR INSERT
WITH CHECK (
  auth.uid() = user_id AND
  EXISTS (
    SELECT 1 FROM polls p
    JOIN conversation_participants cp ON cp.conversation_id = p.conversation_id
    WHERE p.id = poll_votes.poll_id
    AND cp.user_id = auth.uid()
  )
);

CREATE POLICY "Users can remove their own votes"
ON public.poll_votes FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime for polls
ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;
ALTER PUBLICATION supabase_realtime ADD TABLE public.poll_votes;