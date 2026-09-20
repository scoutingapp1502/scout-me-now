-- A Descoperitor (cauta_jucator) account's own posts (scout_posts) never
-- went through any of what "posts" (player posts) already have: no video
-- upload, no automated moderation, no re-check on edit, no admin
-- moderation queue, no user-report resolution, no rejection counter/notice.
-- Explicit product decision: scout_posts should behave exactly like posts,
-- content-rules-wise. This brings scout_posts up to parity by adding the
-- same columns and reusing the same RPCs/policies pattern, rather than
-- unifying the two tables outright (recommended, lower risk — see prior
-- migrations' comments on why scout_posts stayed separate from posts).

ALTER TABLE public.scout_posts
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending', 'approved', 'flagged', 'rejected'));

-- Existing rows predate moderation entirely — grandfathered in as approved,
-- same treatment posts got in 20260927090000_video_moderation_schema.sql.
UPDATE public.scout_posts SET moderation_status = 'approved' WHERE moderation_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_scout_posts_moderation_status ON public.scout_posts (moderation_status) WHERE moderation_status <> 'approved';

-- Same visibility rule posts already has: approved + visible-per-account-
-- settings, OR your own (any status), OR admin. Replaces the plain
-- deleted_at/can_view_profile check from 20260724160000, which had no
-- moderation awareness at all — a Descoperitor's own flagged/pending post
-- was fully visible to everyone the moment it existed.
DROP POLICY IF EXISTS "Scout posts respect author account visibility" ON public.scout_posts;
CREATE POLICY "Scout posts respect account visibility and moderation"
  ON public.scout_posts FOR SELECT TO authenticated
  USING (
    (deleted_at IS NULL AND moderation_status = 'approved' AND public.can_view_profile(user_id))
    OR auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- get_activity_feed's scout_posts branch never filtered by moderation_status
-- at all (there was no such column to filter on) — every Descoperitor post
-- went straight into followers' feeds unmoderated, video_url was hardcoded
-- NULL since scout_posts had no such column either. Both fixed here; the
-- posts branch is unchanged from 20260928090000.
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
    SELECT sp.id, sp.user_id, sp.content, sp.image_url, sp.video_url, 'scout'::text AS post_type, sp.created_at, sp.comments_disabled
    FROM public.scout_posts sp
    JOIN followed f ON f.user_id = sp.user_id
    WHERE sp.deleted_at IS NULL AND sp.is_archived = false
      AND sp.user_id <> p_user_id
      AND sp.created_at >= f.followed_since
      AND sp.moderation_status = 'approved'
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

-- content_moderation_results/analyze-video-frames/recheck-video-content use
-- a new content_type "scout_post" (parallel to "post") rather than reusing
-- "post" for a scout_posts row — content_id alone can't disambiguate which
-- table a row belongs to, and every existing content_type value already
-- maps 1:1 to exactly one table.
ALTER TABLE public.content_moderation_results DROP CONSTRAINT IF EXISTS content_moderation_results_content_type_check;
ALTER TABLE public.content_moderation_results
  ADD CONSTRAINT content_moderation_results_content_type_check
  CHECK (content_type IN ('post', 'scout_post', 'test_video', 'avatar', 'video_highlight'));

-- increment_rejected_posts_count previously only ever touched
-- player_profiles — a rejected scout_posts row silently never counted
-- toward that Descoperitor's risk of being blocked. scout_profiles already
-- has rejected_posts_count (see 20261007090000_users_at_risk_scouts.sql),
-- it just was never written to from here. Exactly one of the two UPDATEs
-- below ever matches a given user_id's actual profile table, same
-- belt-and-suspenders pattern set_user_warned already uses.
CREATE OR REPLACE FUNCTION public.increment_rejected_posts_count(p_user_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.player_profiles SET rejected_posts_count = rejected_posts_count + 1 WHERE user_id = p_user_id;
  UPDATE public.scout_profiles SET rejected_posts_count = rejected_posts_count + 1 WHERE user_id = p_user_id;
$$;

-- Same fix for the author's own "pending/rejected count" self-view — was
-- player_profiles/posts only.
CREATE OR REPLACE FUNCTION public.get_my_moderation_counts()
RETURNS TABLE (pending_count bigint, rejected_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.posts WHERE user_id = auth.uid() AND moderation_status IN ('pending', 'flagged'))
    + (SELECT count(*) FROM public.scout_posts WHERE user_id = auth.uid() AND moderation_status IN ('pending', 'flagged')),
    (SELECT COALESCE(rejected_posts_count, 0) FROM public.player_profiles WHERE user_id = auth.uid())
    + (SELECT COALESCE(rejected_posts_count, 0) FROM public.scout_profiles WHERE user_id = auth.uid());
$$;

-- user_content_reports.content_type stays "post" for a reported scout_posts
-- row (PostCard.handleReportPost already sends "post" regardless of which
-- table the post lives in) — admin resolution below is what needs to learn
-- to also look in scout_posts, not the report table's shape.
