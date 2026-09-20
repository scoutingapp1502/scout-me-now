-- Profile photo (avatar) moderation. Previously a new avatar upload wrote
-- straight to player_profiles.photo_url / scout_profiles.photo_url and went
-- live everywhere (messages, posts, feed) instantly with zero automated
-- check — the one piece of user-uploaded image content in the whole app
-- that bypassed the moderation pipeline entirely.
--
-- Design: a new upload is staged in pending_photo_url + avatar_moderation
-- status 'pending', WITHOUT touching photo_url — so the previously-approved
-- avatar keeps showing everywhere until a decision is reached (explicit
-- product requirement: never blank/replace the visible avatar on an
-- unreviewed upload). On approval, the pending value is promoted into
-- photo_url and the staging columns are cleared. On rejection, the pending
-- file is deleted from storage, the staging columns are cleared, and
-- rejected_posts_count is incremented — by explicit instruction, a rejected
-- avatar is treated identically to a rejected post for the "users at risk
-- of blocking" flow, not tracked separately.
--
-- Mirrors the same three columns on both player_profiles and
-- scout_profiles since avatars exist (and are now moderated) for both roles.
-- avatar_submitted_at exists purely so the admin queue has something to
-- sort/display as "submitted at" — player_profiles/scout_profiles have no
-- updated_at trigger, so plain updated_at can't be trusted for this (it
-- would just be stale from profile creation on most rows). Set by the
-- client at the same time pending_photo_url is staged; cleared alongside it
-- on approval/rejection.
ALTER TABLE public.player_profiles
  ADD COLUMN IF NOT EXISTS pending_photo_url text,
  ADD COLUMN IF NOT EXISTS avatar_moderation_status text
    CHECK (avatar_moderation_status IS NULL OR avatar_moderation_status IN ('pending', 'flagged')),
  ADD COLUMN IF NOT EXISTS avatar_rejection_reason text,
  ADD COLUMN IF NOT EXISTS avatar_submitted_at timestamptz;

ALTER TABLE public.scout_profiles
  ADD COLUMN IF NOT EXISTS pending_photo_url text,
  ADD COLUMN IF NOT EXISTS avatar_moderation_status text
    CHECK (avatar_moderation_status IS NULL OR avatar_moderation_status IN ('pending', 'flagged')),
  ADD COLUMN IF NOT EXISTS avatar_rejection_reason text,
  ADD COLUMN IF NOT EXISTS avatar_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS rejected_posts_count integer NOT NULL DEFAULT 0;

-- Same self-only/admin-only read pattern as get_my_moderation_counts —
-- avatar review state is not part of the public profile.
CREATE OR REPLACE FUNCTION public.get_my_avatar_moderation_status()
RETURNS TABLE (
  pending_photo_url text,
  avatar_moderation_status text,
  avatar_rejection_reason text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT pending_photo_url, avatar_moderation_status, avatar_rejection_reason
  FROM public.player_profiles WHERE user_id = auth.uid()
  UNION ALL
  SELECT pending_photo_url, avatar_moderation_status, avatar_rejection_reason
  FROM public.scout_profiles WHERE user_id = auth.uid()
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_my_avatar_moderation_status() TO authenticated;

-- Called only by the analyze-video-frames / admin approve-avatar paths
-- (service role) — never exposed for a client to call on themselves.
CREATE OR REPLACE FUNCTION public.approve_pending_avatar(p_user_id uuid, p_table text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_table = 'player_profiles' THEN
    UPDATE public.player_profiles
    SET photo_url = pending_photo_url, pending_photo_url = NULL,
        avatar_moderation_status = NULL, avatar_rejection_reason = NULL, avatar_submitted_at = NULL
    WHERE user_id = p_user_id;
  ELSIF p_table = 'scout_profiles' THEN
    UPDATE public.scout_profiles
    SET photo_url = pending_photo_url, pending_photo_url = NULL,
        avatar_moderation_status = NULL, avatar_rejection_reason = NULL, avatar_submitted_at = NULL
    WHERE user_id = p_user_id;
  ELSE
    RAISE EXCEPTION 'Invalid table: %', p_table;
  END IF;
END;
$$;

-- Called by the reject-avatar Edge Function (service role) after deleting
-- the pending file from storage — clears the staging columns and reuses
-- the same rejected_posts_count counter as rejected posts, per explicit
-- product decision (an avatar rejection counts the same toward "users at
-- risk of blocking" as a rejected post).
CREATE OR REPLACE FUNCTION public.reject_pending_avatar(p_user_id uuid, p_table text, p_reason text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_table = 'player_profiles' THEN
    UPDATE public.player_profiles
    SET pending_photo_url = NULL, avatar_moderation_status = NULL, avatar_submitted_at = NULL,
        avatar_rejection_reason = p_reason, rejected_posts_count = rejected_posts_count + 1
    WHERE user_id = p_user_id;
  ELSIF p_table = 'scout_profiles' THEN
    UPDATE public.scout_profiles
    SET pending_photo_url = NULL, avatar_moderation_status = NULL, avatar_submitted_at = NULL,
        avatar_rejection_reason = p_reason, rejected_posts_count = rejected_posts_count + 1
    WHERE user_id = p_user_id;
  ELSE
    RAISE EXCEPTION 'Invalid table: %', p_table;
  END IF;
END;
$$;
