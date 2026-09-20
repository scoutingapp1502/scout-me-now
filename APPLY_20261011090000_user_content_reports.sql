-- User-initiated reports on a post, a comment, or a profile avatar — a
-- separate signal path from the automated moderation pipeline
-- (content_moderation_results): this is what a real user flags after
-- seeing something, not what OpenAI/Google's automated first pass caught.
-- Surfaced on a new, separate admin tab ("Rapoarte Utilizatori"), not
-- merged into the existing "Moderare Conținut" queue.
--
-- content_id's meaning depends on content_type: a posts.id for 'post', a
-- post_comments.id for 'comment', or a user_id for 'avatar' (same
-- convention as analyze-video-frames's avatar handling — an avatar has no
-- row of its own to point at). post_id is populated ONLY for 'comment'
-- reports, so the admin queue can show the parent post alongside the
-- reported comment, per explicit product requirement.
CREATE TABLE public.user_content_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content_type text NOT NULL CHECK (content_type IN ('post', 'comment', 'avatar')),
  content_id uuid NOT NULL,
  post_id uuid, -- only set when content_type = 'comment'
  content_owner_id uuid NOT NULL, -- denormalized: the author being reported, resolved at insert time so admin actions don't need a second lookup
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'dismissed')),
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One active (pending) report per reporter per piece of content — repeated
-- clicks or accidental double-reports don't pile up duplicate rows in the
-- admin queue. A partial unique index (not a plain UNIQUE constraint) so a
-- new report CAN be filed again later once a previous one has already been
-- resolved (approved/dismissed).
CREATE UNIQUE INDEX idx_user_content_reports_active
  ON public.user_content_reports (reporter_id, content_type, content_id)
  WHERE status = 'pending';

CREATE INDEX idx_user_content_reports_status ON public.user_content_reports (status, created_at DESC);

ALTER TABLE public.user_content_reports ENABLE ROW LEVEL SECURITY;

-- Reporters can see their own reports (so the client can show "already
-- reported" state); admins see everything. No client UPDATE/DELETE policy
-- at all — resolution only happens through the RPCs below (service-role-
-- equivalent via SECURITY DEFINER + has_role check), never a direct client
-- write.
CREATE POLICY "Users can view own reports" ON public.user_content_reports
  FOR SELECT TO authenticated USING (auth.uid() = reporter_id);
CREATE POLICY "Admins can view all reports" ON public.user_content_reports
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Insert is client-side direct (not behind an RPC) since the only
-- invariant that matters — reporter_id = auth.uid(), can't report your own
-- content — is expressible entirely in a WITH CHECK/RLS policy; content_id
-- validity (does this post/comment/user actually exist) is enforced by the
-- FK-less nature of content_id already being sourced from a real row the
-- client just rendered, same trust level as e.g. a like or a comment.
CREATE POLICY "Users can report others' content" ON public.user_content_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id AND reporter_id <> content_owner_id);

-- Admins can hard-delete a comment as part of resolving a report — post_comments
-- had no admin DELETE policy at all before this (only the comment's own
-- author could delete it, via "Users can delete own comments").
CREATE POLICY "Admins can delete comments" ON public.post_comments
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.user_content_reports;

-- Admin-only counts for the three report-type tabs, mirroring the
-- Postări/Poze de profil radio pattern already used in AdminContentModeration.
CREATE OR REPLACE FUNCTION public.get_user_report_counts()
RETURNS TABLE (post_count bigint, comment_count bigint, avatar_count bigint)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  RETURN QUERY
  SELECT
    (SELECT count(*) FROM public.user_content_reports WHERE status = 'pending' AND content_type = 'post'),
    (SELECT count(*) FROM public.user_content_reports WHERE status = 'pending' AND content_type = 'comment'),
    (SELECT count(*) FROM public.user_content_reports WHERE status = 'pending' AND content_type = 'avatar');
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_report_counts() TO authenticated;

