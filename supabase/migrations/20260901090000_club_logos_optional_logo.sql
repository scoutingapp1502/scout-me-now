-- A club can now be saved with just a name; the logo can be added later.
ALTER TABLE public.club_logos ALTER COLUMN logo_url DROP NOT NULL;
