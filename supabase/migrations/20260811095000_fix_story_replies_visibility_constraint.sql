-- story_replies_visibility has the exact same bug that
-- 20260608174000_message_requests_settings.sql already fixed for
-- message_requests_visibility, but that earlier fix only touched the
-- sibling column — story_replies_visibility was never corrected.
--
-- The original 20260608173000_messages_replies_settings.sql CHECK
-- constraint only allows 'everyone' | 'following' | 'no_one', but
-- MessagesRepliesSection.tsx's StoryRepliesPage sends the literal
-- "followers" (RadioRow value="followers") for the "only people I follow"
-- option — "followers" is not a valid value under this constraint, so
-- saving that choice always fails with a CHECK violation (the same class
-- of bug fixed for account_visibility earlier in this session).
--
-- can_reply_to_story() (20260724110000_tighten_privacy_settings_select.sql)
-- also explicitly compares against the literal 'following', so even a row
-- that predates this fix and still holds the old 'following' value needs
-- to be normalized for that function to keep working correctly.
alter table public.user_privacy_settings
  drop constraint if exists user_privacy_settings_story_replies_visibility_check;

update public.user_privacy_settings
  set story_replies_visibility = 'followers'
  where story_replies_visibility = 'following';

alter table public.user_privacy_settings
  add constraint user_privacy_settings_story_replies_visibility_check
  check (story_replies_visibility in ('everyone', 'followers', 'no_one'));

-- can_reply_to_story() must now compare against 'followers', matching the
-- normalized column values above.
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
