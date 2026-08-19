-- Run this single query in Supabase SQL Editor and send back the result
-- (the "role" column for each user_id).
SELECT user_id, role
FROM public.user_roles
WHERE user_id IN (
  '3be6b6db-e5c2-494a-8b3d-baa5b4886b1b',
  '6b1d45ba-3a31-4254-821b-3070bc4f644c'
);
