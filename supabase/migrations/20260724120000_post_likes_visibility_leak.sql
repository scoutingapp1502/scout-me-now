-- posts/player_profiles SELECT were tightened in 20260713090000 to respect
-- account_visibility (private/scouts_only) via can_view_profile(), but
-- post_likes was never updated from its original "Anyone authenticated can
-- view likes" policy, and get_post_engagement_summary (a SECURITY DEFINER
-- RPC, so it bypasses RLS entirely) never checked the post author's
-- visibility either. Net effect: a viewer who is correctly blocked from
-- seeing a private/scouts_only player's posts row could still read that
-- post's like count, who-liked-it, and comment count/text directly if they
-- already knew or could guess the post_id (e.g. from a shared link or a
-- notification that leaked it before the post's owner tightened privacy).
DROP POLICY IF EXISTS "Anyone authenticated can view likes" ON public.post_likes;
DROP POLICY IF EXISTS "Post likes respect author account visibility" ON public.post_likes;
CREATE POLICY "Post likes respect author account visibility"
  ON public.post_likes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_likes.post_id AND public.can_view_profile(p.user_id)
    )
  );

-- post_comments already had block/restriction shadow-visibility
-- (20260713092000) but never checked the post author's account_visibility,
-- so the same leak applied to comment content/authorship for
-- private/scouts_only players.
DROP POLICY IF EXISTS "View comments respecting blocks and restrictions" ON public.post_comments;
DROP POLICY IF EXISTS "View comments respecting blocks, restrictions and visibility" ON public.post_comments;
CREATE POLICY "View comments respecting blocks, restrictions and visibility"
  ON public.post_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p WHERE p.id = post_comments.post_id AND public.can_view_profile(p.user_id)
    )
    AND (
      user_id = auth.uid()
      OR (
        NOT EXISTS (
          SELECT 1 FROM public.posts p
          JOIN public.blocked_commenters bc ON bc.blocker_id = p.user_id AND bc.blocked_id = post_comments.user_id
          WHERE p.id = post_comments.post_id
        )
        AND (
          NOT EXISTS (
            SELECT 1 FROM public.posts p
            JOIN public.restricted_accounts ra ON ra.restrictor_id = p.user_id AND ra.restricted_id = post_comments.user_id
            WHERE p.id = post_comments.post_id
          )
          OR auth.uid() = (SELECT user_id FROM public.posts WHERE id = post_comments.post_id)
        )
      )
    )
  );

-- Defensive: drop first regardless of which prior shape is live, since
-- CREATE OR REPLACE cannot change OUT-parameter shape.
DROP FUNCTION IF EXISTS public.get_post_engagement_summary(uuid[], uuid);
CREATE OR REPLACE FUNCTION public.get_post_engagement_summary(p_post_ids uuid[], p_viewer_id uuid)
RETURNS TABLE (
  post_id uuid,
  likes_count integer,
  liked_by_me boolean,
  comments_count integer,
  hide_unwanted_comments text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    ids.post_id,
    COALESCE(lc.likes_count, 0)::integer,
    COALESCE(ml.liked, false),
    COALESCE(cc.comments_count, 0)::integer,
    COALESCE(ups.hide_unwanted_comments, 'some')
  FROM unnest(p_post_ids) AS ids(post_id)
  LEFT JOIN public.posts p ON p.id = ids.post_id
  LEFT JOIN public.user_privacy_settings ups ON ups.user_id = p.user_id
  LEFT JOIN LATERAL (
    SELECT count(*)::integer AS likes_count
    FROM public.post_likes pl
    LEFT JOIN public.user_privacy_settings vups ON vups.user_id = pl.user_id
    WHERE pl.post_id = ids.post_id
      AND (
        pl.user_id = p_viewer_id
        OR COALESCE(vups.feed_activity_visibility, 'followers') <> 'no_one'
      )
  ) lc ON true
  LEFT JOIN LATERAL (
    SELECT true AS liked
    FROM public.post_likes
    WHERE post_id = ids.post_id AND user_id = p_viewer_id
    LIMIT 1
  ) ml ON true
  LEFT JOIN LATERAL (
    SELECT count(*)::integer AS comments_count
    FROM public.post_comments
    WHERE post_id = ids.post_id
  ) cc ON true
  WHERE p.id IS NULL OR public.can_view_profile(p.user_id);
$$;
