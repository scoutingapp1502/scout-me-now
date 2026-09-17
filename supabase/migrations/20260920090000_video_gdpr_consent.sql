-- Tracks when a player explicitly consented to having their test/highlight
-- videos processed and reviewed on the platform (relevant since many
-- players are minors, so this is personal data about a child).
ALTER TABLE public.player_profiles
  ADD COLUMN IF NOT EXISTS video_consent_given_at timestamptz;
