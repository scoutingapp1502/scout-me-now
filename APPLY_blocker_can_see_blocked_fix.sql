-- Run this in Supabase SQL Editor to fix "Profile blocate" losing the
-- name/photo of a person after blocking them. can_view_profile()'s block
-- check was symmetric, so the blocker also lost read access to the
-- blocked person's profile — needed to render their name/photo back in
-- the blocker's own list. Now the blocker keeps read access; only the
-- blocked person loses access to the blocker's profile.

-- ===== 20260812092000_blocker_can_still_see_blocked_profile.sql =====
CREATE OR REPLACE FUNCTION public.can_view_profile(_profile_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _visibility text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF auth.uid() = _profile_user_id THEN RETURN true; END IF;

  IF EXISTS (
    SELECT 1 FROM public.blocks WHERE blocker_id = auth.uid() AND blocked_id = _profile_user_id
  ) THEN
    RETURN true;
  END IF;

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
