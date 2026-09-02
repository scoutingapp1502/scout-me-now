-- Tracks whether a user has completed the first-time "how the app works" tour,
-- so it only ever shows once (unlike the profile-completion wizard, which can
-- reappear each session until the profile is 100% complete).
ALTER TABLE public.player_profiles ADD COLUMN has_seen_tour boolean NOT NULL DEFAULT false;
ALTER TABLE public.scout_profiles ADD COLUMN has_seen_tour boolean NOT NULL DEFAULT false;
