-- PART 1 of 2 — paste and RUN this first, then paste and run PART 2 separately.
-- (Postgres requires a new enum value like 'cauta_jucator' to be committed
-- before it can be referenced elsewhere, so the two parts cannot run in one script/transaction.)
-- Regenerated 2026-07-25.

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
--
-- Defensive: some environments may already have an older/differently-shaped
-- version of this function (e.g. from get_visible_likes_count-era
-- migrations) — CREATE OR REPLACE cannot change OUT-parameter shape, so
-- drop first regardless of what's currently live.
DROP FUNCTION IF EXISTS public.get_post_engagement_summary(uuid[], uuid);
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

-- ===== 20260713090000_account_visibility_enforcement.sql =====
-- Account privacy is simplified from a public/private toggle to a binary
-- choice: visible to scouts/agents only, or fully private (approved
-- followers only). Unlike the old is_private_account toggle, this is now
-- actually enforced in RLS on player_profiles and posts — previously the
-- setting was saved but nothing in the app ever checked it.
ALTER TABLE public.user_privacy_settings
  ADD COLUMN IF NOT EXISTS account_visibility text NOT NULL DEFAULT 'scouts_only'
    CHECK (account_visibility IN ('scouts_only', 'private'));

-- One-time backfill only: this must NOT blindly re-run on every replay of
-- this idempotent bundle. account_visibility was later widened to a
-- 3-option domain (scouts_only/scouts_and_mutual/everyone) by
-- 20260724140000_account_visibility_three_options.sql, which drops
-- 'private' as a valid value entirely and re-normalizes every row into the
-- 3-option domain. So: if the constraint currently in force already allows
-- 'scouts_and_mutual'/'everyone' (i.e. the later migration has already run
-- at some point), this backfill is obsolete and must be skipped — an
-- unconditional UPDATE here would stomp already-migrated rows back to the
-- no-longer-valid 'private' value and violate that later CHECK constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.user_privacy_settings'::regclass
      AND conname = 'user_privacy_settings_account_visibility_check'
      AND pg_get_constraintdef(oid) LIKE '%scouts_and_mutual%'
  ) THEN
    UPDATE public.user_privacy_settings
    SET account_visibility = CASE WHEN is_private_account THEN 'private' ELSE 'scouts_only' END;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.can_view_profile(_profile_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _visibility text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF auth.uid() = _profile_user_id THEN RETURN true; END IF;
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN true; END IF;

  SELECT account_visibility INTO _visibility FROM public.user_privacy_settings WHERE user_id = _profile_user_id;
  _visibility := COALESCE(_visibility, 'scouts_only');

  IF _visibility = 'scouts_only' THEN
    RETURN public.has_role(auth.uid(), 'scout'::app_role) OR public.has_role(auth.uid(), 'agent'::app_role);
  END IF;

  -- 'private': only approved (accepted) followers can view
  RETURN EXISTS (
    SELECT 1 FROM public.follows
    WHERE follower_id = auth.uid() AND following_id = _profile_user_id AND status = 'accepted'
  );
END;
$$;

-- player_profiles: replace open anon/authenticated read with the visibility check.
-- (No legitimate anon-facing flow reads player_profiles directly — the
-- external-recommendation pages resolve player info server-side via a
-- service-role edge function, which bypasses RLS entirely.)
DROP POLICY IF EXISTS "Authenticated can read player profiles" ON public.player_profiles;
DROP POLICY IF EXISTS "Anon can read player profiles" ON public.player_profiles;
DROP POLICY IF EXISTS "Player profiles respect account visibility" ON public.player_profiles;
CREATE POLICY "Player profiles respect account visibility"
  ON public.player_profiles FOR SELECT
  USING (public.can_view_profile(user_id));

-- posts: a post's visibility follows its author's account_visibility setting,
-- for any role (players and scouts alike).
DROP POLICY IF EXISTS "Anyone authenticated can view posts" ON public.posts;
DROP POLICY IF EXISTS "Posts respect author account visibility" ON public.posts;
CREATE POLICY "Posts respect author account visibility"
  ON public.posts FOR SELECT TO authenticated
  USING (public.can_view_profile(user_id));

-- ===== 20260713091000_auto_confirm_followers_enforcement.sql =====
-- "Auto-confirm anyone who follows you" was saved to user_privacy_settings
-- but nothing ever checked it — every incoming follow still landed as
-- "pending" regardless. request_follow() now inserts as 'accepted'
-- directly when the target has auto_confirm_followers enabled.
CREATE OR REPLACE FUNCTION public.request_follow(_following_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _existing public.follows%ROWTYPE;
  _new_id uuid;
  _auto_confirm boolean;
  _initial_status text;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _caller = _following_id THEN
    RAISE EXCEPTION 'You cannot follow yourself';
  END IF;

  SELECT auto_confirm_followers INTO _auto_confirm
  FROM public.user_privacy_settings WHERE user_id = _following_id;
  _initial_status := CASE WHEN COALESCE(_auto_confirm, false) THEN 'accepted' ELSE 'pending' END;

  SELECT * INTO _existing
  FROM public.follows
  WHERE follower_id = _caller
    AND following_id = _following_id
  LIMIT 1;

  IF _existing.id IS NULL THEN
    INSERT INTO public.follows (follower_id, following_id, status, responded_at)
    VALUES (
      _caller, _following_id, _initial_status,
      CASE WHEN _initial_status = 'accepted' THEN now() ELSE NULL END
    )
    RETURNING id INTO _new_id;

    RETURN _new_id;
  END IF;

  IF _existing.status = 'accepted' THEN
    RAISE EXCEPTION 'Already following';
  END IF;

  IF _existing.status = 'pending' THEN
    RAISE EXCEPTION 'Follow request already pending';
  END IF;

  UPDATE public.follows
  SET status = _initial_status,
      created_at = now(),
      responded_at = CASE WHEN _initial_status = 'accepted' THEN now() ELSE NULL END
  WHERE id = _existing.id
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$function$;

-- ===== 20260713092000_restricted_accounts_enforcement.sql =====
-- Restricted accounts previously only stored a row that nothing else in the
-- app ever checked. This wires up two of the effects promised by the
-- "How restrict works" sheet:
--   1. Restricted people don't see your online status.
--   2. Comments from someone you've restricted are only visible to you and
--      them (not to other viewers) — unlike a full block, which hides the
--      comment from everyone but its author.
-- The third promised effect (moving their messages into a separate
-- "requests" section) needs a real requests-inbox feature that doesn't
-- exist yet in the app, so it's intentionally left out of this pass.

-- Returns only a boolean so the restricted person's client can suppress
-- presence for that user, without exposing the restricted_accounts row
-- itself (which stays owner-only per its RLS policy — "we won't let them
-- know you restricted them").
CREATE OR REPLACE FUNCTION public.am_i_restricted_by(_other_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restricted_accounts
    WHERE restrictor_id = _other_user_id AND restricted_id = auth.uid()
  );
$$;

CREATE INDEX IF NOT EXISTS idx_restricted_accounts_restricted_id ON public.restricted_accounts (restricted_id);
CREATE INDEX IF NOT EXISTS idx_blocked_commenters_blocked_id ON public.blocked_commenters (blocked_id);

DROP POLICY IF EXISTS "Anyone authenticated can view comments" ON public.post_comments;
DROP POLICY IF EXISTS "View comments respecting blocks and restrictions" ON public.post_comments;
CREATE POLICY "View comments respecting blocks and restrictions"
  ON public.post_comments FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      -- Fully blocked: invisible to everyone but the author.
      NOT EXISTS (
        SELECT 1 FROM public.posts p
        JOIN public.blocked_commenters bc ON bc.blocker_id = p.user_id AND bc.blocked_id = post_comments.user_id
        WHERE p.id = post_comments.post_id
      )
      AND (
        -- Restricted: invisible to everyone except the post owner and the author.
        NOT EXISTS (
          SELECT 1 FROM public.posts p
          JOIN public.restricted_accounts ra ON ra.restrictor_id = p.user_id AND ra.restricted_id = post_comments.user_id
          WHERE p.id = post_comments.post_id
        )
        OR auth.uid() = (SELECT user_id FROM public.posts WHERE id = post_comments.post_id)
      )
    )
  );

-- ===== 20260713093000_post_comments_visibility_enforcement.sql =====
-- "Who can comment" (posts_comments_visibility) was saved to
-- user_privacy_settings but never checked — anyone could comment on any
-- post regardless of the owner's setting. Enforce it on post_comments
-- INSERT. Blocking (blocked_commenters) is handled separately via the
-- SELECT policy (shadow-visibility), so it's not re-checked here.
CREATE OR REPLACE FUNCTION public.can_comment_on_post(_post_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _visibility text;
BEGIN
  SELECT user_id INTO _owner FROM public.posts WHERE id = _post_id;
  IF _owner IS NULL THEN RETURN false; END IF;
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

DROP POLICY IF EXISTS "Users can create comments" ON public.post_comments;
DROP POLICY IF EXISTS "Users can create comments respecting owner visibility" ON public.post_comments;
CREATE POLICY "Users can create comments respecting owner visibility"
  ON public.post_comments FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND public.can_comment_on_post(post_id));

-- ===== 20260713094000_post_engagement_hide_unwanted.sql =====
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

-- ===== 20260713095000_message_group_visibility_enforcement.sql =====
-- can_message_user() used to hardcode "the sender must already follow the
-- recipient" for every conversation, ignoring message_requests_visibility
-- entirely (the setting was saved but had no effect). Now it checks the
-- recipient's actual preference: 'everyone' allows a first message from
-- anyone, 'followers' requires the sender to already follow the recipient,
-- 'no_one' blocks new contacts outright. An existing follow relationship
-- (either direction) or a prior conversation always keeps messaging open,
-- matching the description already shown in the settings UI.
CREATE OR REPLACE FUNCTION public.can_message_user(_other_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _visibility text;
  _sender_follows_recipient boolean;
  _recipient_follows_sender boolean;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() = _other_user_id THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.conversations
    WHERE (user1_id = auth.uid() AND user2_id = _other_user_id)
       OR (user1_id = _other_user_id AND user2_id = auth.uid())
  ) THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.follows
    WHERE follower_id = auth.uid() AND following_id = _other_user_id AND status = 'accepted'
  ) INTO _sender_follows_recipient;

  SELECT EXISTS (
    SELECT 1 FROM public.follows
    WHERE follower_id = _other_user_id AND following_id = auth.uid() AND status = 'accepted'
  ) INTO _recipient_follows_sender;

  IF _sender_follows_recipient OR _recipient_follows_sender THEN
    RETURN true;
  END IF;

  SELECT message_requests_visibility INTO _visibility
  FROM public.user_privacy_settings WHERE user_id = _other_user_id;
  _visibility := COALESCE(_visibility, 'everyone');

  IF _visibility = 'everyone' THEN RETURN true; END IF;
  RETURN false; -- 'followers' or 'no_one', and no existing relationship
