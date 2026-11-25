UPDATE public.profiles
SET pronouns = 'N/A'
WHERE pronouns IS NULL
   OR pronouns NOT IN ('N/A', 'he/him', 'she/her', 'they/them');

ALTER TABLE public.profiles
ALTER COLUMN pronouns SET DEFAULT 'N/A',
ALTER COLUMN pronouns SET NOT NULL;

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_pronouns_options_check
CHECK (pronouns IN ('N/A', 'he/him', 'she/her', 'they/them'));
