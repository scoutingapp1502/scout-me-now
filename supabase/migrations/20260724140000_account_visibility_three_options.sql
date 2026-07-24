-- Account privacy expands from a binary choice (scouts_only/private) to
-- three options:
--   'scouts_only'         - visible to scout/agent-role users only (unchanged)
--   'scouts_and_mutual'   - scouts/agents, plus followers you also follow
--                           back (mutual/reciprocal follow relationship)
--   'everyone'            - visible to any authenticated user
-- The old 'private' value (approved-followers-only) is migrated to
-- 'scouts_and_mutual', the closest equivalent that still exists as an
-- option, since a plain one-directional "approved follower" tier is being
-- replaced by the mutual-follow tier per the new 3-option design.
ALTER TABLE public.user_privacy_settings
  DROP CONSTRAINT IF EXISTS user_privacy_settings_account_visibility_check;

UPDATE public.user_privacy_settings
SET account_visibility = 'scouts_and_mutual'
WHERE account_visibility = 'private';

ALTER TABLE public.user_privacy_settings
  ADD CONSTRAINT user_privacy_settings_account_visibility_check
    CHECK (account_visibility IN ('scouts_only', 'scouts_and_mutual', 'everyone'));

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

  IF public.has_role(auth.uid(), 'scout'::app_role) OR public.has_role(auth.uid(), 'agent'::app_role) THEN
    RETURN true;
  END IF;

  IF _visibility = 'scouts_and_mutual' THEN
    -- Mutual follow: viewer follows the profile owner AND the owner follows
    -- the viewer back, both accepted.
    RETURN EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = auth.uid() AND following_id = _profile_user_id AND status = 'accepted'
    ) AND EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = _profile_user_id AND following_id = auth.uid() AND status = 'accepted'
    );
  END IF;

  RETURN false; -- 'scouts_only' and viewer is neither a scout/agent nor mutual
END;
$$;