END;
$$;

-- "Who can add you to group chats" (group_chat_visibility) was also saved
-- but never checked — anyone could add anyone to a new group.
CREATE OR REPLACE FUNCTION public.can_add_to_group(_target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _visibility text;
BEGIN
  IF auth.uid() = _target_user_id THEN RETURN true; END IF;

  SELECT group_chat_visibility INTO _visibility
  FROM public.user_privacy_settings WHERE user_id = _target_user_id;
  _visibility := COALESCE(_visibility, 'everyone');

  IF _visibility = 'everyone' THEN RETURN true; END IF;

  -- 'following_or_messaged': adder must follow the target, be followed back,
  -- or already have a conversation with them.
  RETURN EXISTS (
    SELECT 1 FROM public.follows
    WHERE (follower_id = auth.uid() AND following_id = _target_user_id AND status = 'accepted')
       OR (follower_id = _target_user_id AND following_id = auth.uid() AND status = 'accepted')
  ) OR EXISTS (
    SELECT 1 FROM public.conversations
    WHERE (user1_id = auth.uid() AND user2_id = _target_user_id)
       OR (user1_id = _target_user_id AND user2_id = auth.uid())
  );
END;
$$;

DROP POLICY IF EXISTS "group_members_insert" ON public.group_members;
CREATE POLICY "group_members_insert" ON public.group_members FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.group_conversations WHERE id = group_id AND created_by = auth.uid())
    AND (user_id = auth.uid() OR public.can_add_to_group(user_id))
  );

