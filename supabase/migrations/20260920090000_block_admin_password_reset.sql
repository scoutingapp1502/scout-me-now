-- The admin account's password should only ever be changed manually from
-- the Supabase dashboard, never via the public "forgot password" flow —
-- that flow is initiable by anyone who types in the admin's email, and
-- while the reset link itself only ever reaches the admin's real inbox,
-- the request itself is a needless attack surface for a privileged account.
--
-- is_admin_email() is SECURITY DEFINER so it can look up auth.users/
-- user_roles regardless of the (anonymous, pre-login) caller's own RLS
-- visibility, but it deliberately returns nothing except a bare boolean —
-- no name, no confirmation of whether the email exists at all — so calling
-- it can't be used to enumerate accounts or distinguish "admin" from
-- "doesn't exist" from any other outcome.
CREATE OR REPLACE FUNCTION public.is_admin_email(_email text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM auth.users u
    JOIN public.user_roles ur ON ur.user_id = u.id
    WHERE lower(u.email) = lower(_email) AND ur.role = 'admin'::app_role
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_email(text) TO anon, authenticated;
