-- user_privacy_settings has had "select using (true)" since its very first
-- migration (20260608170000), back when the table had a single column
-- (feed_activity_visibility). Every subsequent ALTER TABLE ... ADD COLUMN
-- (account_visibility, message_requests_visibility, auto_confirm_followers,
-- invitation_code, story_replies_visibility, story_shares_enabled, etc.)
-- inherited that same open policy, so any authenticated user can currently
-- read any other user's ENTIRE privacy-settings row directly, including
-- their personal invitation code.
--
-- This tightens SELECT to owner-only, and adds narrow SECURITY DEFINER RPCs
-- for the handful of legitimate cross-user reads that were relying on the
-- open policy (StoryViewer's "who can reply to my story" check and
-- StoryShareSheet's "does this user allow story shares" check) — both were
-- previously enforced ONLY client-side (a modified/direct API client could
-- ignore the check entirely); they're now backed server-side too.

DROP POLICY IF EXISTS "privacy_settings_select_all" ON public.user_privacy_settings;
DROP POLICY IF EXISTS "privacy_settings_select_own" ON public.user_privacy_settings;
CREATE POLICY "privacy_settings_select_own"
  ON public.user_privacy_settings FOR SELECT
  USING (auth.uid() = user_id);

-- Real, server-enforced "can I reply to this user's story" check.
CREATE OR REPLACE FUNCTION public.can_reply_to_story(_story_owner_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _visibility text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() = _story_owner_id THEN RETURN true; END IF;

  SELECT story_replies_visibility INTO _visibility
  FROM public.user_privacy_settings WHERE user_id = _story_owner_id;
  _visibility := COALESCE(_visibility, 'everyone');

  IF _visibility = 'no_one' THEN RETURN false; END IF;
  IF _visibility = 'following' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = _story_owner_id AND following_id = auth.uid() AND status = 'accepted'
    );
  END IF;
  RETURN true; -- 'everyone'
END;
$$;

-- Real, server-readable "does this user allow their stories to be shared"
-- check (single-column, narrow — doesn't leak the rest of the row).
CREATE OR REPLACE FUNCTION public.get_story_shares_enabled(_story_owner_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT story_shares_enabled FROM public.user_privacy_settings WHERE user_id = _story_owner_id),
    true
  );
$$;
