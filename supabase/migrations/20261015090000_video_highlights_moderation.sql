-- Video Highlights (uploaded files only, never YouTube/external links —
-- explicit product decision) go through the exact same moderation pipeline
-- as posts/avatars now. Previously handleVideoUpload in PersonalProfile.tsx
-- uploaded straight to the player-videos bucket and appended the URL
-- directly to player_profiles.video_highlights, live immediately with zero
-- automated check.
--
-- Modeled on video_submissions (the technical-test-video table) rather than
-- reusing that table directly — highlights are a distinct concept (no
-- test_key, no grade/reviewer_notes). Rows are KEPT after approval (status
-- flips to 'approved', never deleted) rather than removed — this is what
-- lets a user report an already-live highlight later (see
-- user_content_reports below): content_id can always resolve to a row
-- here, at any stage. player_profiles.video_highlights/video_descriptions
-- remain exactly what they mean today — parallel arrays of live urls/
-- descriptions, YouTube links included unchanged — this table is the
-- moderation record; approve_video_highlight appends into those arrays,
-- it doesn't replace them as the source of truth for what's displayed.
CREATE TABLE public.video_highlight_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_url text NOT NULL,
  storage_path text NOT NULL,
  description text NOT NULL DEFAULT '',
  moderation_status text NOT NULL DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'flagged', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_video_highlight_submissions_user ON public.video_highlight_submissions (user_id, created_at DESC);
CREATE INDEX idx_video_highlight_submissions_status ON public.video_highlight_submissions (moderation_status);

ALTER TABLE public.video_highlight_submissions ENABLE ROW LEVEL SECURITY;

-- Owner sees their own; admins see everything for the moderation queue. No
-- client UPDATE/DELETE policy — resolution only happens through the RPCs
-- below.
CREATE POLICY "Users can view own highlight submissions" ON public.video_highlight_submissions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all highlight submissions" ON public.video_highlight_submissions
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Players can submit highlight videos" ON public.video_highlight_submissions
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'player'::app_role));

ALTER PUBLICATION supabase_realtime ADD TABLE public.video_highlight_submissions;

-- Approves a pending/flagged highlight: appends its video_url/description
-- to player_profiles' arrays (at the end, same order
-- addVideoWithDescription's client-side "add" already produces) and flips
-- the row to 'approved' — never deleted, see this migration's header for
-- why. Deliberately no has_role check — called only from
-- analyze-video-frames/recheck-video-content with the service-role client,
-- where auth.uid() is NULL (same reasoning as reject_live_avatar).
CREATE OR REPLACE FUNCTION public.approve_video_highlight(p_submission_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  sub public.video_highlight_submissions;
BEGIN
  SELECT * INTO sub FROM public.video_highlight_submissions WHERE id = p_submission_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  UPDATE public.player_profiles
  SET video_highlights = COALESCE(video_highlights, ARRAY[]::text[]) || ARRAY[sub.video_url],
      video_descriptions = COALESCE(video_descriptions, ARRAY[]::text[]) || ARRAY[sub.description]
  WHERE user_id = sub.user_id;

  UPDATE public.video_highlight_submissions SET moderation_status = 'approved' WHERE id = p_submission_id;
END;
$$;

-- Rejects a highlight and removes its file from storage-referencing state:
-- if it was still pending/flagged (never went live), there's nothing else
-- to undo. If it was already 'approved' (a user report against a live
-- highlight being upheld), also removes it from the live
-- video_highlights/video_descriptions arrays by matching video_url —
-- array position lookup, same technique used for a plain array field with
-- no separate join table. The actual storage file deletion happens in the
-- reject-video-highlight Edge Function (service role), same division of
-- labor as reject-post/reject-avatar.
CREATE OR REPLACE FUNCTION public.reject_video_highlight(p_submission_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  sub public.video_highlight_submissions;
  idx integer;
  urls text[];
  descs text[];
BEGIN
  SELECT * INTO sub FROM public.video_highlight_submissions WHERE id = p_submission_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Submission not found';
  END IF;

  IF sub.moderation_status = 'approved' THEN
    SELECT video_highlights, video_descriptions INTO urls, descs FROM public.player_profiles WHERE user_id = sub.user_id;
    IF urls IS NOT NULL THEN
      idx := array_position(urls, sub.video_url);
      IF idx IS NOT NULL THEN
        UPDATE public.player_profiles
        SET video_highlights = urls[1:idx-1] || urls[idx+1:array_length(urls,1)],
            video_descriptions = CASE
              WHEN descs IS NULL THEN NULL
              ELSE descs[1:idx-1] || descs[idx+1:array_length(descs,1)]
            END
        WHERE user_id = sub.user_id;
      END IF;
    END IF;
  END IF;

  UPDATE public.video_highlight_submissions SET moderation_status = 'rejected' WHERE id = p_submission_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_video_highlight(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reject_video_highlight(uuid) TO authenticated;

-- content_rejection_notices and issue_content_rejection_notice's own CHECK
-- also need the new content_type value.
ALTER TABLE public.content_rejection_notices
  DROP CONSTRAINT content_rejection_notices_content_type_check;
ALTER TABLE public.content_rejection_notices
  ADD CONSTRAINT content_rejection_notices_content_type_check
  CHECK (content_type IN ('post', 'comment', 'avatar', 'video_highlight'));

CREATE OR REPLACE FUNCTION public.issue_content_rejection_notice(p_user_id uuid, p_content_type text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_content_type NOT IN ('post', 'comment', 'avatar', 'video_highlight') THEN
    RAISE EXCEPTION 'Invalid content_type: %', p_content_type;
  END IF;
  INSERT INTO public.content_rejection_notices (user_id, content_type) VALUES (p_user_id, p_content_type);
END;
$$;

GRANT EXECUTE ON FUNCTION public.issue_content_rejection_notice(uuid, text) TO authenticated;

-- user_content_reports gains a fourth content_type. content_id is always a
-- video_highlight_submissions.id — resolvable at any stage (pending,
-- flagged, approved, even rejected) since rows are never deleted, unlike
-- the avatar case which needed a separate reject_live_avatar path.
ALTER TABLE public.user_content_reports
  DROP CONSTRAINT user_content_reports_content_type_check;
ALTER TABLE public.user_content_reports
  ADD CONSTRAINT user_content_reports_content_type_check
  CHECK (content_type IN ('post', 'comment', 'avatar', 'video_highlight'));

-- approve_user_report: 'video_highlight' is handled entirely client-side
-- via the reject-video-highlight Edge Function immediately after this call
-- (it runs reject_video_highlight + storage cleanup + the rejection notice
-- itself) — same division of labor as 'post'/'avatar' below, and
-- deliberately NOT duplicated here to avoid reject_video_highlight running
-- twice for the same event.
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
  -- 'post', 'avatar' and 'video_highlight' deletion (and their own
  -- rejection notice) happens client-side via reject-post /
  -- reject-avatar / reject-video-highlight immediately after this call —
  -- see approve_user_report's original header comment (in
  -- 20261011090000_user_content_reports.sql) for why those need the
  -- service-role Edge Functions rather than a plain DELETE/RPC call here.
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_user_report(uuid) TO authenticated;
