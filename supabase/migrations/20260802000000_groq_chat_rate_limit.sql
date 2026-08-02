CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.chat_rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_rate_limits_user_created_at_idx
  ON public.chat_rate_limits (user_id, created_at DESC);

CREATE OR REPLACE FUNCTION public.consume_chat_request(
  p_user_id uuid,
  p_limit integer DEFAULT 30,
  p_window_minutes integer DEFAULT 60
)
RETURNS TABLE (
  allowed boolean,
  used_count integer,
  resets_at timestamptz,
  limit_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  window_start timestamptz := now() - make_interval(mins => p_window_minutes);
  current_count integer;
  oldest_created timestamptz;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  SELECT count(*)::integer
    INTO current_count
  FROM public.chat_rate_limits
  WHERE user_id = p_user_id
    AND created_at >= window_start;

  IF current_count >= p_limit THEN
    SELECT created_at
      INTO oldest_created
    FROM public.chat_rate_limits
    WHERE user_id = p_user_id
      AND created_at >= window_start
    ORDER BY created_at ASC
    LIMIT 1;

    RETURN QUERY
    SELECT
      false,
      current_count,
      oldest_created + make_interval(mins => p_window_minutes),
      p_limit;
    RETURN;
  END IF;

  INSERT INTO public.chat_rate_limits (user_id, created_at)
  VALUES (p_user_id, now());

  RETURN QUERY
  SELECT
    true,
    current_count + 1,
    NULL::timestamptz,
    p_limit;
END;
$$;

ALTER TABLE public.chat_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role can manage chat rate limits"
  ON public.chat_rate_limits
  FOR ALL
  USING (true)
  WITH CHECK (true);
