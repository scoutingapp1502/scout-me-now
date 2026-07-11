-- scout_verification_requests only had a SELECT policy scoped to the
-- requesting user's own row. Admins had no SELECT or UPDATE policy at all,
-- so the AdminScoutVerification review screen could not see pending
-- requests from other users, and approve/reject actions silently failed
-- under RLS (0 rows affected, no error surfaced by supabase-js).
DROP POLICY IF EXISTS "admin_select_all" ON public.scout_verification_requests;
DROP POLICY IF EXISTS "admin_update_all" ON public.scout_verification_requests;

CREATE POLICY "admin_select_all" ON public.scout_verification_requests
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_update_all" ON public.scout_verification_requests
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
