-- "Avertizează" from AdminUserReports.tsx always sent the same generic
-- warning notification text ("If a future post is rejected...") regardless
-- of what the underlying report was actually about — a warning issued for
-- a reported COMMENT still told the user "postare" (post), which is simply
-- wrong and confusing. user_warnings had no column at all to record what
-- triggered a given warning; content_rejection_notices already carries this
-- (content_type) for the separate "your content was deleted" notice, this
-- adds the same idea here for "you were warned".
--
-- Nullable and optional everywhere: AdminAllUsers.tsx/AdminUsersAtRisk.tsx
-- issue warnings with no specific report in view (general account-level
-- warnings), and keep passing nothing — those stay the original generic
-- wording client-side.
ALTER TABLE public.user_warnings
  ADD COLUMN IF NOT EXISTS content_type text CHECK (content_type IN ('post', 'comment', 'avatar', 'video_highlight'));

CREATE OR REPLACE FUNCTION public.issue_user_warning(p_user_id uuid, p_content_type text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  IF p_content_type IS NOT NULL AND p_content_type NOT IN ('post', 'comment', 'avatar', 'video_highlight') THEN
    RAISE EXCEPTION 'Invalid content_type: %', p_content_type;
  END IF;

  INSERT INTO public.user_warnings (user_id, issued_by, content_type) VALUES (p_user_id, auth.uid(), p_content_type);

  UPDATE public.player_profiles SET warning_count = warning_count + 1 WHERE user_id = p_user_id;
  UPDATE public.scout_profiles SET warning_count = warning_count + 1 WHERE user_id = p_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_user_warning(uuid, text) TO authenticated;

-- get_notifications_feed's warning_notifs branch carries content_type in
-- the player_sport slot — same recycled-column trick rejection_notifs
-- already uses in 20261013090000_content_rejection_notices.sql, so no
-- OUT-parameter shape change (and no DROP FUNCTION) is needed here.
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
  -- content_type now carried in the player_sport slot, same as
  -- rejection_notifs below — NULL for a general/account-level warning
  -- issued outside a specific report (AdminAllUsers.tsx/AdminUsersAtRisk.tsx),
  -- non-null when it came from approving+warning on a specific report.
  warning_notifs AS (
    SELECT
      ('warning-' || w.id::text), 'warning'::text,
      w.created_at,
      NULL::uuid, NULL::text, NULL::text, NULL::text,
      NULL::text, NULL::text,
      NULL::text, NULL::text,
      NULL::text, NULL::text, w.content_type
    FROM public.user_warnings w
    WHERE w.user_id = p_user_id
  ),
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
