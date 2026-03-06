
-- Create custom_games table
CREATE TABLE public.custom_games (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 100),
  iframe_src text NOT NULL CHECK (iframe_src ~ '^https://'),
  added_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.custom_games ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view games
CREATE POLICY "Authenticated users can view games"
  ON public.custom_games FOR SELECT
  TO authenticated
  USING (true);

-- Only authenticated users can insert (UI gates behind developer mode)
CREATE POLICY "Authenticated users can add games"
  ON public.custom_games FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = added_by);

-- Users can delete games they added
CREATE POLICY "Users can delete their own games"
  ON public.custom_games FOR DELETE
  TO authenticated
  USING (auth.uid() = added_by);
