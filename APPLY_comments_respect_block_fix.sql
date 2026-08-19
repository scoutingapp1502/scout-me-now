-- "Comentarii" → can_comment_on_post() never checked the general
-- profile-level block (is_blocked_between) — only posts_comments_visibility
-- and the post's own comments_disabled flag. A blocked person is already
-- kept from ever seeing the post through can_view_profile() (used by the
-- post_comments SELECT policy and by the client's own feed queries), so
-- this wasn't reachable through the normal UI — but a direct API call
-- (bypassing the client) could still insert a comment as a blocked user,
-- since the INSERT policy only calls can_comment_on_post(), which never
-- checked blocking. Same class of gap already closed for messaging,
-- story replies and group adds. Added here for consistency and defense in
-- depth.
CREATE OR REPLACE FUNCTION public.can_comment_on_post(_post_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _visibility text;
  _comments_disabled boolean;
BEGIN
  SELECT user_id, comments_disabled INTO _owner, _comments_disabled FROM public.posts WHERE id = _post_id;
  IF _owner IS NULL THEN
    SELECT user_id, comments_disabled INTO _owner, _comments_disabled FROM public.scout_posts WHERE id = _post_id;
  END IF;
  IF _owner IS NULL THEN RETURN false; END IF;
  IF _comments_disabled THEN RETURN false; END IF;
  IF _owner = auth.uid() THEN RETURN true; END IF;
  IF public.is_blocked_between(auth.uid(), _owner) THEN RETURN false; END IF;

  SELECT posts_comments_visibility INTO _visibility
  FROM public.user_privacy_settings WHERE user_id = _owner;
  _visibility := COALESCE(_visibility, 'everyone');

  IF _visibility = 'everyone' THEN RETURN true; END IF;
  IF _visibility = 'no_one' THEN RETURN false; END IF;

  IF _visibility = 'following' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = _owner AND following_id = auth.uid() AND status = 'accepted'
    );
  END IF;

  IF _visibility = 'followers' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = auth.uid() AND following_id = _owner AND status = 'accepted'
    );
  END IF;

  IF _visibility = 'following_and_followers' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.follows
      WHERE (follower_id = _owner AND following_id = auth.uid() AND status = 'accepted')
         OR (follower_id = auth.uid() AND following_id = _owner AND status = 'accepted')
    );
  END IF;

  RETURN true;
END;
$$;
