-- "Dezactivează comentariile" (PostCard.tsx's handleToggleComments) always
-- wrote UPDATE posts SET comments_disabled = ... regardless of which table
-- the displayed post actually came from. For a Descoperitor's own post
-- (scout_posts, never public.posts), that UPDATE matched zero rows — no
-- error, so the UI's local state flipped to "disabled" while the database
-- never actually recorded it. scout_posts also never had a
-- comments_disabled column at all, so even a correctly-targeted write
-- would have failed.
--
-- 20260806170000_post_comments_disabled.sql originally scoped this
-- feature to public.posts only, deliberately, because at the time
-- scout-sourced posts weren't part of the unified feed this toggle needed
-- to cover. Since then (this session), scout_posts rows render through
-- the same <PostCard> as posts rows across PersonalProfile/ActivitySection/
-- SavedSection/ArchiveSection, so the gap is now user-visible for the
-- cauta_jucator role. This extends the feature to scout_posts, mirroring
-- every check that already exists for public.posts.
ALTER TABLE public.scout_posts ADD COLUMN IF NOT EXISTS comments_disabled boolean NOT NULL DEFAULT false;

-- can_comment_on_post() only ever looked at public.posts. Extend it to
-- also resolve scout_posts rows, keeping the exact same visibility logic
-- (posts_comments_visibility) for both sources.
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

-- The SELECT/INSERT policies on post_comments only checked
-- public.posts.comments_disabled directly (can_comment_on_post already
-- covers INSERT's own gate correctly via the function above, but the
-- SELECT policy re-implements the same disabled-check inline against
-- public.posts only, so it needs its own scout_posts branch too).
DROP POLICY IF EXISTS "View comments respecting blocks, restrictions, visibility and disabled" ON public.post_comments;
CREATE POLICY "View comments respecting blocks, restrictions, visibility and disabled"
  ON public.post_comments FOR SELECT TO authenticated
  USING (
    (
      EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_comments.post_id AND public.can_view_profile(p.user_id))
      OR EXISTS (SELECT 1 FROM public.scout_posts sp WHERE sp.id = post_comments.post_id AND public.can_view_profile(sp.user_id))
    )
    AND (
      NOT EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_comments.post_id AND p.comments_disabled)
      AND NOT EXISTS (SELECT 1 FROM public.scout_posts sp WHERE sp.id = post_comments.post_id AND sp.comments_disabled)
      OR auth.uid() = (SELECT user_id FROM public.posts WHERE id = post_comments.post_id)
      OR auth.uid() = (SELECT user_id FROM public.scout_posts WHERE id = post_comments.post_id)
    )
    AND (
      user_id = auth.uid()
      OR (
        NOT EXISTS (
          SELECT 1 FROM public.posts p
          JOIN public.blocked_commenters bc ON bc.blocker_id = p.user_id AND bc.blocked_id = post_comments.user_id
          WHERE p.id = post_comments.post_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.scout_posts sp
          JOIN public.blocked_commenters bc ON bc.blocker_id = sp.user_id AND bc.blocked_id = post_comments.user_id
          WHERE sp.id = post_comments.post_id
        )
        AND (
          NOT EXISTS (
            SELECT 1 FROM public.posts p
            JOIN public.restricted_accounts ra ON ra.restrictor_id = p.user_id AND ra.restricted_id = post_comments.user_id
            WHERE p.id = post_comments.post_id
          )
          OR auth.uid() = (SELECT user_id FROM public.posts WHERE id = post_comments.post_id)
          OR auth.uid() = (SELECT user_id FROM public.scout_posts WHERE id = post_comments.post_id)
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can create comments" ON public.post_comments;
DROP POLICY IF EXISTS "Users can create comments respecting owner visibility" ON public.post_comments;
CREATE POLICY "Users can create comments respecting owner visibility"
  ON public.post_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_comment_on_post(post_id));
