CREATE OR REPLACE FUNCTION public.get_chat_quota(
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

  RETURN QUERY
  SELECT
    true,
    current_count,
    NULL::timestamptz,
    p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_chat_quota(uuid, integer, integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_chat_quota(uuid, integer, integer) TO service_role;

DROP POLICY IF EXISTS "Users can read their own rate-limit rows" ON public.chat_rate_limits;
CREATE POLICY "Users can read their own rate-limit rows"
  ON public.chat_rate_limits
  FOR SELECT
  USING (user_id = auth.uid());
