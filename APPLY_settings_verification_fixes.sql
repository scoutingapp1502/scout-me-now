-- Combined settings-verification fix bundle — paste into Supabase SQL Editor and run.
-- Covers every backend fix found while verifying 'Setări și activitate' works
-- correctly for both roles (Jucător / Descoperitor): Salvat, Arhivă,
-- Notificări, Blocat, Activitate în feed, Mesaje și răspunsuri, Comentarii,
-- Distribuire și reutilizare, Restricționat.
-- All statements are idempotent (CREATE OR REPLACE / DROP ... IF EXISTS /
-- ADD COLUMN IF NOT EXISTS) and safe to re-run.
-- Regenerated 2026-08-11.

-- ===== 20260811090000_saved_posts_support_scout_posts.sql =====
-- "Salvat" (SavedSection.tsx) only ever worked for posts in public.posts.
-- PersonalProfile.tsx's PostsTab renders BOTH public.posts and
-- public.scout_posts rows through the same <PostCard>, and PostCard's save
-- button (toggleSave) writes to saved_posts for whichever post is on
-- screen — but saved_posts.post_id had a hard FK to public.posts(id) only.
-- Saving a Descoperitor's (scout_posts) post therefore always failed with a
-- foreign-key violation, for every role, silently surfaced only as a
-- generic "Nu s-a putut salva" toast.
--
-- Fix: drop the single-table FK (posts and scout_posts are two independent
-- tables with overlapping id spaces, so a single FK can't reference "either
-- table" — this mirrors how deleted_at soft-delete already treats them as
-- parallel, un-joined sources elsewhere in the app) and add a post_source
-- column so callers can tell which table a saved row's post_id belongs to.
-- Existing rows all predate scout_posts support here, so they safely
-- backfill to 'posts'.

ALTER TABLE public.saved_posts DROP CONSTRAINT IF EXISTS saved_posts_post_id_fkey;

ALTER TABLE public.saved_posts
  ADD COLUMN IF NOT EXISTS post_source text NOT NULL DEFAULT 'posts'
    CHECK (post_source IN ('posts', 'scout_posts'));

-- The original unique(user_id, post_id) constraint stays valid: post ids
-- are gen_random_uuid()-generated per table, so a collision between a
-- posts.id and a scout_posts.id is not realistically possible, and even in
-- that edge case the same user saving "the same id twice" is still exactly
-- the double-save this constraint is meant to prevent.

-- ===== 20260811091000_scout_posts_archive_support.sql =====
-- "Arhivă" (ArchiveSection.tsx) → "Postări arhivate" only ever read from
-- public.posts (WHERE is_archived = true). PersonalProfile.tsx's PostsTab
-- renders scout_posts rows through the same <PostCard> as posts rows, and
-- PostCard's archive button (handleArchive) unconditionally wrote
-- UPDATE posts SET is_archived = true — for a Descoperitor's own post
-- (which lives in scout_posts, not posts), that UPDATE matches zero rows
-- (no error, since UPDATE with no match isn't a Postgres error), so the
-- post silently stayed un-archived server-side while the client removed it
-- from view via onDelete(post.id) — the post would then reappear on next
-- reload/re-fetch since it was never actually archived.
--
-- scout_posts never had an is_archived column at all (it does have
-- deleted_at from 20260724090000, but that's the separate soft-delete
-- feature, not archive). This adds it, mirroring public.posts.
ALTER TABLE public.scout_posts ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_scout_posts_is_archived ON public.scout_posts (user_id, is_archived) WHERE is_archived = true;

-- The existing "Scouts and agents can update own posts" UPDATE policy
-- (auth.uid() = user_id AND has scout/agent/cauta_jucator role) already
-- covers writing this new column — no RLS change needed.

-- ===== 20260811092000_collab_requests_cauta_jucator_rls.sql =====
-- "Agents can update collaboration requests" (agent_collaboration_requests)
-- still checked has_role(auth.uid(), 'agent') OR has_role(auth.uid(), 'scout')
-- — never 'cauta_jucator'. In practice this policy is never actually
-- exercised: NotificationsSection.tsx's accept/reject buttons call the
-- SECURITY DEFINER RPCs accept_collaboration_request/
-- reject_collaboration_request, which bypass RLS entirely and only check
-- auth.uid() against the request's agent_user_id/player_user_id (not
-- role). Still, this is defense-in-depth: any direct UPDATE from a
-- Descoperitor account (e.g. a future feature, or the Supabase client used
-- directly) would be silently rejected by this stale policy.
DROP POLICY IF EXISTS "Agents can update collaboration requests" ON public.agent_collaboration_requests;
CREATE POLICY "Agents can update collaboration requests"
ON public.agent_collaboration_requests
FOR UPDATE
USING (auth.uid() = agent_user_id AND (
  has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'cauta_jucator'::app_role)
));

