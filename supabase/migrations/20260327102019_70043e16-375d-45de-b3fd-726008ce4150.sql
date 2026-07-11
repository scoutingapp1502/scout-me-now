ALTER TABLE public.player_profiles
  ADD COLUMN IF NOT EXISTS control_pass_video text,
  ADD COLUMN IF NOT EXISTS slalom_video text,
  ADD COLUMN IF NOT EXISTS precision_video text,
  ADD COLUMN IF NOT EXISTS coordination_video text,
  ADD COLUMN IF NOT EXISTS long_pass_video text;