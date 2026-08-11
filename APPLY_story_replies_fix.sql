-- Run this in Supabase SQL Editor to apply the "Mesaje și răspunsuri" fix.
-- Fixes: story_replies_visibility's CHECK constraint only allowed
-- 'everyone' | 'following' | 'no_one', but the UI (StoryRepliesPage in
-- MessagesRepliesSection.tsx) sends "followers" for the "only people I
-- follow" option — saving that choice always failed with a constraint
-- violation. The sibling column (message_requests_visibility) already had
-- this exact bug fixed in an earlier migration; story_replies_visibility
-- was missed. Pre-existing gap, affects both roles equally.

-- ===== 20260811095000_fix_story_replies_visibility_constraint.sql =====
alter table public.user_privacy_settings
  drop constraint if exists user_privacy_settings_story_replies_visibility_check;

update public.user_privacy_settings
  set story_replies_visibility = 'followers'
  where story_replies_visibility = 'following';

alter table public.user_privacy_settings
  add constraint user_privacy_settings_story_replies_visibility_check
  check (story_replies_visibility in ('everyone', 'followers', 'no_one'));

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
  IF _visibility = 'followers' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = _story_owner_id AND following_id = auth.uid() AND status = 'accepted'
    );
  END IF;
  RETURN true; -- 'everyone'
END;
$$;
