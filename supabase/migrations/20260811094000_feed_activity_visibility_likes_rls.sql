-- "Activitate în feed" (FeedActivitySection.tsx) promises: "Cine poate
-- vedea aprecierile și comentariile tale" — choosing 'no_one' should mean
-- nobody else can tell you liked something. That's already enforced in the
-- aggregate like counter (get_post_engagement_summary/
-- get_visible_likes_count both check feed_activity_visibility), but the
-- direct post_likes SELECT RLS policy never checked it — only whether the
-- POST itself was visible (can_view_profile on the post's author), not
-- whether the LIKER opted into feed_activity_visibility = 'no_one'.
-- PostCard.tsx has a "who liked this" list (fetchLikers, ~line 484) that
-- reads post_likes directly — a liker who chose 'no_one' would still show
-- up there for anyone browsing the post, contradicting the setting.
--
-- Two people should still see a 'no_one' like: the liker themselves (so
-- their own like button state is correct), and the POST'S OWNER (so they
-- still get a real "X liked your post" signal — the setting hides your
-- activity from the rest of the world, not from the person it's about).
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
