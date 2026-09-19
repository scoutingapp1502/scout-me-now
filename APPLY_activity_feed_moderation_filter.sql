-- get_activity_feed() is SECURITY DEFINER, so it runs with the function
-- owner's privileges and bypasses RLS entirely — it does its own SELECT
-- straight against public.posts, not through the RLS-protected view. That
-- means the "Posts respect account visibility and moderation" RLS policy
-- added in 20260927090000_video_moderation_schema.sql (moderation_status =
-- 'approved' OR own post OR admin) never applied to the feed at all: a
-- pending/flagged/rejected video from someone you follow could appear in
-- your Activity feed, defeating the whole point of pre-moderation.
--
-- This does not touch RLS (already correct, per the caller's request to
-- verify before changing it) — it adds the same rule directly into the feed
-- query's WHERE clause, since a SECURITY DEFINER function must enforce its
-- own visibility rules explicitly rather than relying on RLS to do it.
--
-- Own posts are already excluded by `p.user_id <> p_user_id` further down
-- (unrelated to moderation — the Activity feed never shows your own posts,
-- full stop, moderation status aside), so this only ever affects other
-- people's posts.
CREATE OR REPLACE FUNCTION public.get_activity_feed(
  p_user_id uuid,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  content text,
  image_url text,
  video_url text,
  post_type text,
  created_at timestamptz,
  comments_disabled boolean,
  author_name text,
  author_photo text,
  author_role text,
  author_title text,
  is_favourite boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH followed AS (
    SELECT following_id AS user_id, COALESCE(responded_at, created_at) AS followed_since
    FROM public.follows
    WHERE follower_id = p_user_id AND status = 'accepted'
  ),
  favourites AS (
    SELECT favourite_user_id AS user_id FROM public.user_favourites WHERE user_id = p_user_id
  ),
  raw_posts AS (
    SELECT p.id, p.user_id, p.content, p.image_url, p.video_url, p.post_type, p.created_at, p.comments_disabled
    FROM public.posts p
    JOIN followed f ON f.user_id = p.user_id
    WHERE p.deleted_at IS NULL AND p.is_archived = false
      AND p.user_id <> p_user_id
      AND p.created_at >= f.followed_since
      AND p.moderation_status = 'approved'
    UNION ALL
    SELECT sp.id, sp.user_id, sp.content, sp.image_url, NULL::text AS video_url, 'scout'::text AS post_type, sp.created_at, sp.comments_disabled
    FROM public.scout_posts sp
    JOIN followed f ON f.user_id = sp.user_id
    WHERE sp.deleted_at IS NULL AND sp.is_archived = false
      AND sp.user_id <> p_user_id
      AND sp.created_at >= f.followed_since
  )
  SELECT
    rp.id, rp.user_id, rp.content, rp.image_url, rp.video_url, rp.post_type, rp.created_at, rp.comments_disabled,
    COALESCE(pp.first_name || ' ' || pp.last_name, sp2.first_name || ' ' || sp2.last_name, 'User') AS author_name,
    COALESCE(pp.photo_url, sp2.photo_url) AS author_photo,
    COALESCE(ur.role::text, 'player') AS author_role,
    COALESCE(
      NULLIF(concat_ws(' · ', pp.position, pp.current_team), ''),
      NULLIF(concat_ws(' | ', sp2.title, sp2.organization), ''),
      ''
    ) AS author_title,
    (fav.user_id IS NOT NULL) AS is_favourite
  FROM raw_posts rp
  LEFT JOIN public.player_profiles pp ON pp.user_id = rp.user_id
  LEFT JOIN public.scout_profiles sp2 ON sp2.user_id = rp.user_id
  LEFT JOIN public.user_roles ur ON ur.user_id = rp.user_id
  LEFT JOIN favourites fav ON fav.user_id = rp.user_id
  ORDER BY is_favourite DESC, rp.created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;