-- ===== 20260811093000_blocks_real_enforcement.sql =====
-- "Profile blocate" (BlockedSection.tsx) writes/deletes rows in public.blocks,
-- but no RLS policy or SECURITY DEFINER function anywhere in the schema ever
-- reads that table. The UI explicitly promises: "Deblochează acest profil
-- pentru a vedea fotografiile și videoclipurile sale. Când îl deblochezi, va
-- putea să îți găsească profilul și să îți trimită mesaje." — i.e. blocking
-- someone should hide your profile/posts from them and stop them messaging
-- you, in both directions. None of that was ever enforced. This is a
-- pre-existing gap (not introduced by the cauta_jucator role), affecting
-- both roles equally.
--
-- Deliberately distinct from blocked_commenters (comment-only blocking,
-- already enforced) — this is the broader "block this profile" feature.

-- Bidirectional: if either side blocked the other, treat them as blocked.
-- Self-check first for a cheap early exit; STABLE + SECURITY DEFINER so it
-- can be used inside RLS policies without needing blocks to be SELECT-able
-- by the other party (blocks stays owner-only per its existing policies).
CREATE OR REPLACE FUNCTION public.is_blocked_between(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _a IS DISTINCT FROM _b AND EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = _a AND blocked_id = _b)
       OR (blocker_id = _b AND blocked_id = _a)
  );
$$;

-- ── Profile / posts visibility ──────────────────────────────────────────
-- Block check comes first and is unconditional (stricter than every other
-- visibility tier, including 'everyone' and the player-sees-player /
-- approved-cauta_jucator bypasses below it).
CREATE OR REPLACE FUNCTION public.can_view_profile(_profile_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _visibility text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF auth.uid() = _profile_user_id THEN RETURN true; END IF;
  IF public.is_blocked_between(auth.uid(), _profile_user_id) THEN RETURN false; END IF;
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN true; END IF;

  SELECT account_visibility INTO _visibility FROM public.user_privacy_settings WHERE user_id = _profile_user_id;
  _visibility := COALESCE(_visibility, 'scouts_only');

  IF _visibility = 'everyone' THEN
    RETURN true;
  END IF;

  IF (public.has_role(auth.uid(), 'scout'::app_role) OR public.has_role(auth.uid(), 'agent'::app_role)
      OR public.has_role(auth.uid(), 'cauta_jucator'::app_role))
     AND public.is_verification_approved(auth.uid()) THEN
    RETURN true;
  END IF;

  IF public.has_role(_profile_user_id, 'player'::app_role) AND public.has_role(auth.uid(), 'player'::app_role) THEN
    RETURN true;
  END IF;

  IF _visibility = 'scouts_and_mutual' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = auth.uid() AND following_id = _profile_user_id AND status = 'accepted'
    ) AND EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = _profile_user_id AND following_id = auth.uid() AND status = 'accepted'
    );
  END IF;

  RETURN false;
END;
$$;

-- ── Messaging ────────────────────────────────────────────────────────────
-- Block check comes before the "existing conversation always allowed"
-- shortcut — otherwise blocking someone you already have a thread with
-- would do nothing (the old thread would keep letting new messages through).
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

  IF public.is_blocked_between(auth.uid(), _other_user_id) THEN
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
  RETURN false;