-- ===== 20260724090000_recently_deleted_posts.sql =====
-- "Recently deleted" (Activitatea ta) needs somewhere to restore from, but
-- deleting a post was always a hard DELETE with no recovery window. This adds
-- a soft-delete column to posts/scout_posts: the owner's delete button now
-- sets deleted_at instead of removing the row, everyone else's SELECT policy
-- excludes soft-deleted rows (so all 20+ existing feed/profile/grid queries
-- keep working unchanged), and the owner can list/restore/permanently-delete
-- their own trash for 30 days via can_view_own_trash-style direct queries.
-- A pg_cron-less purge is handled lazily: purge_expired_deleted_posts() is
-- invoked from the client whenever the Recently Deleted screen loads.

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.scout_posts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_posts_deleted_at ON public.posts (user_id, deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scout_posts_deleted_at ON public.scout_posts (user_id, deleted_at) WHERE deleted_at IS NOT NULL;

-- Owner can still update their own post to set/clear deleted_at (soft-delete
-- and restore both go through the existing "Users can update own posts"
-- UPDATE policy, so no policy change is needed there).

DROP POLICY IF EXISTS "Posts respect author account visibility" ON public.posts;
CREATE POLICY "Posts respect author account visibility"
  ON public.posts FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.can_view_profile(user_id));

