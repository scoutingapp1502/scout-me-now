-- Run this in Supabase SQL Editor to apply the "Comentarii" cross-role fix.
-- Fixes: "Dezactivează comentariile" on a Descoperitor's own post (stored
-- in scout_posts, not posts) silently did nothing server-side — the UPDATE
-- always targeted public.posts, scout_posts had no comments_disabled
-- column at all, and can_comment_on_post()/post_comments RLS never
-- resolved scout_posts rows either.

-- ===== 20260811096000_scout_posts_comments_disabled.sql =====
ALTER TABLE public.scout_posts ADD COLUMN IF NOT EXISTS comments_disabled boolean NOT NULL DEFAULT false;

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