END;
$$;

-- ── Following ────────────────────────────────────────────────────────────
-- A block in either direction stops new follow requests outright, same as
-- messaging. Existing follow relationships from before the block are left
-- alone here (unfollowing them is a separate, deliberate action already
-- available via the normal unfollow flow) — this only guards new requests.
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

  IF public.is_blocked_between(_caller, _following_id) THEN
    RAISE EXCEPTION 'Cannot follow this user';
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

-- ===== 20260811094000_feed_activity_visibility_likes_rls.sql =====
-- "Activitate în feed" (FeedActivitySection.tsx) promises: "Cine poate
-- vedea aprecierile și comentariile tale" — choosing 'no_one' should mean
-- nobody else can tell you liked something. That's already enforced in the
-- aggregate like counter (get_post_engagement_summary/
-- get_visible_likes_count both check feed_activity_visibility), but the
-- direct post_likes SELECT RLS policy never checked it — only whether the
-- POST itself was visible (can_view_profile on the post's author), not
-- whether the LIKER opted into feed_activity_visibility = 'no_one'.
-- PostCard.tsx has a "who liked this" list (fetchLikers, ~line 484) that
-- reads post_likes directly — a liker who chose 'no_one' would still show
-- up there for anyone browsing the post, contradicting the setting.
--
-- Two people should still see a 'no_one' like: the liker themselves (so
-- their own like button state is correct), and the POST'S OWNER (so they
-- still get a real "X liked your post" signal — the setting hides your
-- activity from the rest of the world, not from the person it's about).
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
      OR COALESCE(
        (SELECT feed_activity_visibility FROM public.user_privacy_settings WHERE user_id = post_likes.user_id),
        'followers'
      ) <> 'no_one'
    )
  );

-- ===== 20260811095000_fix_story_replies_visibility_constraint.sql =====
-- story_replies_visibility has the exact same bug that
-- 20260608174000_message_requests_settings.sql already fixed for
-- message_requests_visibility, but that earlier fix only touched the
-- sibling column — story_replies_visibility was never corrected.
--
-- The original 20260608173000_messages_replies_settings.sql CHECK
-- constraint only allows 'everyone' | 'following' | 'no_one', but
-- MessagesRepliesSection.tsx's StoryRepliesPage sends the literal
-- "followers" (RadioRow value="followers") for the "only people I follow"
-- option — "followers" is not a valid value under this constraint, so
-- saving that choice always fails with a CHECK violation (the same class
-- of bug fixed for account_visibility earlier in this session).
--
-- can_reply_to_story() (20260724110000_tighten_privacy_settings_select.sql)
-- also explicitly compares against the literal 'following', so even a row
-- that predates this fix and still holds the old 'following' value needs
-- to be normalized for that function to keep working correctly.
alter table public.user_privacy_settings
  drop constraint if exists user_privacy_settings_story_replies_visibility_check;

update public.user_privacy_settings
  set story_replies_visibility = 'followers'
  where story_replies_visibility = 'following';

alter table public.user_privacy_settings
  add constraint user_privacy_settings_story_replies_visibility_check
  check (story_replies_visibility in ('everyone', 'followers', 'no_one'));

-- can_reply_to_story() must now compare against 'followers', matching the
-- normalized column values above.
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
  IF _visibility = 'followers' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = _story_owner_id AND following_id = auth.uid() AND status = 'accepted'
    );
  END IF;
  RETURN true; -- 'everyone'
END;
$$;

