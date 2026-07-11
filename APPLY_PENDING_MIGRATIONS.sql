-- ===== 20260711120000_fix_user_roles_privilege_escalation.sql =====
-- Security fix: the original INSERT policy on user_roles only checked
-- auth.uid() = user_id, without restricting which role value could be
-- inserted. Since user_metadata (and therefore the client-driven
-- ensureRoleAndProfile flow) is fully controlled by the requesting user,
-- any authenticated user could insert a row granting themselves the
-- 'admin' role, which is trusted by has_role()/get_user_role() and by
-- every admin-gated RLS policy in the app.
DROP POLICY IF EXISTS "System inserts roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can self-assign non-privileged role" ON public.user_roles;

CREATE POLICY "Users can self-assign non-privileged role"
  ON public.user_roles
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND role <> 'admin'::app_role
  );

-- ===== 20260711120100_fix_scout_verification_admin_policies.sql =====
-- scout_verification_requests only had a SELECT policy scoped to the
-- requesting user's own row. Admins had no SELECT or UPDATE policy at all,
-- so the AdminScoutVerification review screen could not see pending
-- requests from other users, and approve/reject actions silently failed
-- under RLS (0 rows affected, no error surfaced by supabase-js).
DROP POLICY IF EXISTS "admin_select_all" ON public.scout_verification_requests;
DROP POLICY IF EXISTS "admin_update_all" ON public.scout_verification_requests;

CREATE POLICY "admin_select_all" ON public.scout_verification_requests
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "admin_update_all" ON public.scout_verification_requests
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ===== 20260711120200_add_missing_hot_path_indexes.sql =====
-- These tables are queried heavily by the app (see follows/posts/post_comments/
-- stories/group_messages/group_members usage in src/) but only had a primary
-- key and, for follows, a composite UNIQUE(follower_id, following_id) — which
-- does not serve lookups filtered on following_id alone. Add the indexes that
-- match the app's actual access patterns.

-- "who follows me" / notification lookups filter on following_id alone
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows (following_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON public.follows (follower_id);

-- feed/profile queries filter posts by user_id
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts (user_id);

-- comment counts/lists filter by post_id, comment ownership checks by user_id
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments (post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON public.post_comments (user_id);

-- story rings/archive filter by user_id, and the "active stories" RLS policy
-- and app queries both filter on expires_at
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON public.stories (user_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON public.stories (expires_at);

-- group chat inbox/thread queries filter by group_id
CREATE INDEX IF NOT EXISTS idx_group_messages_group_id ON public.group_messages (group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members (group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members (user_id);

-- ===== 20260711120300_add_profiles_fulltext_search_index.sql =====
-- RecommendationsSection searches profiles with .ilike("full_name", `%term%`).
-- A leading-wildcard ILIKE cannot use a regular btree index and forces a
-- sequential scan; pg_trgm's GIN index supports it.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_profiles_full_name_trgm
  ON public.profiles USING gin (full_name gin_trgm_ops);

-- ===== 20260711120400_conversation_group_preview_rpcs.sql =====
-- MessagesSection.tsx previously fetched the last message + unread count for
-- each conversation (and last message for each group) with a sequential
-- await inside a for-loop — 2 round trips per conversation and 3+ per group.
-- These RPCs return one row per conversation/group in a single query.

CREATE OR REPLACE FUNCTION public.get_conversation_previews(p_conversation_ids uuid[], p_user_id uuid)
RETURNS TABLE (
  conversation_id uuid,
  last_content text,
  last_created_at timestamptz,
  last_sender_id uuid,
  last_read boolean,
  unread_count bigint
)
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT
    ids.conversation_id,
    lm.content,
    lm.created_at,
    lm.sender_id,
    lm.read,
    COALESCE(uc.unread_count, 0)
  FROM unnest(p_conversation_ids) AS ids(conversation_id)
  LEFT JOIN LATERAL (
    SELECT content, created_at, sender_id, read
    FROM public.messages
    WHERE conversation_id = ids.conversation_id
    ORDER BY created_at DESC
    LIMIT 1
  ) lm ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS unread_count
    FROM public.messages
    WHERE conversation_id = ids.conversation_id AND read = false AND sender_id <> p_user_id
  ) uc ON true;
$$;

CREATE OR REPLACE FUNCTION public.get_group_message_previews(p_group_ids uuid[])
RETURNS TABLE (
  group_id uuid,
  content text,
  created_at timestamptz
)
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT ids.group_id, lm.content, lm.created_at
  FROM unnest(p_group_ids) AS ids(group_id)
  LEFT JOIN LATERAL (
    SELECT content, created_at
    FROM public.group_messages
    WHERE group_id = ids.group_id
    ORDER BY created_at DESC
    LIMIT 1
  ) lm ON true;
$$;

-- ===== 20260711120500_replica_identity_for_filtered_realtime.sql =====
-- The realtime subscriptions on follows, agent_collaboration_requests and
-- recommendations now filter on non-primary-key columns (e.g.
-- following_id=eq.<uid>) and listen for DELETE among other events. Under
-- the default REPLICA IDENTITY, a DELETE's "old row" payload only contains
-- the primary key, so Postgres changes filtered on any other column would
-- silently never match a DELETE. REPLICA IDENTITY FULL includes the whole
-- old row so filtered DELETE events are delivered correctly.
ALTER TABLE public.follows REPLICA IDENTITY FULL;
ALTER TABLE public.agent_collaboration_requests REPLICA IDENTITY FULL;
ALTER TABLE public.recommendations REPLICA IDENTITY FULL;

-- ===== 20260711120600_batched_post_engagement_rpc.sql =====
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

-- ===== 20260712090000_post_engagement_replica_identity.sql =====
-- PostCard now subscribes to post_likes/post_comments filtered by
-- post_id=eq.<id> so a post's like/comment counts update live for anyone
-- viewing it. Filtering on a DELETE event requires the old row's post_id
-- (and user_id, used to avoid double-counting the acting user's own
-- optimistic update) to be present, which needs REPLICA IDENTITY FULL.
ALTER TABLE public.post_likes REPLICA IDENTITY FULL;
ALTER TABLE public.post_comments REPLICA IDENTITY FULL;

-- ===== 20260712100000_story_likes_and_replies.sql =====
-- Stories had a "like" heart button that only toggled local component state
-- (StoryViewer.tsx) and a "reply" input that only showed a fake success
-- toast — neither ever wrote to the database, so there was nothing for a
-- notification to observe. This table gives story likes real persistence
-- (story replies reuse the existing messages/conversations tables).
CREATE TABLE IF NOT EXISTS public.story_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, user_id)
);

ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view story likes" ON public.story_likes;
DROP POLICY IF EXISTS "Users can like stories" ON public.story_likes;
DROP POLICY IF EXISTS "Users can unlike stories" ON public.story_likes;

CREATE POLICY "Anyone authenticated can view story likes"
  ON public.story_likes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can like stories"
  ON public.story_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike stories"
  ON public.story_likes FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_story_likes_story_id ON public.story_likes (story_id);
CREATE INDEX IF NOT EXISTS idx_story_likes_user_id ON public.story_likes (user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'story_likes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.story_likes;
  END IF;
END $$;

