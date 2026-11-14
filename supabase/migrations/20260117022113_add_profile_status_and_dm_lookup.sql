-- Add status column to profiles table for Discord-like status indicators
ALTER TABLE public.profiles 
ADD COLUMN status TEXT DEFAULT 'offline' CHECK (status IN ('online', 'idle', 'dnd', 'offline'));

-- Add custom status message column
ALTER TABLE public.profiles 
ADD COLUMN status_message TEXT DEFAULT NULL;

-- Add last_seen timestamp for automatic status management
ALTER TABLE public.profiles 
ADD COLUMN last_seen TIMESTAMP WITH TIME ZONE DEFAULT now();

-- Create index for faster status queries
CREATE INDEX idx_profiles_status ON public.profiles(status);

-- Create a function to find existing DM between two users
CREATE OR REPLACE FUNCTION public.find_existing_dm(user1_id UUID, user2_id UUID)
RETURNS UUID AS $$
DECLARE
  existing_conv_id UUID;
BEGIN
  SELECT c.id INTO existing_conv_id
  FROM conversations c
  WHERE c.type = 'dm'
    AND EXISTS (
      SELECT 1 FROM conversation_participants cp1 
      WHERE cp1.conversation_id = c.id AND cp1.user_id = user1_id
    )
    AND EXISTS (
      SELECT 1 FROM conversation_participants cp2 
      WHERE cp2.conversation_id = c.id AND cp2.user_id = user2_id
    )
  LIMIT 1;
  
  RETURN existing_conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;