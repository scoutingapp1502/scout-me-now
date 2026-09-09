-- ActivitySection.fetchPosts() re-downloads the viewer's ENTIRE eligible
-- feed on every mount/refresh/realtime-insert (up to 50 posts + 50 scout_posts
-- + 20 sportrise_posts, plus every author's profile), does the
-- followed-since-accept filtering, own-post exclusion, and
-- favourites-first-then-newest sorting entirely in JS, then throws most of
-- it away by slicing to 50. That doesn't scale as follow graphs grow, and it
-- can't support real infinite scroll (loading the "next" 20 would require
-- re-fetching and re-sorting everything from scratch).
--
-- This moves the visibility rules (followed-since-accept, exclude own posts)
-- and the favourites-first/newest-first ordering into SQL, with real
-- LIMIT/OFFSET pagination over posts+scout_posts combined. sportrise_posts
-- stays a separate small fixed fetch (already capped at 20, always pinned to
-- the top of page 0) — folding it into the same paginated query would mean
-- re-deriving "am I on page 0" logic for no real benefit, since official
-- posts are rare compared to the follow-graph-driven volume.

CREATE INDEX IF NOT EXISTS idx_posts_user_id_created_at ON public.posts (user_id, created_at DESC) WHERE deleted_at IS NULL AND is_archived = false;
CREATE INDEX IF NOT EXISTS idx_scout_posts_user_id_created_at ON public.scout_posts (user_id, created_at DESC) WHERE deleted_at IS NULL AND is_archived = false;
CREATE INDEX IF NOT EXISTS idx_follows_follower_status ON public.follows (follower_id, status);

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

GRANT EXECUTE ON FUNCTION public.get_activity_feed(uuid, integer, integer) TO authenticated;
