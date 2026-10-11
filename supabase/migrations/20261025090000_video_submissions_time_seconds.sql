-- Optional time field for "made_attempted" tests (e.g. Free Throw Shooting's
-- 60-second window) — admin-entered alongside made_count/attempted_count,
-- mirrored into test_rankings.time_seconds on review.
ALTER TABLE public.video_submissions
  ADD COLUMN time_seconds numeric;
