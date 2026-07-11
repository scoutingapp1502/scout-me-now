ALTER TABLE public.player_profiles
ADD COLUMN IF NOT EXISTS full_match_videos text[] DEFAULT '{}'::text[],
ADD COLUMN IF NOT EXISTS full_match_descriptions text[] DEFAULT '{}'::text[];