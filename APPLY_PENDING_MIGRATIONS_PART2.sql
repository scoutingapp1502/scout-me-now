-- PART 2 of 2 — run AFTER Part 1 has completed successfully (separate paste/run).
-- These migrations reference the 'cauta_jucator' enum value added in Part 1,
-- which must already be committed.
-- Regenerated 2026-07-25.

-- ===== 20260725100100_scout_profiles_cauta_jucator_rls.sql =====
-- cauta_jucator mirrors scout/agent for all the RLS policies that gate
-- "own profile / own scouting activity" writes, so it can save its own
-- profile (always allowed, even before verification, per product decision)
-- and use the same scouting features (favorites, contact requests, posts)
-- once approved.
DROP POLICY IF EXISTS "Scouts and agents can insert own profile" ON public.scout_profiles;
CREATE POLICY "Scouts and agents can insert own profile" ON public.scout_profiles
  FOR INSERT TO public
  WITH CHECK (auth.uid() = user_id AND (
    has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'cauta_jucator'::app_role)
  ));

DROP POLICY IF EXISTS "Scouts and agents can update own profile" ON public.scout_profiles;
CREATE POLICY "Scouts and agents can update own profile" ON public.scout_profiles
  FOR UPDATE TO public
  USING (auth.uid() = user_id AND (
    has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'cauta_jucator'::app_role)
  ));

DROP POLICY IF EXISTS "Scouts and agents can insert own posts" ON public.scout_posts;
CREATE POLICY "Scouts and agents can insert own posts" ON public.scout_posts
  FOR INSERT TO public
  WITH CHECK (auth.uid() = user_id AND (
    has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'cauta_jucator'::app_role)
  ));

DROP POLICY IF EXISTS "Scouts and agents can update own posts" ON public.scout_posts;
CREATE POLICY "Scouts and agents can update own posts" ON public.scout_posts
  FOR UPDATE TO public
  USING (auth.uid() = user_id AND (
    has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'cauta_jucator'::app_role)
  ));

DROP POLICY IF EXISTS "Scouts and agents can delete own posts" ON public.scout_posts;
CREATE POLICY "Scouts and agents can delete own posts" ON public.scout_posts
  FOR DELETE TO public
  USING (auth.uid() = user_id AND (
    has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'cauta_jucator'::app_role)
  ));

DROP POLICY IF EXISTS "Scouts and agents can manage favorites" ON public.favorite_players;
CREATE POLICY "Scouts and agents can manage favorites" ON public.favorite_players
  FOR ALL TO public
  USING (auth.uid() = scout_user_id AND (
    has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'cauta_jucator'::app_role)
  ));

DROP POLICY IF EXISTS "Scouts and agents can send contact requests" ON public.contact_requests;
CREATE POLICY "Scouts and agents can send contact requests" ON public.contact_requests
  FOR INSERT TO public
  WITH CHECK (auth.uid() = requester_user_id AND (
    has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'cauta_jucator'::app_role)
  ));

-- ===== 20260725100200_verification_helpers.sql =====
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

-- ===== 20260725100300_can_view_profile_cauta_jucator.sql =====
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

-- ===== 20260725100400_account_visibility_default_everyone.sql =====
-- New default for account_visibility, per product decision: every new user
-- should default to fully public visibility rather than the previous
-- scouts_only default.
--
-- Deliberately NOT backfilling existing rows: a row already sitting at the
-- old 'scouts_only' default is indistinguishable from a row where a user
-- explicitly chose 'scouts_only' — both look identical in the database.
-- Backfilling would risk silently overriding a deliberate privacy choice,
-- so only NEW user_privacy_settings rows get the new default.
ALTER TABLE public.user_privacy_settings
  ALTER COLUMN account_visibility SET DEFAULT 'everyone';

