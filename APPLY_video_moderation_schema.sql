-- Automated video moderation, MVP (see VIDEO_MODERATION_IMPLEMENTATION_PROMPT.md
-- §1, §4). No video becomes visible to anyone but its author and admins
-- until moderation_status = 'approved'.

ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending', 'approved', 'flagged', 'rejected'));

-- Existing rows (posted before this migration) are grandfathered in as
-- approved — there is no captured moderation history to re-derive a status
-- from, and re-running moderation retroactively is a separate, explicit
-- backfill job, not part of this migration.
UPDATE public.posts SET moderation_status = 'approved' WHERE moderation_status = 'pending';

ALTER TABLE public.video_submissions
  ADD COLUMN IF NOT EXISTS moderation_status text NOT NULL DEFAULT 'pending'
    CHECK (moderation_status IN ('pending', 'approved', 'flagged', 'rejected'));

UPDATE public.video_submissions SET moderation_status = 'approved' WHERE moderation_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_posts_moderation_status ON public.posts (moderation_status) WHERE moderation_status <> 'approved';
CREATE INDEX IF NOT EXISTS idx_video_submissions_moderation_status ON public.video_submissions (moderation_status) WHERE moderation_status <> 'approved';

-- posts: only a video/image post that's approved is visible to others; the
-- author and admins can always see their own pending/flagged content (with
-- a "being reviewed" badge on the client).
DROP POLICY IF EXISTS "Anyone authenticated can view posts" ON public.posts;
DROP POLICY IF EXISTS "Posts respect author account visibility" ON public.posts;
CREATE POLICY "Posts respect account visibility and moderation"
  ON public.posts FOR SELECT TO authenticated
  USING (
    (moderation_status = 'approved' AND public.can_view_profile(user_id))
    OR auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- video_submissions: currently readable by any authenticated user (used for
-- admin review + the submitter's own status). Restrict the same way.
DROP POLICY IF EXISTS "Authenticated can view all video submissions" ON public.video_submissions;
CREATE POLICY "Video submissions respect moderation status"
  ON public.video_submissions FOR SELECT TO authenticated
  USING (
    moderation_status = 'approved'
    OR auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- ---------------------------------------------------------------------------
-- Per-category moderation results (audit trail across initial + recheck).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.content_moderation_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type text NOT NULL CHECK (content_type IN ('post', 'test_video')),
  content_id uuid NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scores jsonb NOT NULL,
  stage text NOT NULL CHECK (stage IN ('initial', 'recheck')),
  provider text NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved', 'recheck', 'admin_review')),
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_content_moderation_results_content ON public.content_moderation_results (content_type, content_id, created_at DESC);

ALTER TABLE public.content_moderation_results ENABLE ROW LEVEL SECURITY;

-- Admin-only read; writes only ever happen via Edge Functions using the
-- service role, which bypasses RLS entirely — so there is deliberately no
-- INSERT policy for authenticated/anon at all.
DROP POLICY IF EXISTS content_moderation_results_admin_select ON public.content_moderation_results;
CREATE POLICY content_moderation_results_admin_select ON public.content_moderation_results
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ---------------------------------------------------------------------------
-- Configurable per-category thresholds (not hardcoded in the Edge Functions,
-- so they can be recalibrated from the database without a redeploy).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.moderation_thresholds (
  category text PRIMARY KEY,
  low_max numeric(4,3) NOT NULL,
  high_min numeric(4,3) NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.moderation_thresholds ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS moderation_thresholds_admin_all ON public.moderation_thresholds;
CREATE POLICY moderation_thresholds_admin_all ON public.moderation_thresholds
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Service role (Edge Functions) reads thresholds directly, bypassing RLS —
-- no separate policy needed for that.

-- Starting values only — deliberately conservative placeholders to be
-- calibrated once real traffic/false-positive data exists. See prompt §4.
INSERT INTO public.moderation_thresholds (category, low_max, high_min) VALUES
  ('sexual', 0.15, 0.70),
  ('violence', 0.20, 0.75),
  ('weapons', 0.20, 0.70),
  ('drugs', 0.20, 0.70),
  ('hate', 0.15, 0.70),
  ('threats', 0.15, 0.70),
  ('text', 0.15, 0.70)
ON CONFLICT (category) DO NOTHING;

-- ---------------------------------------------------------------------------
-- Content reports extended to point at a specific piece of content, not
-- just an account — reuses the support_tickets/report_user_and_account_ban
-- infrastructure already in place instead of a parallel table.
-- ---------------------------------------------------------------------------
ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS reported_content_type text CHECK (reported_content_type IN ('post', 'test_video')),
  ADD COLUMN IF NOT EXISTS reported_content_id uuid;

CREATE INDEX IF NOT EXISTS idx_support_tickets_reported_content ON public.support_tickets (reported_content_type, reported_content_id) WHERE reported_content_id IS NOT NULL;
