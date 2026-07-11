-- Security fix: the original INSERT policy on user_roles only checked
-- auth.uid() = user_id, without restricting which role value could be
-- inserted. Since user_metadata (and therefore the client-driven
-- ensureRoleAndProfile flow) is fully controlled by the requesting user,
-- any authenticated user could insert a row granting themselves the
-- 'admin' role, which is trusted by has_role()/get_user_role() and by
-- every admin-gated RLS policy in the app.
DROP POLICY IF EXISTS "System inserts roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can self-assign non-privileged role" ON public.user_roles;

CREATE POLICY "Users can self-assign non-privileged role"
  ON public.user_roles
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND role <> 'admin'::app_role
  );