-- ===== 20260811096000_scout_posts_comments_disabled.sql =====
-- "Dezactivează comentariile" (PostCard.tsx's handleToggleComments) always
-- wrote UPDATE posts SET comments_disabled = ... regardless of which table
-- the displayed post actually came from. For a Descoperitor's own post
-- (scout_posts, never public.posts), that UPDATE matched zero rows — no
-- error, so the UI's local state flipped to "disabled" while the database
-- never actually recorded it. scout_posts also never had a
-- comments_disabled column at all, so even a correctly-targeted write
-- would have failed.
--
-- 20260806170000_post_comments_disabled.sql originally scoped this
-- feature to public.posts only, deliberately, because at the time
-- scout-sourced posts weren't part of the unified feed this toggle needed
-- to cover. Since then (this session), scout_posts rows render through
-- the same <PostCard> as posts rows across PersonalProfile/ActivitySection/
-- SavedSection/ArchiveSection, so the gap is now user-visible for the
-- cauta_jucator role. This extends the feature to scout_posts, mirroring
-- every check that already exists for public.posts.
ALTER TABLE public.scout_posts ADD COLUMN IF NOT EXISTS comments_disabled boolean NOT NULL DEFAULT false;

-- can_comment_on_post() only ever looked at public.posts. Extend it to
-- also resolve scout_posts rows, keeping the exact same visibility logic
-- (posts_comments_visibility) for both sources.
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

-- The SELECT/INSERT policies on post_comments only checked
-- public.posts.comments_disabled directly (can_comment_on_post already
-- covers INSERT's own gate correctly via the function above, but the
-- SELECT policy re-implements the same disabled-check inline against
-- public.posts only, so it needs its own scout_posts branch too).
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

-- ===== 20260811097000_story_share_server_enforcement.sql =====
-- "Distribuire și reutilizare" → story_shares_enabled toggle was only
-- enforced client-side: StoryShareSheet.tsx checked
-- get_story_shares_enabled() before enabling the "send" button, but
-- handleSendTo() then inserted directly into public.messages with no
-- server-side check at all. A modified client (or a direct API call)
-- could send someone's story-share message regardless of the setting.
-- Not specific to the cauta_jucator role — a general security gap fixed
-- alongside the role-specific verification pass at the user's request.
--
-- messages.content is free-form text with no structural "this is a story
-- share" marker, so this can't be enforced with a plain RLS predicate on
-- messages. Instead: a SECURITY DEFINER RPC that validates
-- story_shares_enabled, then delegates conversation lookup/creation to the
-- existing get_or_create_conversation() (which already enforces
-- can_message_user() — blocking/message-request rules must still apply to
-- a story share like any other message).
CREATE OR REPLACE FUNCTION public.share_story_to_conversation(
  _story_owner_id uuid,
  _recipient_id uuid,
  _content text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _shares_enabled boolean;
  _conv_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT COALESCE(story_shares_enabled, true) INTO _shares_enabled
  FROM public.user_privacy_settings WHERE user_id = _story_owner_id;
  IF NOT COALESCE(_shares_enabled, true) THEN
    RAISE EXCEPTION 'This person does not allow their stories to be shared';
  END IF;

  -- get_or_create_conversation() enforces can_message_user() internally.
  _conv_id := public.get_or_create_conversation(_recipient_id);

  INSERT INTO public.messages (conversation_id, sender_id, content)
  VALUES (_conv_id, auth.uid(), _content);

  UPDATE public.conversations SET updated_at = now() WHERE id = _conv_id;

  RETURN _conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.share_story_to_conversation(uuid, uuid, text) TO authenticated;

-- ===== 20260811098000_restricted_read_receipts.sql =====
-- "Cum funcționează restricția" promises: restricted people "won't see...
-- when you've read their messages." am_i_restricted_by() (20260713092000)
-- already covers the sibling promise (hiding online status) and is wired
-- up in MessagesSection.tsx — but the read-receipt half was never
-- implemented: opening a conversation unconditionally marks all unread
-- incoming messages as read=true, with no check for whether the current
-- user has restricted the sender. Restricting someone should suppress
-- their read receipt on messages they send you.
--
-- Symmetric helper to am_i_restricted_by(_other_user_id) — that one
-- answers "did THEY restrict ME", this one answers "did I restrict THEM".
CREATE OR REPLACE FUNCTION public.have_i_restricted(_other_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restricted_accounts
    WHERE restrictor_id = auth.uid() AND restricted_id = _other_user_id
  );
$$;

