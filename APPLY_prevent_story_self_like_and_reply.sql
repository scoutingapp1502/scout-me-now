-- StoryViewer.tsx now hides the like button and reply input entirely when
-- viewing your own story (liking/replying to yourself doesn't make sense),
-- but that was UI-only — the RLS policy on story_likes never checked
-- story_id <> the liker's own story, and can_reply_to_story() explicitly
-- returned true for the owner. A modified client or direct API call could
-- still self-like or self-reply. Enforced server-side now, matching the UI.

DROP POLICY IF EXISTS "Users can like stories" ON public.story_likes;
CREATE POLICY "Users can like stories"
  ON public.story_likes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (SELECT 1 FROM public.stories s WHERE s.id = story_id AND s.user_id = auth.uid())
  );

CREATE OR REPLACE FUNCTION public.can_reply_to_story(_story_owner_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _visibility text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() = _story_owner_id THEN RETURN false; END IF;
  IF public.is_blocked_between(auth.uid(), _story_owner_id) THEN RETURN false; END IF;

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
