-- Two related story-viewer gaps:
--
-- 1) reply_to_story() sent replies as a plain text message with no
--    structural link back to the story being replied to — same problem
--    share_story_to_conversation() had before shared_story_id/
--    shared_story_owner_name were added in 20260914090000. A reply should
--    show the story as a reference card above the reply text in the DM,
--    exactly like a share does, so it's extended the same way.
--
-- 2) Like counts/who-liked were never exposed anywhere — StoryViewer only
--    showed a binary "did I like this" heart. The story owner specifically
--    needs to see how many people liked their story and who, but this must
--    stay owner-only (not visible to other viewers of the same story) —
--    enforced server-side, not just by hiding UI client-side.

DROP FUNCTION IF EXISTS public.reply_to_story(uuid, text);

CREATE OR REPLACE FUNCTION public.reply_to_story(
  _story_id uuid,
  _story_owner_id uuid,
  _content text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _conv_id uuid;
  _owner_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.can_reply_to_story(_story_owner_id) THEN
    RAISE EXCEPTION 'Cannot reply to this story';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.stories WHERE id = _story_id AND user_id = _story_owner_id AND expires_at > now()) THEN
    RAISE EXCEPTION 'This story is no longer available';
  END IF;

  SELECT COALESCE(p.first_name || ' ' || p.last_name, s.first_name || ' ' || s.last_name, 'User')
  INTO _owner_name
  FROM (SELECT 1) dummy
  LEFT JOIN public.player_profiles p ON p.user_id = _story_owner_id
  LEFT JOIN public.scout_profiles s ON s.user_id = _story_owner_id;

  -- get_or_create_conversation() enforces can_message_user() internally.
  _conv_id := public.get_or_create_conversation(_story_owner_id);

  INSERT INTO public.messages (conversation_id, sender_id, content, shared_story_id, shared_story_owner_name)
  VALUES (_conv_id, auth.uid(), _content, _story_id, _owner_name);

  UPDATE public.conversations SET updated_at = now() WHERE id = _conv_id;

  RETURN _conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reply_to_story(uuid, uuid, text) TO authenticated;

-- Owner-only like count + liker list for one story. Returns empty/zero for
-- anyone who isn't the story's owner, rather than erroring — StoryViewer
-- can call this unconditionally per story and simply not render the count
-- UI when it comes back empty, without needing a separate "am I the owner"
-- check first.
CREATE OR REPLACE FUNCTION public.get_story_like_details(_story_id uuid)
RETURNS TABLE (
  liker_user_id uuid,
  liker_name text,
  liker_photo text,
  liked_at timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    sl.user_id,
    COALESCE(p.first_name || ' ' || p.last_name, s.first_name || ' ' || s.last_name, 'User'),
    COALESCE(p.photo_url, s.photo_url),
    sl.created_at
  FROM public.story_likes sl
  JOIN public.stories st ON st.id = sl.story_id
  LEFT JOIN public.player_profiles p ON p.user_id = sl.user_id
  LEFT JOIN public.scout_profiles s ON s.user_id = sl.user_id
  WHERE sl.story_id = _story_id
    AND st.user_id = auth.uid()
  ORDER BY sl.created_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.get_story_like_details(uuid) TO authenticated;
