DROP FUNCTION IF EXISTS public.consume_chat_request(uuid, integer, integer);

CREATE OR REPLACE FUNCTION public.consume_chat_request(
  p_user_id uuid,
  p_limit integer DEFAULT 30,
  p_window_minutes integer DEFAULT 60
)
RETURNS TABLE (
  allowed boolean,
  used_count integer,
  resets_at timestamptz,
  limit_count integer,
  reservation_id uuid
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  window_start timestamptz := now() - make_interval(mins => p_window_minutes);
  current_count integer;
  oldest_created timestamptz;
  inserted_id uuid;
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
      p_limit,
      NULL::uuid;
    RETURN;
  END IF;

  INSERT INTO public.chat_rate_limits (user_id, created_at)
  VALUES (p_user_id, now())
  RETURNING id INTO inserted_id;

  RETURN QUERY
  SELECT
    true,
    current_count + 1,
    NULL::timestamptz,
    p_limit,
    inserted_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_chat_request(p_reservation_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  deleted_count integer;
BEGIN
  DELETE FROM public.chat_rate_limits
  WHERE id = p_reservation_id;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count = 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.consume_chat_request(uuid, integer, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_chat_request(uuid) TO service_role;