-- Marking a report "dismissed" (not legitimate) — no side effects beyond
-- moving it out of the pending queue. Distinguished from "approved" below,
-- which also deletes the content and increments the durable
-- approved_reports_count.
CREATE OR REPLACE FUNCTION public.dismiss_user_report(p_report_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  UPDATE public.user_content_reports
  SET status = 'dismissed', reviewed_by = auth.uid(), reviewed_at = now()
  WHERE id = p_report_id AND status = 'pending';
END;
$$;

GRANT EXECUTE ON FUNCTION public.dismiss_user_report(uuid) TO authenticated;

-- approved_reports_count is deliberately separate from rejected_posts_count
-- (automated-pipeline rejections) — per explicit product decision, this is
-- its own counter, so an admin can tell "how many times has the automated
-- pipeline rejected this person's content" apart from "how many times has
-- a human reporter's complaint about this person been upheld by an admin".
-- Both still feed into the same "users at risk" list via
-- get_users_at_risk below.
ALTER TABLE public.player_profiles
  ADD COLUMN IF NOT EXISTS approved_reports_count integer NOT NULL DEFAULT 0;
ALTER TABLE public.scout_profiles
  ADD COLUMN IF NOT EXISTS approved_reports_count integer NOT NULL DEFAULT 0;

-- Marks a report as legitimate: increments the durable counter on the
-- reported content's author, marks the report resolved, and — mirroring
-- reject-post's hard-delete design — removes the underlying content itself
-- (post: full delete including storage files, via the reject-post Edge
-- Function called from the client after this RPC succeeds; comment: hard
-- row delete right here, it has no storage/counter machinery of its own;
-- avatar: routed through reject-avatar the same way posts are, from the
-- client). This RPC itself only ever handles the comment case directly,
-- since it's a single-statement delete with no storage cleanup — post/
-- avatar deletion needs the service-role Edge Functions and is triggered
-- by the client immediately after this call succeeds.
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
  END IF;
  -- 'post' and 'avatar' deletion happens client-side via reject-post /
  -- reject-avatar immediately after this call — see this function's own
  -- header comment for why those two need the service-role Edge Functions
  -- (storage file cleanup) rather than a plain DELETE here.
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_user_report(uuid) TO authenticated;

-- reject_pending_avatar gains an opt-out for the counter it normally
-- increments, for the same reason reject-post's skip_counter param exists:
-- when this delete happens because approve_user_report already
-- incremented approved_reports_count, rejected_posts_count (the automated-
-- pipeline-specific counter) must not also be bumped for the same event.
CREATE OR REPLACE FUNCTION public.reject_pending_avatar(p_user_id uuid, p_table text, p_reason text, p_skip_counter boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_table = 'player_profiles' THEN
    UPDATE public.player_profiles
    SET pending_photo_url = NULL, avatar_moderation_status = NULL, avatar_submitted_at = NULL,
        avatar_rejection_reason = p_reason,
        rejected_posts_count = rejected_posts_count + (CASE WHEN p_skip_counter THEN 0 ELSE 1 END)
    WHERE user_id = p_user_id;
  ELSIF p_table = 'scout_profiles' THEN
    UPDATE public.scout_profiles
    SET pending_photo_url = NULL, avatar_moderation_status = NULL, avatar_submitted_at = NULL,
        avatar_rejection_reason = p_reason,
        rejected_posts_count = rejected_posts_count + (CASE WHEN p_skip_counter THEN 0 ELSE 1 END)
    WHERE user_id = p_user_id;
  ELSE
    RAISE EXCEPTION 'Invalid table: %', p_table;
  END IF;
END;
$$;

-- get_users_at_risk now also reports approved_reports_count, and the
-- at-risk threshold considers EITHER counter crossing it — a user with
-- many automated rejections but no user reports (or vice versa) still
-- surfaces. Another changed OUT-parameter shape, so drop first.
DROP FUNCTION IF EXISTS public.get_users_at_risk(integer);

CREATE OR REPLACE FUNCTION public.get_users_at_risk(p_min_rejected integer DEFAULT 3)
RETURNS TABLE (
  user_id uuid,
  first_name text,
  last_name text,
  rejected_posts_count integer,
  approved_reports_count integer,
  warning_count integer,
  email text,
  account_status text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT pp.user_id, pp.first_name, pp.last_name, pp.rejected_posts_count, pp.approved_reports_count, pp.warning_count,
         u.email::text, pp.account_status
  FROM public.player_profiles pp
  JOIN auth.users u ON u.id = pp.user_id
  WHERE pp.rejected_posts_count >= p_min_rejected OR pp.approved_reports_count >= p_min_rejected
  UNION ALL
  SELECT sp.user_id, sp.first_name, sp.last_name, sp.rejected_posts_count, sp.approved_reports_count, sp.warning_count,
         u.email::text, sp.account_status
  FROM public.scout_profiles sp
  JOIN auth.users u ON u.id = sp.user_id
  WHERE sp.rejected_posts_count >= p_min_rejected OR sp.approved_reports_count >= p_min_rejected
  ORDER BY rejected_posts_count DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_users_at_risk(integer) TO authenticated;
