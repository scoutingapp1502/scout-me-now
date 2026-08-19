-- "Confidențialitate cont" → "Descoperitori" (scouts_only) is supposed to
-- mean "only approved Descoperitori (and admins) can see me" — but
-- can_view_profile() had an unconditional "any player can see any other
-- player" bypass that ran BEFORE the scouts_and_mutual/scouts_only checks,
-- so choosing "Descoperitori" never actually blocked ordinary players
-- (followed-back or not) from viewing the profile. Reported directly by
-- the user: "după ce am stabilit ca vreau sa ma vada doar descoperitorii,
-- tot ma pot vedea jucatori pe care ii urmaresc inapoi sau nu."
--
-- This bypass was originally added to fix a different, now-superseded bug
-- (players couldn't see each other at all in Community under the old
-- binary scouts_only/private model, before the 3-option
-- scouts_only/scouts_and_mutual/everyone design existed). With the current
-- explicit 3-tier choice, the bypass silently overrides the user's actual
-- selection instead of respecting it. Removed per explicit user decision:
-- "Descoperitori" now means exactly that — approved Descoperitori/scouts/
-- agents, the profile owner, and admins only. No implicit player exception
-- on any tier (scouts_only OR scouts_and_mutual) — scouts_and_mutual's
-- mutual-follow check further down already covers the "let some players
-- in" case for that tier, on its own terms, not via a blanket bypass.
CREATE OR REPLACE FUNCTION public.can_view_profile(_profile_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _visibility text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF auth.uid() = _profile_user_id THEN RETURN true; END IF;
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
