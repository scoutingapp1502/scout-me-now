-- Lets admin video review record an objective made/attempted result (e.g.
-- "18 coșuri din 25 aruncări") for shooting/target drills, instead of only
-- a single subjective 1-10 grade. Denormalized onto video_submissions so
-- PersonalProfile.tsx's existing single-source `sub` read keeps working
-- without a second fetch; reviewVideo() also mirrors the same result into
-- test_rankings (see src/hooks/useVideoSubmissions.ts).
ALTER TABLE public.video_submissions
  ADD COLUMN made_count integer,
  ADD COLUMN attempted_count integer;
