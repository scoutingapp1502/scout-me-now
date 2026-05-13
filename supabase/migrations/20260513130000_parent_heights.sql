ALTER TABLE player_profiles
  ADD COLUMN IF NOT EXISTS father_height_cm integer,
  ADD COLUMN IF NOT EXISTS mother_height_cm integer;
