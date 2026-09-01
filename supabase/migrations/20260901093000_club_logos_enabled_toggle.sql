-- Admins can hide a club's logo from player/scout-facing pages without deleting it.
ALTER TABLE public.club_logos ADD COLUMN enabled boolean NOT NULL DEFAULT true;
