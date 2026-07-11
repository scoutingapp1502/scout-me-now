ALTER TABLE public.player_profiles
  ADD COLUMN IF NOT EXISTS speed_video text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS jumping_video text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS endurance_video text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS acceleration_video text DEFAULT NULL;
