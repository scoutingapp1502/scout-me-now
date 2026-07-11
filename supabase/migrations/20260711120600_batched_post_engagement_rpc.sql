-- Each rendered PostCard used to call get_visible_likes_count, then query
-- post_likes and post_comments separately — 3 round trips per post, so a
-- 20-post feed fired 40-60 requests. This batched version takes an array of
-- post ids and returns likes/comments counts + the viewer's own like state
-- for all of them in a single call.
CREATE OR REPLACE FUNCTION public.get_post_engagement_summary(p_post_ids uuid[], p_viewer_id uuid)
RETURNS TABLE (
  post_id uuid,
  likes_count integer,
  liked_by_me boolean,
  comments_count integer
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    ids.post_id,
    COALESCE(lc.likes_count, 0)::integer,
    COALESCE(ml.liked, false),
    COALESCE(cc.comments_count, 0)::integer
  FROM unnest(p_post_ids) AS ids(post_id)
  LEFT JOIN LATERAL (
    SELECT count(*)::integer AS likes_count
    FROM public.post_likes pl
    LEFT JOIN public.user_privacy_settings ups ON ups.user_id = pl.user_id
    WHERE pl.post_id = ids.post_id
      AND (
        pl.user_id = p_viewer_id
        OR COALESCE(ups.feed_activity_visibility, 'followers') <> 'no_one'
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
