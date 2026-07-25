-- Account privacy is simplified from a public/private toggle to a binary
-- choice: visible to scouts/agents only, or fully private (approved
-- followers only). Unlike the old is_private_account toggle, this is now
-- actually enforced in RLS on player_profiles and posts — previously the
-- setting was saved but nothing in the app ever checked it.
ALTER TABLE public.user_privacy_settings
  ADD COLUMN IF NOT EXISTS account_visibility text NOT NULL DEFAULT 'scouts_only'
    CHECK (account_visibility IN ('scouts_only', 'private'));

-- One-time backfill only: this must NOT blindly re-run on every replay of
-- this idempotent bundle. account_visibility was later widened to a
-- 3-option domain (scouts_only/scouts_and_mutual/everyone) by
-- 20260724140000_account_visibility_three_options.sql, which drops
-- 'private' as a valid value entirely and re-normalizes every row into the
-- 3-option domain. So: if the constraint currently in force already allows
-- 'scouts_and_mutual'/'everyone' (i.e. the later migration has already run
-- at some point), this backfill is obsolete and must be skipped — an
-- unconditional UPDATE here would stomp already-migrated rows back to the
-- no-longer-valid 'private' value and violate that later CHECK constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_privacy_settings'::regclass
      AND conname = 'user_privacy_settings_account_visibility_check'
      AND pg_get_constraintdef(oid) LIKE '%scouts_and_mutual%'
  ) THEN
    UPDATE public.user_privacy_settings
    SET account_visibility = CASE WHEN is_private_account THEN 'private' ELSE 'scouts_only' END;
  END IF;
END $$;

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

  IF _visibility = 'scouts_only' THEN
    RETURN public.has_role(auth.uid(), 'scout'::app_role) OR public.has_role(auth.uid(), 'agent'::app_role);
  END IF;

  -- 'private': only approved (accepted) followers can view
  RETURN EXISTS (
    SELECT 1 FROM public.follows
    WHERE follower_id = auth.uid() AND following_id = _profile_user_id AND status = 'accepted'
  );
END;
$$;

-- player_profiles: replace open anon/authenticated read with the visibility check.
-- (No legitimate anon-facing flow reads player_profiles directly — the
-- external-recommendation pages resolve player info server-side via a
-- service-role edge function, which bypasses RLS entirely.)
DROP POLICY IF EXISTS "Authenticated can read player profiles" ON public.player_profiles;
DROP POLICY IF EXISTS "Anon can read player profiles" ON public.player_profiles;
DROP POLICY IF EXISTS "Player profiles respect account visibility" ON public.player_profiles;
CREATE POLICY "Player profiles respect account visibility"
  ON public.player_profiles FOR SELECT
  USING (public.can_view_profile(user_id));

-- posts: a post's visibility follows its author's account_visibility setting,
-- for any role (players and scouts alike).
DROP POLICY IF EXISTS "Anyone authenticated can view posts" ON public.posts;
DROP POLICY IF EXISTS "Posts respect author account visibility" ON public.posts;
CREATE POLICY "Posts respect author account visibility"
  ON public.posts FOR SELECT TO authenticated
  USING (public.can_view_profile(user_id));
