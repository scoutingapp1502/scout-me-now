-- A separate, automatic notification sent to a user whenever their content
-- is actually rejected/deleted — whether by the automated moderation
-- pipeline's admin_review path or by an admin approving another user's
-- report. Deliberately distinct from user_warnings (see
-- 20261008090000_user_warnings_as_notifications.sql): warnings are a
-- manual signal an admin chooses to send from "Useri cu risc" and feed
-- warning_count there; this is purely informational, generic ("your
-- content was removed for violating platform rules"), never mentions the
-- specific automated-pipeline category, and does NOT increment any
-- counter — per explicit product decision, "un warning ca ceea ce a fost
-- respins a fost respins", nothing more.
CREATE TABLE public.content_rejection_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('post', 'comment', 'avatar')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_content_rejection_notices_user ON public.content_rejection_notices (user_id, created_at DESC);

ALTER TABLE public.content_rejection_notices ENABLE ROW LEVEL SECURITY;

-- Same self-only/admin-only read pattern as user_warnings. No client
-- INSERT/UPDATE/DELETE policy — only ever written by
-- issue_content_rejection_notice below (SECURITY DEFINER), itself only
-- ever called from the service-role Edge Functions (reject-post,
-- reject-avatar) and approve_user_report — never directly by a client.
CREATE POLICY "Users can read own rejection notices" ON public.content_rejection_notices
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all rejection notices" ON public.content_rejection_notices
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.content_rejection_notices;

-- Deliberately NO has_role check here, same reasoning as
-- reject_live_avatar: this is only ever called from service-role contexts
-- (the Edge Functions below, or approve_user_report which is itself
-- already admin-gated) where auth.uid() would resolve to NULL and make
-- any has_role(auth.uid(), ...) check fail unconditionally.
CREATE OR REPLACE FUNCTION public.issue_content_rejection_notice(p_user_id uuid, p_content_type text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_content_type NOT IN ('post', 'comment', 'avatar') THEN
    RAISE EXCEPTION 'Invalid content_type: %', p_content_type;
  END IF;
  INSERT INTO public.content_rejection_notices (user_id, content_type) VALUES (p_user_id, p_content_type);
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_content_rejection_notice(uuid, text) TO authenticated;

-- approve_user_report's comment-deletion branch is the one rejection path
-- that happens entirely inside a single RPC (post/avatar deletion happens
-- in the Edge Functions, which call issue_content_rejection_notice
-- themselves after deleting) — so it fires the notice itself, right here,
-- for the comment case only.
CREATE OR REPLACE FUNCTION public.approve_user_report(p_report_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  r public.user_content_reports;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT * INTO r FROM public.user_content_reports WHERE id = p_report_id AND status = 'pending';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Report not found or already resolved';
  END IF;

  UPDATE public.user_content_reports
  SET status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_report_id;

  UPDATE public.player_profiles SET approved_reports_count = approved_reports_count + 1 WHERE user_id = r.content_owner_id;
  UPDATE public.scout_profiles SET approved_reports_count = approved_reports_count + 1 WHERE user_id = r.content_owner_id;

  IF r.content_type = 'comment' THEN
    DELETE FROM public.post_comments WHERE id = r.content_id;
    PERFORM public.issue_content_rejection_notice(r.content_owner_id, 'comment');
  END IF;
  -- 'post' and 'avatar' deletion (and their own rejection notice) happens
  -- client-side via reject-post / reject-avatar immediately after this
  -- call — see approve_user_report's original header comment (in
  -- 20261011090000_user_content_reports.sql) for why those two need the
  -- service-role Edge Functions rather than a plain DELETE here.
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_user_report(uuid) TO authenticated;

-- get_notifications_feed gains a seventh source: rejection_notices. Same
-- shape convention as warning_notifs (no "other person" to attribute it
-- to — it's the platform itself). Reuses the player_sport text slot to
-- carry content_type, same trick get_notifications_feed already uses
-- elsewhere for a type-specific extra field with no dedicated column.
CREATE OR REPLACE FUNCTION public.get_notifications_feed(
  p_user_id uuid,
  p_role text,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  notif_id text,
  notif_type text,
  created_at timestamptz,
  other_user_id uuid,
  other_name text,
  other_photo text,
  other_role text,
  status text,
  direction text,
  perspective text,
  initiated_by text,
  video_type text,
  test_key text,
  player_sport text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH profiles AS (
    SELECT user_id, first_name, last_name, photo_url, NULL::text AS sport, 'player'::text AS role FROM public.player_profiles
    UNION ALL
    SELECT user_id, first_name, last_name, photo_url, NULL::text, 'cauta_jucator'::text FROM public.scout_profiles
  ),
  incoming_follows AS (
    SELECT
      f.id::text AS notif_id, 'follow'::text AS notif_type,
      COALESCE(f.responded_at, f.created_at) AS created_at,
      f.follower_id AS other_user_id,
      COALESCE(p.first_name || ' ' || p.last_name, 'Unknown') AS other_name,
      p.photo_url AS other_photo,
      COALESCE(p.role, 'player') AS other_role,
      f.status, 'incoming'::text AS direction,
      NULL::text AS perspective, NULL::text AS initiated_by,
      NULL::text AS video_type, NULL::text AS test_key, NULL::text AS player_sport
    FROM public.follows f
    LEFT JOIN profiles p ON p.user_id = f.follower_id
    WHERE f.following_id = p_user_id AND f.status IN ('pending', 'accepted', 'rejected')
  ),
  outgoing_follows AS (
    SELECT
      (f.id::text || '-response') AS notif_id, 'follow'::text,
      COALESCE(f.responded_at, f.created_at),
      f.following_id,
      COALESCE(p.first_name || ' ' || p.last_name, 'Unknown'),
      p.photo_url,
      COALESCE(p.role, 'player'),
      f.status, 'outgoing'::text,
      NULL::text, NULL::text,
      NULL::text, NULL::text, NULL::text
    FROM public.follows f
    LEFT JOIN profiles p ON p.user_id = f.following_id
    WHERE f.follower_id = p_user_id AND f.status IN ('accepted', 'rejected')
  ),
  collab_agent_sent AS (
    SELECT
      (r.id::text || '-sent') AS notif_id, 'collab_request'::text,
      r.created_at,
      r.player_user_id,
      COALESCE(p.first_name || ' ' || p.last_name, 'Unknown'),
      p.photo_url, 'player'::text,
      'sent'::text, NULL::text,
      'agent'::text, 'agent'::text,
      NULL::text, NULL::text, NULL::text
    FROM public.agent_collaboration_requests r
    LEFT JOIN profiles p ON p.user_id = r.player_user_id
    WHERE p_role = 'cauta_jucator' AND r.agent_user_id = p_user_id AND r.initiated_by = 'agent'
    UNION ALL
    SELECT
      (r.id::text || '-response'), 'collab_request'::text,
      COALESCE(r.updated_at, r.created_at),
      r.player_user_id,
      COALESCE(p.first_name || ' ' || p.last_name, 'Unknown'),
      p.photo_url, 'player'::text,
      r.status, NULL::text,
      'agent'::text, 'agent'::text,
      NULL::text, NULL::text, NULL::text
    FROM public.agent_collaboration_requests r
    LEFT JOIN profiles p ON p.user_id = r.player_user_id
    WHERE p_role = 'cauta_jucator' AND r.agent_user_id = p_user_id AND r.initiated_by = 'agent' AND r.status IN ('accepted', 'rejected')
  ),
  collab_agent_received AS (
    SELECT
      r.id::text, 'collab_request'::text,
      r.created_at,
      r.player_user_id,
      COALESCE(p.first_name || ' ' || p.last_name, 'Unknown'),
      p.photo_url, 'player'::text,
      r.status, NULL::text,
      'agent'::text, 'player'::text,
      NULL::text, NULL::text, NULL::text
    FROM public.agent_collaboration_requests r
    LEFT JOIN profiles p ON p.user_id = r.player_user_id
    WHERE p_role = 'cauta_jucator' AND r.agent_user_id = p_user_id AND r.initiated_by = 'player'
  ),
  collab_player_received AS (
    SELECT
      r.id::text, 'collab_request'::text,
      r.created_at,
      r.agent_user_id,
      COALESCE(p.first_name || ' ' || p.last_name, 'Unknown'),
      p.photo_url, 'cauta_jucator'::text,
      r.status, NULL::text,
      'player'::text, 'agent'::text,
      NULL::text, NULL::text, NULL::text
    FROM public.agent_collaboration_requests r
    LEFT JOIN profiles p ON p.user_id = r.agent_user_id
    WHERE p_role = 'player' AND r.player_user_id = p_user_id AND r.initiated_by = 'agent'
  ),
  collab_player_sent AS (
    SELECT
      (r.id::text || '-sent'), 'collab_request'::text,
      r.created_at,
      r.agent_user_id,
      COALESCE(p.first_name || ' ' || p.last_name, 'Unknown'),
      p.photo_url, 'cauta_jucator'::text,
      'sent'::text, NULL::text,
      'player'::text, 'player'::text,
      NULL::text, NULL::text, NULL::text
    FROM public.agent_collaboration_requests r
    LEFT JOIN profiles p ON p.user_id = r.agent_user_id
    WHERE p_role = 'player' AND r.player_user_id = p_user_id AND r.initiated_by = 'player'
    UNION ALL
    SELECT
      (r.id::text || '-response'), 'collab_request'::text,
      COALESCE(r.updated_at, r.created_at),
      r.agent_user_id,
      COALESCE(p.first_name || ' ' || p.last_name, 'Unknown'),
      p.photo_url, 'cauta_jucator'::text,
      r.status, NULL::text,
      'player'::text, 'player'::text,
      NULL::text, NULL::text, NULL::text
    FROM public.agent_collaboration_requests r
    LEFT JOIN profiles p ON p.user_id = r.agent_user_id
    WHERE p_role = 'player' AND r.player_user_id = p_user_id AND r.initiated_by = 'player' AND r.status IN ('accepted', 'rejected')
  ),
  rec_as_author AS (
    SELECT
      ('rec-' || r.id::text || '-author'), 'recommendation'::text,
      r.created_at,
      r.recipient_user_id,
      COALESCE(p.first_name || ' ' || p.last_name, 'Unknown'),
      p.photo_url, COALESCE(p.role, 'cauta_jucator'),
      'pending'::text, NULL::text,
      'author'::text, NULL::text,
      NULL::text, NULL::text, NULL::text
    FROM public.recommendations r
    LEFT JOIN profiles p ON p.user_id = r.recipient_user_id
    WHERE r.author_user_id = p_user_id AND r.status = 'pending' AND r.initiated_by = 'request'
  ),
  rec_as_recipient AS (
    SELECT
      ('rec-' || r.id::text || '-recipient'), 'recommendation'::text,
      r.created_at,
      r.author_user_id,
      COALESCE(p.first_name || ' ' || p.last_name, 'Unknown'),
      p.photo_url, COALESCE(p.role, 'player'),
      'submitted'::text, NULL::text,
      'recipient'::text, NULL::text,
      NULL::text, NULL::text, NULL::text
    FROM public.recommendations r
    LEFT JOIN profiles p ON p.user_id = r.author_user_id
    WHERE r.recipient_user_id = p_user_id AND r.status = 'submitted'
  ),
  followed AS (
    SELECT following_id AS user_id, COALESCE(responded_at, created_at) AS followed_since
    FROM public.follows WHERE follower_id = p_user_id AND status = 'accepted'
  ),
  video_notifs AS (
    SELECT
      ('video-' || vn.id::text), 'video'::text,
      vn.created_at,
      vn.player_id,
      COALESCE(p.first_name || ' ' || p.last_name, 'Jucător'),
      p.photo_url, 'player'::text,
      NULL::text, NULL::text,
      NULL::text, NULL::text,
      vn.type, vn.test_key, p.sport
    FROM public.player_video_notifications vn
    JOIN followed f ON f.user_id = vn.player_id
    JOIN public.user_roles ur ON ur.user_id = vn.player_id AND ur.role = 'player'::app_role
    LEFT JOIN profiles p ON p.user_id = vn.player_id
    WHERE vn.created_at >= f.followed_since
  ),
  story_like_notifs AS (
    SELECT
      ('storylike-' || sl.id::text), 'story_like'::text,
      sl.created_at,
      sl.user_id,
      COALESCE(p.first_name || ' ' || p.last_name, 'Unknown'),
      p.photo_url, COALESCE(p.role, 'player'),
      NULL::text, NULL::text,
      NULL::text, NULL::text,
      NULL::text, NULL::text, NULL::text
    FROM public.story_likes sl
    JOIN public.stories s ON s.id = sl.story_id
    LEFT JOIN profiles p ON p.user_id = sl.user_id
    WHERE s.user_id = p_user_id AND sl.user_id <> p_user_id
  ),
  warning_notifs AS (
    SELECT
      ('warning-' || w.id::text), 'warning'::text,
      w.created_at,
      NULL::uuid, NULL::text, NULL::text, NULL::text,
      NULL::text, NULL::text,
      NULL::text, NULL::text,
      NULL::text, NULL::text, NULL::text
    FROM public.user_warnings w
    WHERE w.user_id = p_user_id
  ),
  -- New: same "self-issued by the platform" shape as warning_notifs.
  -- content_type carried in the player_sport slot (see this migration's
  -- header comment).
  rejection_notifs AS (
    SELECT
      ('rejection-' || crn.id::text), 'content_rejection'::text,
      crn.created_at,
      NULL::uuid, NULL::text, NULL::text, NULL::text,
      NULL::text, NULL::text,
      NULL::text, NULL::text,
      NULL::text, NULL::text, crn.content_type
    FROM public.content_rejection_notices crn
    WHERE crn.user_id = p_user_id
  ),
  merged AS (
    SELECT * FROM incoming_follows
    UNION ALL SELECT * FROM outgoing_follows
    UNION ALL SELECT * FROM collab_agent_sent
    UNION ALL SELECT * FROM collab_agent_received
    UNION ALL SELECT * FROM collab_player_received
    UNION ALL SELECT * FROM collab_player_sent
    UNION ALL SELECT * FROM rec_as_author
    UNION ALL SELECT * FROM rec_as_recipient
    UNION ALL SELECT * FROM video_notifs
    UNION ALL SELECT * FROM story_like_notifs
    UNION ALL SELECT * FROM warning_notifs
    UNION ALL SELECT * FROM rejection_notifs
  )
  SELECT * FROM merged
  ORDER BY created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_notifications_feed(uuid, text, integer, integer) TO authenticated;
