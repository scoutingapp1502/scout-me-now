-- posts had no admin UPDATE policy at all — only "Users can update own
-- posts" (auth.uid() = user_id). AdminContentModeration.tsx's Approve/
-- Reject buttons run `UPDATE posts SET moderation_status = ... WHERE id =
-- ...` as the admin, which RLS silently filtered to zero affected rows
-- (Postgres/PostgREST report this as success with no error — not a
-- permission error), so the toast said "approved"/"rejected" while nothing
-- actually changed. video_submissions already had a working admin UPDATE
-- policy, so only test-video moderation decisions were taking effect.
DROP POLICY IF EXISTS "Admins can update post moderation" ON public.posts;
CREATE POLICY "Admins can update post moderation"
  ON public.posts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
