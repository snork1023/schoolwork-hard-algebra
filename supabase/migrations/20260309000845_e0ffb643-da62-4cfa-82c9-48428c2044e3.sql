-- Update the handle_new_user function to handle duplicate usernames
-- by appending a random suffix if the username is already taken
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  base_username TEXT;
  final_username TEXT;
  counter INTEGER := 0;
  max_attempts INTEGER := 10;
BEGIN
  -- Get the base username from metadata or email
  base_username := COALESCE(
    NEW.raw_user_meta_data->>'username',
    split_part(NEW.email, '@', 1)
  );
  
  -- Start with the base username
  final_username := base_username;
  
  -- Keep trying until we find an available username
  WHILE counter < max_attempts LOOP
    -- Try to insert with the current username
    BEGIN
      INSERT INTO public.profiles (id, username)
      VALUES (NEW.id, final_username);
      -- If successful, exit the loop
      EXIT;
    EXCEPTION
      WHEN unique_violation THEN
        -- If username is taken, append a random suffix
        counter := counter + 1;
        final_username := base_username || floor(random() * 9000 + 1000)::TEXT;
    END;
  END LOOP;
  
  -- If we couldn't find an available username after max attempts, raise an error
  IF counter >= max_attempts THEN
    RAISE EXCEPTION 'Could not generate unique username after % attempts', max_attempts;
  END IF;
  
  RETURN NEW;
END;
$function$;