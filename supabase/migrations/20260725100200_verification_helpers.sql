-- Two SECURITY DEFINER helpers backing the "read-only until approved" gate
-- for cauta_jucator (and, generically, any role that goes through document
-- verification — currently scout + cauta_jucator).

-- Used by can_view_profile() (next migration) to decide whether a scout/
-- agent/cauta_jucator viewer gets the privileged "see any profile" bypass.
-- Returns true unconditionally for roles that don't require verification
-- (not applicable to them), so this is a no-op for player/agent/club_rep/
-- admin and only meaningfully gates scout/cauta_jucator.
CREATE OR REPLACE FUNCTION public.is_verification_approved(_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT (public.has_role(_user_id, 'scout'::app_role) OR public.has_role(_user_id, 'cauta_jucator'::app_role)) THEN
    RETURN true;
  END IF;
  RETURN EXISTS (
    SELECT 1 FROM public.scout_verification_requests
    WHERE user_id = _user_id AND status = 'approved'
  );
END;
$$;

-- scout_verification_requests RLS only allows a user to read their own row
-- (or an admin to read any row) — a regular client browsing Community has
-- no permission to check *other* users' verification status directly. This
-- narrow RPC exposes only what's needed (which ids in a batch are approved)
-- without widening RLS on the sensitive table (document_url/reviewer_notes
-- stay inaccessible to non-owners/non-admins).
CREATE OR REPLACE FUNCTION public.get_approved_verification_ids(_user_ids uuid[])
RETURNS TABLE(user_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT svr.user_id FROM public.scout_verification_requests svr
  WHERE svr.user_id = ANY(_user_ids) AND svr.status = 'approved';
$$;

GRANT EXECUTE ON FUNCTION public.get_approved_verification_ids(uuid[]) TO authenticated;
