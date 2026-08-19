-- "Profile blocate" (BlockedSection.tsx) lost the blocked person's name
-- and photo from its own list after blocking them — reported directly by
-- the user: "Pe blocheaza sa apara in continuare dupa ce am blocat poza si
-- numele celui ce e blocat" (currently missing).
--
-- Root cause: can_view_profile()'s block check (added in
-- 20260811093000_blocks_real_enforcement.sql) is symmetric — it denies
-- BOTH directions once a block exists between two users. That correctly
-- stops the blocked person from viewing the blocker's profile, but it
-- also stopped the BLOCKER's own client from reading the blocked
-- person's player_profiles/scout_profiles row (RLS-gated by
-- can_view_profile) to render their name/avatar back in the blocker's own
-- "Profile blocate" list — you need to be able to see basic info about
-- someone you blocked to manage having blocked them.
--
-- Fix: the party who INITIATED the block (blocker) keeps the ability to
-- view the blocked person's profile; only the blocked person loses access
-- to the blocker's profile. is_blocked_between() stays as the symmetric
-- existence check used elsewhere (e.g. can_message_user, request_follow,
-- where blocking should stop interaction in both directions); this
-- directional check is local to can_view_profile() only.
CREATE OR REPLACE FUNCTION public.can_view_profile(_profile_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _visibility text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF auth.uid() = _profile_user_id THEN RETURN true; END IF;

  -- Viewer blocked the profile owner: viewer keeps read access (needed to
  -- render the blocked person's name/photo in the viewer's own "Profile
  -- blocate" list), but this does NOT go both ways.
  IF EXISTS (
    SELECT 1 FROM public.blocks WHERE blocker_id = auth.uid() AND blocked_id = _profile_user_id
  ) THEN
    RETURN true;
  END IF;

  -- Profile owner blocked the viewer (either direction beyond the case
  -- above): viewer is denied.
  IF public.is_blocked_between(auth.uid(), _profile_user_id) THEN RETURN false; END IF;

  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN true; END IF;

  SELECT account_visibility INTO _visibility FROM public.user_privacy_settings WHERE user_id = _profile_user_id;
  _visibility := COALESCE(_visibility, 'scouts_only');

  IF _visibility = 'everyone' THEN
    RETURN true;
  END IF;

  IF (public.has_role(auth.uid(), 'scout'::app_role) OR public.has_role(auth.uid(), 'agent'::app_role)
      OR public.has_role(auth.uid(), 'cauta_jucator'::app_role))
     AND public.is_verification_approved(auth.uid()) THEN
    RETURN true;
  END IF;

  IF _visibility = 'scouts_and_mutual' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = auth.uid() AND following_id = _profile_user_id AND status = 'accepted'
    ) AND EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = _profile_user_id AND following_id = auth.uid() AND status = 'accepted'
    );
  END IF;

  RETURN false;
END;
$$;
