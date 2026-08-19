-- "Ceilalti jucatori iar nu sunt vizibili" — reported by the user again
-- right after 20260812090000 removed the "any player sees any other
-- player" bypass. Root cause: can_view_profile() fell back to
-- COALESCE(_visibility, 'scouts_only') whenever a profile owner has no
-- row at all in user_privacy_settings (never opened "Confidențialitate
-- cont"). Most existing player accounts predate that settings screen and
-- have no row, so once the blanket player-sees-player bypass was removed,
-- they all silently became invisible to ordinary players — even though
-- 20260725100400_account_visibility_default_everyone.sql already changed
-- the column's DEFAULT to 'everyone' for any row that DOES get created.
-- The COALESCE fallback (used only when a row is entirely missing) had
-- never been updated to match, so it was still effectively defaulting
-- brand-new/untouched accounts to the stricter tier.
--
-- Align the two: missing row now falls back to 'everyone', matching the
-- column's own DEFAULT. Deliberately not backfilling existing rows here
-- either (same reasoning as 20260725100400): a stored 'scouts_only' value
-- is a real, distinguishable user choice and must not be silently
-- overwritten — only the "row doesn't exist yet" fallback changes.
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
