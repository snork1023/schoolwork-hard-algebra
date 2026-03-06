
-- Allow anyone (including anonymous/unauthenticated) to view games
DROP POLICY "Authenticated users can view games" ON public.custom_games;
CREATE POLICY "Anyone can view games"
  ON public.custom_games FOR SELECT
  USING (true);
