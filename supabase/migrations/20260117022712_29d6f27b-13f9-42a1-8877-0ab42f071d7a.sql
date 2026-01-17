-- Enable realtime for profiles table to broadcast status changes
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;