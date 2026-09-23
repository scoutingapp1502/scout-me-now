-- Implements three explicit product/legal requirements for accounts aged
-- 13-15 (and the messaging safeguard for under-16 more broadly), matching
-- what TermsSection.tsx already promises users today (see its "Siguranță și
-- comportament" section) — this migration is the FIRST actual enforcement
-- of that clause; until now the checkbox it describes did not exist at all.
--
--   A) Parent/guardian-presence confirmation in DMs: exactly the rule
--      already written in the Terms — when a player account under 16
--      receives a message from a Scout (cauta_jucator) account, the player
--      must tick a confirmation ("a parent/guardian is present") before
--      being able to reply, once per conversation (not time-limited/
--      recurring — that would go beyond what the Terms currently describe,
--      per explicit decision not to touch the legal text in this pass).
--   B) A 13-15 year old player's own posts are visible only to Scout
--      accounts, never to other players. As a VIEWER, though, a 13-15 year
--      old keeps full access to the normal Activity feed (SportRise,
--      Scouts, other players) and can still report content — they just
--      cannot like or comment on anything at all, anywhere (see B2 below,
--      is_restricted_minor()). Revised from an earlier, stricter version of
--      this migration that hid Activity from them entirely — kept for
--      history in this file's git log, not in the schema.
--   C) Durable, tamper-evident storage for admin's conversation export
--      (legal evidence in case of a dispute): every parental-presence
--      confirmation is an append-only row with its own timestamp, and the
--      export RPC below returns a canonical JSON snapshot the client hashes
--      (SHA-256) at export time — see reject-post-style "append-only,
--      admin-readable, no client UPDATE/DELETE" pattern already used for
--      user_consents (20260923090000_user_consents.sql) and
--      content_rejection_notices.

-- =============================================================================
-- A) Parental-presence confirmation, per conversation
-- =============================================================================
-- One row per (conversation_id, confirming user) — append-only, never
-- updated/deleted by the client. A fresh row is inserted every time it's
-- confirmed; the export in part (C) reads the full history, not just the
-- latest, precisely so the timestamped evidence trail is never overwritten.
CREATE TABLE IF NOT EXISTS public.parental_presence_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  confirmed_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  confirmed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parental_presence_confirmations_conversation ON public.parental_presence_confirmations (conversation_id);
CREATE INDEX IF NOT EXISTS idx_parental_presence_confirmations_user ON public.parental_presence_confirmations (confirmed_by);

ALTER TABLE public.parental_presence_confirmations ENABLE ROW LEVEL SECURITY;

-- Either participant in the conversation can see that a confirmation
-- happened (the Scout on the other end also needs to know the gate is
-- cleared, so their own client can stop showing "waiting for the minor to
-- confirm"). Admins see everything, for the export in part (C).
DROP POLICY IF EXISTS "Conversation participants can view presence confirmations" ON public.parental_presence_confirmations;
CREATE POLICY "Conversation participants can view presence confirmations" ON public.parental_presence_confirmations
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );
DROP POLICY IF EXISTS "Admins can view all presence confirmations" ON public.parental_presence_confirmations;
CREATE POLICY "Admins can view all presence confirmations" ON public.parental_presence_confirmations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Only the minor themselves can confirm, and only for a conversation they're
-- actually part of — checked again, redundantly, inside
-- confirm_parental_presence() below (SECURITY DEFINER), so this INSERT
-- policy is a second, independent layer, not the only one.
DROP POLICY IF EXISTS "Users can confirm their own presence" ON public.parental_presence_confirmations;
CREATE POLICY "Users can confirm their own presence" ON public.parental_presence_confirmations
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = confirmed_by
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
    )
  );
-- No UPDATE/DELETE policy at all — append-only, matches user_consents.

