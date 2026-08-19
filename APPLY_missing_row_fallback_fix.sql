-- Run this in Supabase SQL Editor to fix players becoming invisible to
-- each other after the "Descoperitori" bypass removal. Most existing
-- player accounts never opened "Confidențialitate cont" and have no row
-- in user_privacy_settings at all — can_view_profile() was still falling
-- back to the old 'scouts_only' default for those, even though the
-- column's actual DEFAULT (for rows that do get created) was already
-- changed to 'everyone' earlier. This aligns the fallback with that
-- default. Does not touch any row that already has an explicit,
-- deliberately-chosen value.

-- ===== 20260812093000_fix_missing_row_visibility_fallback.sql =====
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
  _visibility := COALESCE(_visibility, 'everyone');

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