DROP POLICY IF EXISTS "Anyone can read scout posts" ON public.scout_posts;
CREATE POLICY "Anyone can read scout posts"
  ON public.scout_posts FOR SELECT
  USING (deleted_at IS NULL);

-- Owner-only trash view: lets the owner query their own soft-deleted posts
-- (the SELECT policies above hide them from everyone, including the owner,
-- since deleted_at IS NULL would otherwise exclude the owner's own trash too).
DROP POLICY IF EXISTS "Owner can view own deleted posts" ON public.posts;
CREATE POLICY "Owner can view own deleted posts"
  ON public.posts FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NOT NULL);

DROP POLICY IF EXISTS "Owner can view own deleted scout posts" ON public.scout_posts;
CREATE POLICY "Owner can view own deleted scout posts"
  ON public.scout_posts FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NOT NULL);

-- Permanently purges anything past the 30-day recovery window. Called
-- opportunistically from the client when the Recently Deleted screen opens.
CREATE OR REPLACE FUNCTION public.purge_expired_deleted_posts()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.posts WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  DELETE FROM public.scout_posts WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
END;
$$;

-- ===== 20260724091000_support_tickets.sql =====
-- "Report a problem" in Help & Support previously had no destination — it was
-- either a "coming soon" toast or removed outright. This adds a real contact
-- form: users submit a category + message, admins see and resolve the queue
-- from AdminDashboard, matching the existing scout_verification_requests
-- select/update RLS pattern.
CREATE TABLE IF NOT EXISTS public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('bug', 'account', 'report_user', 'payment', 'other')),
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved')),
  admin_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON public.support_tickets (user_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets (status);

ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "support_tickets_select_own" ON public.support_tickets;
CREATE POLICY "support_tickets_select_own" ON public.support_tickets
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "support_tickets_insert_own" ON public.support_tickets;
CREATE POLICY "support_tickets_insert_own" ON public.support_tickets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "support_tickets_admin_select_all" ON public.support_tickets;
CREATE POLICY "support_tickets_admin_select_all" ON public.support_tickets
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "support_tickets_admin_update_all" ON public.support_tickets;
CREATE POLICY "support_tickets_admin_update_all" ON public.support_tickets
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- ===== 20260724100000_fix_invite_test_unlock.sql =====
-- The "invite 3 friends -> unlock a test" feature was completely broken:
-- useInviteFriends.ts's unlockTestViaInvite() wrote a bookkeeping row into
-- invite_test_unlocks (which any authenticated user can insert for any
-- test_key with no validation — its RLS policy is "FOR ALL USING
-- (auth.uid() = user_id)" with no WITH CHECK on the actual unlock count),
-- then tried to upsert player_test_unlocks.unlocked_tests directly from the
-- client. player_test_unlocks has no INSERT/UPDATE policy for regular users
-- (writes are meant to only happen through SECURITY DEFINER functions like
-- ping_daily_visit), so that upsert silently failed under RLS every time —
-- the real "unlocked" gate never actually unlocked anything.
--
-- This adds a SECURITY DEFINER RPC that recomputes the validated-invite
-- count server-side (mirroring useInviteFriends.ts's calcCompletion >= 55%
-- rule), checks the caller actually has an unused unlock slot, and performs
-- both writes atomically and correctly.
CREATE OR REPLACE FUNCTION public.unlock_test_via_invite(_test_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _validated_count integer;
  _already_unlocked_count integer;
  _available_slots integer;
  _current_tests text[];
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Recompute validated invite count server-side (completion >= 55%),
  -- mirroring calcCompletion() in src/hooks/useInviteFriends.ts.
  SELECT count(*) INTO _validated_count
  FROM public.invite_uses iu
  JOIN public.player_profiles p ON p.user_id = iu.invitee_id
  WHERE iu.inviter_id = _uid
    AND (
      (CASE WHEN p.video_highlights IS NOT NULL AND array_length(p.video_highlights, 1) > 0 THEN 35 ELSE 0 END) +
      (CASE WHEN p.career_description IS NOT NULL AND p.career_description <> '' THEN 25 ELSE 0 END) +
      (CASE WHEN p.height_cm IS NOT NULL AND p.weight_kg IS NOT NULL AND p.preferred_foot IS NOT NULL THEN 20 ELSE 0 END) +
      (CASE WHEN p.photo_url IS NOT NULL AND p.photo_url <> '' THEN 5 ELSE 0 END) +
      (CASE WHEN p.position IS NOT NULL AND p.position <> '' THEN 5 ELSE 0 END) +
      (CASE WHEN p.current_team IS NOT NULL AND p.current_team <> '' THEN 2.5 ELSE 0 END) +
      (CASE WHEN p.nationality IS NOT NULL AND p.nationality <> '' THEN 2.5 ELSE 0 END) +
      (CASE WHEN p.date_of_birth IS NOT NULL THEN 5 ELSE 0 END)
    ) >= 55;

  SELECT count(*) INTO _already_unlocked_count
  FROM public.invite_test_unlocks WHERE user_id = _uid;

  _available_slots := floor(_validated_count / 3.0) - _already_unlocked_count;

  IF _available_slots <= 0 THEN
    RETURN false;
  END IF;

  IF EXISTS (SELECT 1 FROM public.invite_test_unlocks WHERE user_id = _uid AND test_key = _test_key) THEN
    RETURN false;
  END IF;

  INSERT INTO public.invite_test_unlocks (user_id, test_key) VALUES (_uid, _test_key);

  INSERT INTO public.player_test_unlocks (user_id, unlocked_tests)
  VALUES (_uid, ARRAY[_test_key])
  ON CONFLICT (user_id) DO UPDATE
  SET unlocked_tests = CASE
    WHEN _test_key = ANY(public.player_test_unlocks.unlocked_tests) THEN public.player_test_unlocks.unlocked_tests
    ELSE array_append(public.player_test_unlocks.unlocked_tests, _test_key)
  END;

  RETURN true;
END;
$$;

-- ===== 20260724110000_tighten_privacy_settings_select.sql =====
-- user_privacy_settings has had "select using (true)" since its very first
-- migration (20260608170000), back when the table had a single column
-- (feed_activity_visibility). Every subsequent ALTER TABLE ... ADD COLUMN
-- (account_visibility, message_requests_visibility, auto_confirm_followers,
-- invitation_code, story_replies_visibility, story_shares_enabled, etc.)
-- inherited that same open policy, so any authenticated user can currently
-- read any other user's ENTIRE privacy-settings row directly, including
-- their personal invitation code.
--
-- This tightens SELECT to owner-only, and adds narrow SECURITY DEFINER RPCs
-- for the handful of legitimate cross-user reads that were relying on the
-- open policy (StoryViewer's "who can reply to my story" check and
-- StoryShareSheet's "does this user allow story shares" check) — both were
-- previously enforced ONLY client-side (a modified/direct API client could
-- ignore the check entirely); they're now backed server-side too.

DROP POLICY IF EXISTS "privacy_settings_select_all" ON public.user_privacy_settings;
DROP POLICY IF EXISTS "privacy_settings_select_own" ON public.user_privacy_settings;
CREATE POLICY "privacy_settings_select_own"
  ON public.user_privacy_settings FOR SELECT
  USING (auth.uid() = user_id);

-- Real, server-enforced "can I reply to this user's story" check.
CREATE OR REPLACE FUNCTION public.can_reply_to_story(_story_owner_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _visibility text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() = _story_owner_id THEN RETURN true; END IF;

  SELECT story_replies_visibility INTO _visibility
  FROM public.user_privacy_settings WHERE user_id = _story_owner_id;
  _visibility := COALESCE(_visibility, 'everyone');

  IF _visibility = 'no_one' THEN RETURN false; END IF;
  IF _visibility = 'following' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = _story_owner_id AND following_id = auth.uid() AND status = 'accepted'
    );
  END IF;
  RETURN true; -- 'everyone'
END;
$$;

-- Real, server-readable "does this user allow their stories to be shared"
-- check (single-column, narrow — doesn't leak the rest of the row).
CREATE OR REPLACE FUNCTION public.get_story_shares_enabled(_story_owner_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT story_shares_enabled FROM public.user_privacy_settings WHERE user_id = _story_owner_id),
    true
  );
$$;

-- ===== 20260724120000_post_likes_visibility_leak.sql =====
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

-- ===== 20260724130000_daily_limit_real_enforcement.sql =====
-- The "Daily limit" setting (DailyLimitSection.tsx) promised "We'll remind
-- you to close SportRise when you spend this amount of time in a day," but
-- it only wrote a value to localStorage — nothing ever read it back to
-- actually show a reminder. Time tracking already exists and works
-- (app_sessions + increment_session_duration, wired via useTimeTracking.ts),
-- so this makes increment_session_duration return the day's running total,
-- letting the client compare it against the saved limit and show a real
-- toast instead of a placebo setting.
--
-- Postgres won't let CREATE OR REPLACE change a function's return type
-- (void -> integer here), so drop the old version first.
DROP FUNCTION IF EXISTS public.increment_session_duration(uuid, date, integer);
CREATE OR REPLACE FUNCTION public.increment_session_duration(
  p_user_id uuid,
  p_date date,
  p_seconds integer
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _total integer;
BEGIN
  INSERT INTO public.app_sessions (user_id, date, duration_seconds)
  VALUES (p_user_id, p_date, p_seconds)
  ON CONFLICT (user_id, date)
  DO UPDATE SET duration_seconds = app_sessions.duration_seconds + excluded.duration_seconds
  RETURNING duration_seconds INTO _total;
  RETURN _total;
END;
$$;

-- ===== 20260724140000_account_visibility_three_options.sql =====
-- Account privacy expands from a binary choice (scouts_only/private) to
-- three options:
--   'scouts_only'         - visible to scout/agent-role users only (unchanged)
--   'scouts_and_mutual'   - scouts/agents, plus followers you also follow
--                           back (mutual/reciprocal follow relationship)
--   'everyone'            - visible to any authenticated user
-- The old 'private' value (approved-followers-only) is migrated to
-- 'scouts_and_mutual', the closest equivalent that still exists as an
-- option, since a plain one-directional "approved follower" tier is being
-- replaced by the mutual-follow tier per the new 3-option design.
ALTER TABLE public.user_privacy_settings
  DROP CONSTRAINT IF EXISTS user_privacy_settings_account_visibility_check;

-- Unconditional re-run (not gated on migration having run before): a user
-- could still write the old 'private' value between bundle re-runs via a
-- stale/cached client build, so re-normalize every time rather than only
-- once historically.
UPDATE public.user_privacy_settings
SET account_visibility = 'scouts_and_mutual'
WHERE account_visibility NOT IN ('scouts_only', 'scouts_and_mutual', 'everyone');

ALTER TABLE public.user_privacy_settings
  ADD CONSTRAINT user_privacy_settings_account_visibility_check
    CHECK (account_visibility IN ('scouts_only', 'scouts_and_mutual', 'everyone'));

CREATE OR REPLACE FUNCTION public.can_view_profile(_profile_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _visibility text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF auth.uid() = _profile_user_id THEN RETURN true; END IF;
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN true; END IF;

  SELECT account_visibility INTO _visibility FROM public.user_privacy_settings WHERE user_id = _profile_user_id;
  _visibility := COALESCE(_visibility, 'scouts_only');

  IF _visibility = 'everyone' THEN
    RETURN true;
  END IF;

  IF public.has_role(auth.uid(), 'scout'::app_role) OR public.has_role(auth.uid(), 'agent'::app_role) THEN
    RETURN true;
  END IF;

  -- account_visibility only ever restricts access for scouts/agents vs.
  -- everyone else — it was never meant to hide ordinary players from each
  -- other in Community. An ordinary player viewing another player's profile
  -- always passes, regardless of the profile owner's scouts_only/
  -- scouts_and_mutual choice.
  IF public.has_role(_profile_user_id, 'player'::app_role) AND public.has_role(auth.uid(), 'player'::app_role) THEN
    RETURN true;
  END IF;

  IF _visibility = 'scouts_and_mutual' THEN
    -- Mutual follow: viewer follows the profile owner AND the owner follows
    -- the viewer back, both accepted.
    RETURN EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = auth.uid() AND following_id = _profile_user_id AND status = 'accepted'
    ) AND EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = _profile_user_id AND following_id = auth.uid() AND status = 'accepted'
    );
  END IF;

  RETURN false; -- 'scouts_only' and viewer is neither a scout/agent nor mutual
END;
$$;

-- ===== 20260724150000_ping_daily_visit_server_side_tests.sql =====
-- ping_daily_visit(_available_tests text[]) trusted the client-supplied test
-- list to decide which technical test gets unlocked next. Since a player's
-- sport (and therefore their real test list) lives in player_profiles.sport
-- and the client can pass any array it wants, a malicious client could pass
-- an arbitrary/foreign test_key array to influence which key ends up in
-- unlocked_tests (e.g. keys belonging to the other sport, or a made-up key).
-- Actual video verification is still admin-gated elsewhere, so this couldn't
-- forge a verified result, but the unlock-gate itself should not trust
-- client input. This recomputes the available test list server-side from
-- the caller's own player_profiles.sport, ignoring the parameter.
CREATE OR REPLACE FUNCTION public.ping_daily_visit(_available_tests text[])
RETURNS TABLE(current_streak integer, unlocked_tests text[], days_until_next_unlock integer, newly_unlocked text, next_test_preview text, best_streak integer, login_streak integer, best_login_streak integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _row public.player_test_unlocks%ROWTYPE;
  _today date := (now() AT TIME ZONE 'UTC')::date;
  _gap integer;
  _required integer;
  _candidates text[];
  _new_test text := NULL;
  _days_left integer := 0;
  _grace_earned integer;
  _sport text;
  _real_available_tests text[];
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT sport INTO _sport FROM public.player_profiles WHERE user_id = _uid;

  _real_available_tests := CASE COALESCE(_sport, 'football')
    WHEN 'basketball' THEN ARRAY[
      'free_throw_shooting_video', 'star_shooting_drill_video', 'crossover_video',
      'between_the_legs_video', 'double_cross_video', 'between_legs_cross_video'
    ]
    ELSE ARRAY[
      'control_pass_video', 'slalom_video', 'precision_video', 'coordination_video'
    ]
  END;

  INSERT INTO public.player_test_unlocks (user_id, current_streak, last_visit_date, next_unlock_started_on, best_streak, login_streak, best_login_streak)
  VALUES (_uid, 1, _today, _today, 1, 1, 1)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO _row FROM public.player_test_unlocks WHERE user_id = _uid;

  IF _row.last_visit_date IS NULL THEN
    _row.current_streak := 1;
    _row.login_streak := 1;
    _row.last_visit_date := _today;
    _row.next_unlock_started_on := _today;
    _row.grace_days_used := 0;
  ELSE
    _gap := _today - _row.last_visit_date;
    IF _gap = 0 THEN
      IF _row.current_streak < 1 THEN
        _row.current_streak := 1;
      END IF;
      IF COALESCE(_row.login_streak, 0) < 1 THEN
        _row.login_streak := 1;
      END IF;
    ELSIF _gap = 1 THEN
      _row.current_streak := _row.current_streak + 1;
      _row.login_streak := COALESCE(_row.login_streak, 0) + 1;
      _row.last_visit_date := _today;
    ELSIF _gap = 2 THEN
      _grace_earned := floor(COALESCE(_row.login_streak, _row.current_streak) / 7);
      IF COALESCE(_row.grace_days_used, 0) < _grace_earned THEN
        _row.grace_days_used := COALESCE(_row.grace_days_used, 0) + 1;
        _row.last_visit_date := _today;
      ELSE
        _row.current_streak := 1;
        _row.login_streak := 1;
        _row.last_visit_date := _today;
        _row.next_unlock_started_on := _today;
        _row.next_test_preview := NULL;
        _row.grace_days_used := 0;
      END IF;
    ELSE
      _row.current_streak := 1;
      _row.login_streak := 1;
      _row.last_visit_date := _today;
      _row.next_unlock_started_on := _today;
      _row.next_test_preview := NULL;
      _row.grace_days_used := 0;
    END IF;
  END IF;

  IF _row.current_streak > COALESCE(_row.best_streak, 0) THEN
    _row.best_streak := _row.current_streak;
  END IF;
  IF COALESCE(_row.login_streak, 0) > COALESCE(_row.best_login_streak, 0) THEN
    _row.best_login_streak := _row.login_streak;
  END IF;

  IF array_length(_row.unlocked_tests, 1) IS NULL OR array_length(_row.unlocked_tests, 1) = 0 THEN
    _required := 3;
  ELSE
    _required := 4;
  END IF;

  IF _row.current_streak >= _required AND array_length(COALESCE(_row.unlocked_tests, '{}'), 1) IS DISTINCT FROM array_length(_real_available_tests, 1) THEN
    SELECT array_agg(t) INTO _candidates
    FROM unnest(_real_available_tests) t
    WHERE t <> ALL (COALESCE(_row.unlocked_tests, '{}'::text[]));

    IF _candidates IS NOT NULL AND array_length(_candidates, 1) > 0 THEN
      IF _row.next_test_preview IS NOT NULL AND _row.next_test_preview = ANY(_candidates) THEN
        _new_test := _row.next_test_preview;
      ELSE
        _new_test := _candidates[1 + floor(random() * array_length(_candidates, 1))::int];
      END IF;
      _row.unlocked_tests := array_append(COALESCE(_row.unlocked_tests, '{}'::text[]), _new_test);
      _row.current_streak := 1;
      _row.next_unlock_started_on := _today;
      _row.next_test_preview := NULL;
      _row.grace_days_used := 0;
      _required := 4;
    END IF;
  ELSE
    IF (_required - _row.current_streak) = 1 THEN
      SELECT array_agg(t) INTO _candidates
      FROM unnest(_real_available_tests) t
      WHERE t <> ALL (COALESCE(_row.unlocked_tests, '{}'::text[]));
      IF _candidates IS NOT NULL AND array_length(_candidates, 1) > 0 THEN
        IF _row.next_test_preview IS NULL OR NOT (_row.next_test_preview = ANY(_candidates)) THEN
          _row.next_test_preview := _candidates[1 + floor(random() * array_length(_candidates, 1))::int];
        END IF;
      END IF;
    ELSE
      _row.next_test_preview := NULL;
    END IF;
  END IF;

  UPDATE public.player_test_unlocks
  SET current_streak = _row.current_streak,
      last_visit_date = _row.last_visit_date,
      unlocked_tests = _row.unlocked_tests,
      next_unlock_started_on = _row.next_unlock_started_on,
      next_test_preview = _row.next_test_preview,
      grace_days_used = _row.grace_days_used,
      best_streak = _row.best_streak,
      login_streak = _row.login_streak,
      best_login_streak = _row.best_login_streak
  WHERE user_id = _uid;

  _days_left := GREATEST(_required - _row.current_streak, 0);

  RETURN QUERY SELECT _row.current_streak, _row.unlocked_tests, _days_left, _new_test, _row.next_test_preview, _row.best_streak, _row.login_streak, _row.best_login_streak;
END;
$function$;

-- ===== 20260724160000_stories_and_scout_posts_visibility.sql =====
-- Two remaining places account_visibility (scouts_only/scouts_and_mutual/
-- everyone) was never actually enforced, same class of leak already fixed
-- for posts/player_profiles/post_likes/post_comments:
--
-- 1. stories: "Anyone can view active stories" only checked expires_at, not
--    who's asking — any authenticated user could open StoryViewer for any
--    userId and see the story regardless of the owner's account_visibility.
-- 2. scout_posts: "Anyone can read scout posts" only checked deleted_at
--    (added in 20260724090000) but never gated on can_view_profile like its
--    sibling policy on posts did in the same migration.
DROP POLICY IF EXISTS "Anyone can view active stories" ON public.stories;
DROP POLICY IF EXISTS "Stories respect author account visibility" ON public.stories;
CREATE POLICY "Stories respect author account visibility"
  ON public.stories FOR SELECT
  USING (expires_at > now() AND public.can_view_profile(user_id));

DROP POLICY IF EXISTS "Anyone can read scout posts" ON public.scout_posts;
DROP POLICY IF EXISTS "Scout posts respect author account visibility" ON public.scout_posts;
CREATE POLICY "Scout posts respect author account visibility"
  ON public.scout_posts FOR SELECT
  USING (deleted_at IS NULL AND public.can_view_profile(user_id));

-- ===== 20260725100000_add_cauta_jucator_role.sql =====
-- New role: "Caută Jucător" ("Search Player") — mirrors scout/club_rep in
-- the dashboard UI but goes through the same document-verification flow as
-- scout. This migration only adds the enum value; Postgres forbids using a
-- freshly-added enum value inside the same transaction that added it, so
-- every migration referencing 'cauta_jucator' must run in a later, separate
-- migration file.
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'cauta_jucator';