-- True only when: the recipient (auth.uid()) is a player account under 16,
-- AND the other participant in the conversation is a Scout (cauta_jucator)
-- account. Exactly the condition described in TermsSection.tsx. Returns
-- false (no gate) for every other combination — a scout messaging an adult
-- player, two players messaging each other, a minor messaging a scout
-- first, etc. are all unaffected, matching "before being able to reply" in
-- the Terms (the minor is always the one replying to an inbound message
-- from a Scout, never the one who has to confirm before sending first).
CREATE OR REPLACE FUNCTION public.requires_parental_presence_confirmation(_conversation_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  conv public.conversations;
  other_id uuid;
  my_dob date;
  other_is_scout boolean;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;

  SELECT * INTO conv FROM public.conversations WHERE id = _conversation_id;
  IF NOT FOUND THEN RETURN false; END IF;
  IF conv.user1_id <> auth.uid() AND conv.user2_id <> auth.uid() THEN RETURN false; END IF;

  other_id := CASE WHEN conv.user1_id = auth.uid() THEN conv.user2_id ELSE conv.user1_id END;

  SELECT date_of_birth INTO my_dob FROM public.player_profiles WHERE user_id = auth.uid();
  IF my_dob IS NULL THEN RETURN false; END IF; -- not a player, or dob missing — never gated
  IF my_dob <= (CURRENT_DATE - INTERVAL '16 years')::date THEN RETURN false; END IF; -- 16+

  other_is_scout := public.has_role(other_id, 'cauta_jucator'::app_role);
  IF NOT other_is_scout THEN RETURN false; END IF;

  -- Already confirmed at least once for this conversation — the Terms
  -- describe this as a one-time gate before the minor's first reply, not a
  -- recurring one, so any prior confirmation clears it for good.
  RETURN NOT EXISTS (
    SELECT 1 FROM public.parental_presence_confirmations
    WHERE conversation_id = _conversation_id AND confirmed_by = auth.uid()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.requires_parental_presence_confirmation(uuid) TO authenticated;

-- Server-side enforcement — without this, the gate would be purely a
-- client-side UI affordance that a modified client or a direct API call
-- could skip entirely. Every messages INSERT now also fails when the
-- sender still owes a confirmation for that conversation.
DROP POLICY IF EXISTS "Users can send messages in approved conversations" ON public.messages;
CREATE POLICY "Users can send messages in approved conversations"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND NOT public.requires_parental_presence_confirmation(conversation_id)
  AND EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (
        (c.user1_id = auth.uid() AND public.can_message_user(c.user2_id))
        OR
        (c.user2_id = auth.uid() AND public.can_message_user(c.user1_id))
      )
  )
);

