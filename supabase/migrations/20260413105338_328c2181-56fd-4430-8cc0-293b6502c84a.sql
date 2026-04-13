DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;

CREATE POLICY "Authenticated can read all roles"
  ON public.user_roles
  FOR SELECT
  TO authenticated
  USING (true);