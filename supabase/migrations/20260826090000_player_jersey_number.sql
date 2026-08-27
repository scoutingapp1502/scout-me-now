-- Shirt/jersey number, editable alongside position in the profile header.
ALTER TABLE public.player_profiles ADD COLUMN IF NOT EXISTS jersey_number smallint NULL;
