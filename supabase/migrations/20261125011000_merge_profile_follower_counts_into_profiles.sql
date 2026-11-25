ALTER TABLE public.profiles
ADD COLUMN follower_count INTEGER NOT NULL DEFAULT 0;

UPDATE public.profiles AS profile
SET follower_count = (
  SELECT COUNT(*)::INTEGER
  FROM public.profile_follows
  WHERE profile_follows.followed_id = profile.id
);

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_follower_count_nonnegative_check
CHECK (follower_count >= 0);

REVOKE INSERT, UPDATE ON TABLE public.profiles FROM PUBLIC, anon, authenticated;

GRANT INSERT (
  id,
  username,
  avatar_url,
  bio,
  discoverable,
  status,
  status_message,
  last_seen,
  settings,
  pronouns
) ON TABLE public.profiles TO authenticated;

GRANT UPDATE (
  username,
  avatar_url,
  bio,
  discoverable,
  status,
  status_message,
  last_seen,
  settings,
  pronouns
) ON TABLE public.profiles TO authenticated;

DROP TRIGGER IF EXISTS update_profile_follower_count_trigger ON public.profile_follows;
DROP FUNCTION IF EXISTS public.update_profile_follower_count();
DROP TRIGGER IF EXISTS create_profile_follower_count_trigger ON public.profiles;
DROP FUNCTION IF EXISTS public.create_profile_follower_count();
DROP TABLE public.profile_follower_counts;

CREATE FUNCTION public.update_profile_follower_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.profiles
    SET follower_count = follower_count + 1
    WHERE id = NEW.followed_id;
    RETURN NEW;
  END IF;

  UPDATE public.profiles
  SET follower_count = GREATEST(follower_count - 1, 0)
  WHERE id = OLD.followed_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER update_profile_follower_count_trigger
AFTER INSERT OR DELETE ON public.profile_follows
FOR EACH ROW
EXECUTE FUNCTION public.update_profile_follower_count();