-- Records the confirmation and nothing else — kept separate from the
-- INSERT policy above so the client has one explicit call to make ("I
-- confirm") rather than smuggling it into the next message send.
CREATE OR REPLACE FUNCTION public.confirm_parental_presence(_conversation_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = _conversation_id AND (c.user1_id = auth.uid() OR c.user2_id = auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not a participant in this conversation';
  END IF;

  INSERT INTO public.parental_presence_confirmations (conversation_id, confirmed_by)
  VALUES (_conversation_id, auth.uid());
END;
$$;

GRANT EXECUTE ON FUNCTION public.confirm_parental_presence(uuid) TO authenticated;

-- =============================================================================
-- B) 13-15 year old players: own posts visible only to Scouts, Activity
--    feed (other people's posts) never pulled in at all.
-- =============================================================================

-- Product decision revised: a 13-15 year old DOES get the Activity tab and
-- sees the normal feed (SportRise, Scouts, other players) — they just can't
-- like or comment on anything (enforced separately below, on
-- post_likes/post_comments/comment_likes), and can still report content
-- like anyone else. Only the "my own posts are Scout-only" restriction
-- (unchanged, in raw_posts' WHERE below) survives from the original,
-- stricter version of this migration.
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
      -- A 13-15 year old author's posts are visible only to Scout accounts
      -- (see the SELECT policy mirror on posts below) — excluded here too
      -- so a non-Scout viewer's OWN feed query never even attempts to
      -- surface one (RLS would have hidden it anyway; this just avoids
      -- relying on RLS alone for something this sensitive).
      AND (
        public.has_role(p_user_id, 'cauta_jucator'::app_role)
        OR NOT EXISTS (
          SELECT 1 FROM public.player_profiles author
          WHERE author.user_id = p.user_id
            AND author.date_of_birth > (CURRENT_DATE - INTERVAL '16 years')::date
            AND author.date_of_birth <= (CURRENT_DATE - INTERVAL '13 years')::date
        )
      )
    UNION ALL
    SELECT sp.id, sp.user_id, sp.content, sp.image_url, sp.video_url, 'scout'::text AS post_type, sp.created_at, sp.comments_disabled
    FROM public.scout_posts sp
    JOIN followed f ON f.user_id = sp.user_id
    WHERE sp.deleted_at IS NULL AND sp.is_archived = false
      AND sp.user_id <> p_user_id
      AND sp.created_at >= f.followed_since
      AND sp.moderation_status = 'approved'
      -- Scout accounts (cauta_jucator) have no date_of_birth-driven minor
      -- restriction of their own — this age gate only ever applies to
      -- player authors, so scout_posts is unaffected either way, but the
      -- same has_role check is included for symmetry/documentation.
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

-- RLS backstop on posts itself — even a query that bypasses
-- get_activity_feed entirely (a direct SELECT against posts) must not leak
-- a 13-15 year old's posts to a non-Scout, non-owner, non-admin viewer.
DROP POLICY IF EXISTS "Posts respect account visibility and moderation" ON public.posts;
CREATE POLICY "Posts respect account visibility and moderation"
  ON public.posts FOR SELECT TO authenticated
  USING (
    (
      moderation_status = 'approved' AND public.can_view_profile(user_id)
      AND (
        -- Author is not a 13-15 year old player, OR the viewer is a Scout —
        -- exactly the restriction described above.
        NOT EXISTS (
          SELECT 1 FROM public.player_profiles author
          WHERE author.user_id = posts.user_id
            AND author.date_of_birth > (CURRENT_DATE - INTERVAL '16 years')::date
            AND author.date_of_birth <= (CURRENT_DATE - INTERVAL '13 years')::date
        )
        OR public.has_role(auth.uid(), 'cauta_jucator'::app_role)
      )
    )
    OR auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Same restriction on scout_posts's own visibility policy, for symmetry —
-- scout_posts authors are never 13-15 year olds (only players have this
-- restriction per the product decision), so this is a no-op in practice
-- today, but keeps both post tables' policies structurally identical and
-- future-proof if that ever changes.
DROP POLICY IF EXISTS "Scout posts respect account visibility and moderation" ON public.scout_posts;
CREATE POLICY "Scout posts respect account visibility and moderation"
  ON public.scout_posts FOR SELECT TO authenticated
  USING (
    (deleted_at IS NULL AND moderation_status = 'approved' AND public.can_view_profile(user_id))
    OR auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- =============================================================================
-- B2) 13-15 year old players can view the normal feed (SportRise, Scouts,
--     other players) and can still report content, but cannot like or
--     comment on anything, anywhere — revised product decision, replacing
--     the original "Activity hidden entirely" approach above.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.is_restricted_minor(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.player_profiles
    WHERE user_id = _user_id
      AND date_of_birth > (CURRENT_DATE - INTERVAL '16 years')::date
      AND date_of_birth <= (CURRENT_DATE - INTERVAL '13 years')::date
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_restricted_minor(uuid) TO authenticated;

-- Likes and comments are blocked at the actor level (auth.uid()), not the
-- content's — a 13-15 year old can't like/comment on ANY post/comment,
-- theirs or anyone else's, regardless of who the author is. Reporting
-- (user_content_reports) is untouched — it has its own, separate INSERT
-- policy that this migration does not modify.
DROP POLICY IF EXISTS "Users can like posts" ON public.post_likes;
CREATE POLICY "Users can like posts"
  ON public.post_likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_restricted_minor(auth.uid()));

DROP POLICY IF EXISTS "Users can like comments" ON public.comment_likes;
CREATE POLICY "Users can like comments"
  ON public.comment_likes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND NOT public.is_restricted_minor(auth.uid()));

-- can_comment_on_post() is the single choke point every comment INSERT
-- already goes through. IMPORTANT: this function has been rewritten across
-- several migrations (20260811096000_scout_posts_comments_disabled.sql for
-- scout_posts, 20260910090000_sportrise_official_posts.sql for
-- sportrise_posts, this one for is_restricted_minor) — each CREATE OR
-- REPLACE must carry forward every earlier branch, or the previous one
-- silently regresses. A prior version of THIS migration copied the
-- scout_posts-only body without the sportrise_posts branch or the
-- is_blocked_between check added in 20260910090000, which broke commenting
-- on official SportRise posts entirely (can_comment_on_post returned false
-- for any sportrise_posts id, since neither posts nor scout_posts had a
-- matching row) — fixed here by merging all three sources back together.
CREATE OR REPLACE FUNCTION public.can_comment_on_post(_post_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _visibility text;
  _comments_disabled boolean;
BEGIN
  IF public.is_restricted_minor(auth.uid()) THEN RETURN false; END IF;

  SELECT user_id, comments_disabled INTO _owner, _comments_disabled FROM public.posts WHERE id = _post_id;
  IF _owner IS NULL THEN
    SELECT user_id, comments_disabled INTO _owner, _comments_disabled FROM public.scout_posts WHERE id = _post_id;
  END IF;
  IF _owner IS NULL THEN
    -- No user_id owner at all — official SportRise content. Visible/
    -- commentable by everyone (no follow/block gate, there's no single
    -- account to check that against), just the comments_disabled flag
    -- applies.
    SELECT comments_disabled INTO _comments_disabled FROM public.sportrise_posts WHERE id = _post_id;
    IF FOUND THEN
      RETURN NOT COALESCE(_comments_disabled, false);
    END IF;
    RETURN false;
  END IF;
  IF _comments_disabled THEN RETURN false; END IF;
  IF _owner = auth.uid() THEN RETURN true; END IF;
  IF public.is_blocked_between(auth.uid(), _owner) THEN RETURN false; END IF;

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

-- =============================================================================
-- C) Admin conversation export (legal evidence)
-- =============================================================================
-- Returns a canonical snapshot (messages + every parental-presence
-- confirmation on record for the conversation) for a single conversation.
-- The client hashes the returned JSON (SHA-256) at export time and stores
-- that hash alongside the generated PDF's own record — this RPC's job is
-- only to produce the exact, complete, ordered data that gets hashed, not
-- to do the hashing or PDF generation itself (both happen in the Edge
-- Function / client, see export-conversation).
CREATE OR REPLACE FUNCTION public.get_conversation_export(_conversation_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT jsonb_build_object(
    'conversation_id', c.id,
    'user1_id', c.user1_id,
    'user2_id', c.user2_id,
    'conversation_created_at', c.created_at,
    'messages', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', m.id, 'sender_id', m.sender_id, 'content', m.content,
        'created_at', m.created_at, 'deleted_at', m.deleted_at
      ) ORDER BY m.created_at ASC)
      FROM public.messages m WHERE m.conversation_id = c.id
    ), '[]'::jsonb),
    'parental_presence_confirmations', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', pc.id, 'confirmed_by', pc.confirmed_by, 'confirmed_at', pc.confirmed_at
      ) ORDER BY pc.confirmed_at ASC)
      FROM public.parental_presence_confirmations pc WHERE pc.conversation_id = c.id
    ), '[]'::jsonb),
    'exported_at', now(),
    'exported_by', auth.uid()
  ) INTO result
  FROM public.conversations c
  WHERE c.id = _conversation_id;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Conversation not found';
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_conversation_export(uuid) TO authenticated;

