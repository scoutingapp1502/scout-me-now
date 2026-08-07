-- The previous migration (20260806170000) recreated a policy named
-- "Users can create comments", not realizing 20260713093000 had already
-- superseded it with "Users can create comments respecting owner
-- visibility" (gated by can_comment_on_post()). Since RLS policies for the
-- same command are OR'd, that older/more permissive policy would silently
-- bypass the new comments_disabled check. Drop the stray duplicate and
-- enforce comments_disabled inside can_comment_on_post() itself instead, so
-- there's a single source of truth for "can X comment on this post" —
-- including blocking the post's own owner, matching the toggle's intent
-- that nobody can add new comments while it's off.
DROP POLICY IF EXISTS "Users can create comments" ON public.post_comments;

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
  IF _owner IS NULL THEN RETURN false; END IF;
  IF _comments_disabled THEN RETURN false; END IF;
  IF _owner = auth.uid() THEN RETURN true; END IF;

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
