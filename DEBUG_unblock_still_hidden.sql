-- Run this in Supabase SQL Editor.
-- IMPORTANT: SQL Editor normally runs as a superuser (bypasses RLS
-- entirely), so a plain can_view_profile() call there always looks
-- correct regardless of RLS policies. This version explicitly switches to
-- the "authenticated" role AND sets the JWT claim, so RLS is actually
-- enforced during the query — this is the real test.

SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims = '{"sub": "6b1d45ba-3a31-4254-821b-3070bc4f644c", "role": "authenticated"}';

-- This is the exact kind of query Community/Messages run — does the row
-- come back at all under real RLS?
SELECT user_id, first_name, last_name, photo_url
FROM public.player_profiles
WHERE user_id = '3be6b6db-e5c2-494a-8b3d-baa5b4886b1b';

RESET ROLE;
