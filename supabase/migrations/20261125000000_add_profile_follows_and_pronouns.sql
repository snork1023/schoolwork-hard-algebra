ALTER TABLE public.profiles
ADD COLUMN pronouns TEXT;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_pronouns_length_check
CHECK (pronouns IS NULL OR length(pronouns) <= 50);

CREATE TABLE public.profile_follows (
  follower_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  followed_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (follower_id, followed_id),
  CONSTRAINT profile_follows_not_self_check CHECK (follower_id <> followed_id)
);

CREATE INDEX profile_follows_followed_id_idx ON public.profile_follows(followed_id);

ALTER TABLE public.profile_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view profile follows"
ON public.profile_follows
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can follow profiles as themselves"
ON public.profile_follows
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can unfollow profiles as themselves"
ON public.profile_follows
FOR DELETE
TO authenticated
USING (auth.uid() = follower_id);