-- Lists every conversation a given user is part of, for the admin export UI
-- (AdminAllUsers.tsx's "Conversații" button) — separate from
-- get_conversation_export, which returns one conversation's full content.
-- Includes a message_count so the admin can tell an empty conversation
-- apart from one worth exporting without opening each one.
CREATE OR REPLACE FUNCTION public.get_user_conversations_for_admin(_user_id uuid)
RETURNS TABLE (
  conversation_id uuid,
  other_user_id uuid,
  message_count bigint,
  last_message_at timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT
    c.id,
    CASE WHEN c.user1_id = _user_id THEN c.user2_id ELSE c.user1_id END,
    (SELECT count(*) FROM public.messages m WHERE m.conversation_id = c.id),
    (SELECT max(m.created_at) FROM public.messages m WHERE m.conversation_id = c.id)
  FROM public.conversations c
  WHERE c.user1_id = _user_id OR c.user2_id = _user_id
  ORDER BY (SELECT max(m.created_at) FROM public.messages m WHERE m.conversation_id = c.id) DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_conversations_for_admin(uuid) TO authenticated;

-- Durable, append-only record that an export happened, with the hash of
-- exactly what was exported — this is what lets SportRise later prove a
-- given PDF (or its content) was genuinely produced from real data and not
-- altered afterward: recomputing the hash from a fresh get_conversation_export
-- call at a later date (if the underlying rows haven't changed) should match
-- what's stored here for that export event, and any mismatch is itself
-- evidence of tampering. Never updated/deleted by the client.
CREATE TABLE IF NOT EXISTS public.conversation_export_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  exported_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_sha256 text NOT NULL,
  exported_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversation_export_log_conversation ON public.conversation_export_log (conversation_id);

ALTER TABLE public.conversation_export_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can view export log" ON public.conversation_export_log;
CREATE POLICY "Admins can view export log" ON public.conversation_export_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
DROP POLICY IF EXISTS "Admins can record exports" ON public.conversation_export_log;
CREATE POLICY "Admins can record exports" ON public.conversation_export_log
  FOR INSERT TO authenticated WITH CHECK (
    auth.uid() = exported_by AND public.has_role(auth.uid(), 'admin'::app_role)
  );
-- No UPDATE/DELETE policy — append-only.
