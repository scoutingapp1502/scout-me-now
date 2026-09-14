-- "Pornește acum" (emergency start) fills scheduled_end with a made-up
-- +1h default when the admin hasn't set a real one, so the maintenance
-- page was showing a "Perioadă estimată" the admin never actually chose.
-- end_is_estimate distinguishes a real, admin-picked end time (shown to
-- users) from a synthetic placeholder end time (hidden — the page just
-- won't claim to know when maintenance ends).
ALTER TABLE public.maintenance_mode
  ADD COLUMN IF NOT EXISTS end_is_estimate boolean NOT NULL DEFAULT false;
