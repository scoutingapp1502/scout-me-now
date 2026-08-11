-- Run this in Supabase SQL Editor to apply the "Activitate în feed" fix.
-- Fixes: the direct SELECT policy on post_likes never checked the LIKER's
-- own feed_activity_visibility setting (only whether the post itself was
-- visible) — so PostCard.tsx's "who liked this" list would still show a
-- liker who chose "Nimeni" (no one), contradicting the setting. The
-- aggregate like counter (get_post_engagement_summary) already respected
-- this; only the direct per-liker listing didn't.
-- Pre-existing gap, affects both roles equally.

-- ===== 20260811094000_feed_activity_visibility_likes_rls.sql =====
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
