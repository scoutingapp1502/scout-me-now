-- support_tickets already had a 'report_user' category (used by Help &
-- Support's generic contact form and labeled "Rapoarte Utilizatori" in the
-- admin sidebar), but no column to record WHO was reported — only the
-- reporter and a freeform message. This adds that column so a report filed
-- from a chat conversation (not just the generic help form) can name the
-- reported account, and the admin panel can resolve their profile and act
-- on it (ban).
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS reported_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_support_tickets_reported_user_id ON public.support_tickets (reported_user_id);

-- The existing "support_tickets_insert_own" policy (auth.uid() = user_id)
-- already covers inserting a row with reported_user_id set — no RLS change
-- needed there, a reporter can name any other account without restriction
-- (the reported user has no way to see or block their own report, since
-- SELECT is scoped to the reporter and to admins only).
--
-- The existing "support_tickets_admin_update_all" policy already lets an
-- admin update status/admin_notes directly from the client — no new RPC
-- needed for that part. Actually setting the ban (auth.users.banned_until)
-- can only be done via the service-role key, so that part is a new Edge
-- Function (supabase/functions/ban-user/), not SQL — but *reading* whether
-- someone is currently banned can be a plain SECURITY DEFINER function
-- (runs as the function owner, who can see the auth schema), gated to
-- admins only so a banned status can't be probed by anyone else.
CREATE OR REPLACE FUNCTION public.is_user_banned(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _banned_until timestamptz;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT banned_until INTO _banned_until FROM auth.users WHERE id = _user_id;
  RETURN _banned_until IS NOT NULL AND _banned_until > now();
END;
$$;

GRANT EXECUTE ON FUNCTION public.is_user_banned(uuid) TO authenticated;
