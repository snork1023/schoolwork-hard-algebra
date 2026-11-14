-- Make created_by NOT NULL
ALTER TABLE public.conversations
ALTER COLUMN created_by SET NOT NULL;