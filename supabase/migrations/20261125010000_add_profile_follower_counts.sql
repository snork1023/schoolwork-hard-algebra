CREATE TABLE public.profile_follower_counts (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  follower_count INTEGER NOT NULL DEFAULT 0 CHECK (follower_count >= 0)
);

INSERT INTO public.profile_follower_counts (user_id, follower_count)
SELECT
  profiles.id,
  COUNT(profile_follows.follower_id)::INTEGER
FROM public.profiles
LEFT JOIN public.profile_follows ON profile_follows.followed_id = profiles.id
GROUP BY profiles.id;

ALTER TABLE public.profile_follower_counts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view profile follower counts"
ON public.profile_follower_counts
FOR SELECT
TO authenticated
USING (true);

CREATE FUNCTION public.create_profile_follower_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profile_follower_counts (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER create_profile_follower_count_trigger
AFTER INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.create_profile_follower_count();

CREATE FUNCTION public.update_profile_follower_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.profile_follower_counts (user_id, follower_count)
    VALUES (NEW.followed_id, 1)
    ON CONFLICT (user_id)
    DO UPDATE SET follower_count = profile_follower_counts.follower_count + 1;
    RETURN NEW;
  END IF;

  UPDATE public.profile_follower_counts
  SET follower_count = GREATEST(follower_count - 1, 0)
  WHERE user_id = OLD.followed_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER update_profile_follower_count_trigger
AFTER INSERT OR DELETE ON public.profile_follows
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_follower_count();
