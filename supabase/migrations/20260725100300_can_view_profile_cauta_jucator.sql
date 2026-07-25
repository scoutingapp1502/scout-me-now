-- Extends the scout/agent privileged-viewer bypass to include cauta_jucator,
-- gated on is_verification_approved() so an unapproved cauta_jucator does
-- NOT get the bypass — they fall through to the normal visibility rules
-- like any ordinary viewer (denied on scouts_only, still allowed on
-- everyone/mutual-follow tiers). This is a no-op for agent (always
-- "approved" per the helper) and a no-op for scout's reachable behavior
-- (scout can't get past Dashboard's full-page block while unapproved
-- anyway) — purely enabling for cauta_jucator.
CREATE OR REPLACE FUNCTION public.can_view_profile(_profile_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _visibility text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF auth.uid() = _profile_user_id THEN RETURN true; END IF;
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

  -- account_visibility only ever restricts access for scouts/agents vs.
  -- everyone else — it was never meant to hide ordinary players from each
  -- other in Community. An ordinary player viewing another player's profile
  -- always passes, regardless of the profile owner's scouts_only/
  -- scouts_and_mutual choice.
  IF public.has_role(_profile_user_id, 'player'::app_role) AND public.has_role(auth.uid(), 'player'::app_role) THEN
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
