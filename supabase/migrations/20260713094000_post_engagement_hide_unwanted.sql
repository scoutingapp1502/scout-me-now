-- Add the post author's hide_unwanted_comments level to the existing
-- batched engagement RPC, so PostCard can apply the "hide unwanted
-- comments" heuristic without a new per-card query.
--
-- Postgres won't let CREATE OR REPLACE change a function's OUT-parameter
-- shape (adding a column here), so drop the old 4-column version first.
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
  ) cc ON true;
$$;
