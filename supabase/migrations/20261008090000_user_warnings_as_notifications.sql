-- Warnings become real, persistent notifications delivered to the user
-- through the same Notifications feed as follows/messages/etc., instead of
-- a purely admin-facing boolean flag (warned_at) the user never saw at all.
-- Each click of "Avertizează" now issues a new, permanent warning event —
-- it is never retracted (no "undo" button), it just accumulates, same as
-- any other notification the user has already received. The admin panel
-- shows a running count of how many warnings a given user has been sent,
-- not just whether they're "currently" warned.
--
-- Deliberately a new table rather than reusing warned_at: warned_at was a
-- single mutable timestamp (cleared on "un-warn"), which can't represent
-- "3 separate warnings issued over time" or feed a stable, permanent
-- notification id the way get_notifications_feed's other sources do.
CREATE TABLE IF NOT EXISTS public.user_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  issued_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_warnings_user ON public.user_warnings (user_id, created_at DESC);

ALTER TABLE public.user_warnings ENABLE ROW LEVEL SECURITY;

-- The recipient can read their own warnings (so the Notifications feed can
-- resolve one directly if ever needed outside get_notifications_feed), and
-- admins can read everyone's — same pattern as every other moderation
-- table in this project. No client INSERT/UPDATE/DELETE policy at all:
-- writes only happen through issue_user_warning below (SECURITY DEFINER,
-- itself gated on has_role admin).
CREATE POLICY "Users can read own warnings" ON public.user_warnings
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can read all warnings" ON public.user_warnings
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- warning_count replaces warned_at as the durable, cumulative signal
-- surfaced in the admin "users at risk" list — it only ever goes up.
ALTER TABLE public.player_profiles
  ADD COLUMN IF NOT EXISTS warning_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.scout_profiles
  ADD COLUMN IF NOT EXISTS warning_count integer NOT NULL DEFAULT 0;

-- Issues one new warning: inserts the permanent notification-feed row and
-- bumps the durable counter on whichever profile table the account has a
-- row in, atomically. Admin-only.
CREATE OR REPLACE FUNCTION public.issue_user_warning(p_user_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  INSERT INTO public.user_warnings (user_id, issued_by) VALUES (p_user_id, auth.uid());

  UPDATE public.player_profiles SET warning_count = warning_count + 1 WHERE user_id = p_user_id;
  UPDATE public.scout_profiles SET warning_count = warning_count + 1 WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_user_warning(uuid) TO authenticated;

-- get_users_at_risk now reports warning_count instead of warned_at — a
-- changed OUT-parameter shape, which CREATE OR REPLACE cannot do in place
-- (PostgreSQL error 42P13), so the old signature must be dropped first.
-- set_user_warned is dropped entirely: there is no more "un-warn" action to
-- expose.
DROP FUNCTION IF EXISTS public.set_user_warned(uuid, boolean);
DROP FUNCTION IF EXISTS public.get_users_at_risk(integer);

CREATE OR REPLACE FUNCTION public.get_users_at_risk(p_min_rejected integer DEFAULT 3)
RETURNS TABLE (
  user_id uuid,
  first_name text,
  last_name text,
  rejected_posts_count integer,
  warning_count integer,
  email text,
  banned_until timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT pp.user_id, pp.first_name, pp.last_name, pp.rejected_posts_count, pp.warning_count,
         u.email::text, u.banned_until
  FROM public.player_profiles pp
  JOIN auth.users u ON u.id = pp.user_id
  WHERE pp.rejected_posts_count >= p_min_rejected
  UNION ALL
  SELECT sp.user_id, sp.first_name, sp.last_name, sp.rejected_posts_count, sp.warning_count,
         u.email::text, u.banned_until
  FROM public.scout_profiles sp
  JOIN auth.users u ON u.id = sp.user_id
  WHERE sp.rejected_posts_count >= p_min_rejected
  ORDER BY rejected_posts_count DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_users_at_risk(integer) TO authenticated;

-- get_notifications_feed gains a sixth source: warning_notifs. Uses the
-- 'warning' notif_type slot for player_sport, which no other consumer of
-- this row shape reads for that type — kept null everywhere else, same
-- pattern as the existing five sources' unused columns.
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
  -- New: a warning is self-issued by "the platform", so other_user_id/
  -- other_name/other_photo/other_role are all null — there's no other
  -- person to attribute it to, unlike every other notification kind here.
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
  )
  SELECT * FROM merged
  ORDER BY created_at DESC
  LIMIT p_limit OFFSET p_offset;
$$;

GRANT EXECUTE ON FUNCTION public.get_notifications_feed(uuid, text, integer, integer) TO authenticated;
