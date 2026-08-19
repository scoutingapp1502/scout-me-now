-- "Activitate în feed" — "Urmăritorii pe care îi urmărești înapoi" (value
-- 'followers') was never actually enforced as a real mutual-follow check.
-- The post_likes SELECT policy only special-cased 'no_one'; any other
-- value (including 'followers') fell through to "visible to everyone" —
-- so choosing "followers" behaved identically to having the setting off.
-- Per the user's explicit request: mirror the same mutual-follow logic
-- already used by "Confidențialitate cont" (scouts_and_mutual) — the
-- liker's like is visible to a given viewer only if the viewer follows
-- the liker back AND the liker follows the viewer, both 'accepted'.
-- Also mirror the same mutual-follow logic into the aggregate like
-- counter (get_post_engagement_summary), so the number shown under a post
-- stays consistent with who actually shows up in the "who liked this"
-- list above.
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
        OR (
          CASE COALESCE(vups.feed_activity_visibility, 'followers')
          WHEN 'no_one' THEN false
          WHEN 'followers' THEN EXISTS (
            SELECT 1 FROM public.follows
            WHERE follower_id = p_viewer_id AND following_id = pl.user_id AND status = 'accepted'
          ) AND EXISTS (
            SELECT 1 FROM public.follows
            WHERE follower_id = pl.user_id AND following_id = p_viewer_id AND status = 'accepted'
          )
          ELSE true
          END
        )
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

DROP POLICY IF EXISTS "Post likes respect author account visibility" ON public.post_likes;
CREATE POLICY "Post likes respect author account visibility"
  ON public.post_likes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p
      WHERE p.id = post_likes.post_id AND public.can_view_profile(p.user_id)
    )
    AND (
      post_likes.user_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_likes.post_id AND p.user_id = auth.uid())
      OR (
        CASE COALESCE(
          (SELECT feed_activity_visibility FROM public.user_privacy_settings WHERE user_id = post_likes.user_id),
          'followers'
        )
        WHEN 'no_one' THEN false
        WHEN 'followers' THEN EXISTS (
          SELECT 1 FROM public.follows
          WHERE follower_id = auth.uid() AND following_id = post_likes.user_id AND status = 'accepted'
        ) AND EXISTS (
          SELECT 1 FROM public.follows
          WHERE follower_id = post_likes.user_id AND following_id = auth.uid() AND status = 'accepted'
        )
        ELSE true
        END
      )
    )
  );
