-- Club logos must be scoped per sport: the same club name can exist as both
-- a football team and a basketball team, and previously club_name alone was
-- unique so the two would collide.
ALTER TABLE public.club_logos ADD COLUMN sport text NOT NULL DEFAULT 'football';

ALTER TABLE public.club_logos DROP CONSTRAINT club_logos_club_name_key;
ALTER TABLE public.club_logos ADD CONSTRAINT club_logos_sport_club_name_key UNIQUE (sport, club_name);
