-- Lets a player drag their avatar photo within its frame; stores the crop
-- anchor as a percentage (matches CSS object-position: X% Y%).
ALTER TABLE public.player_profiles ADD COLUMN avatar_pos_x numeric NOT NULL DEFAULT 50;
ALTER TABLE public.player_profiles ADD COLUMN avatar_pos_y numeric NOT NULL DEFAULT 50;
