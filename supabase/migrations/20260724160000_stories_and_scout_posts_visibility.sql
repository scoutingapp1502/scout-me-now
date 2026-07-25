-- Two remaining places account_visibility (scouts_only/scouts_and_mutual/
-- everyone) was never actually enforced, same class of leak already fixed
-- for posts/player_profiles/post_likes/post_comments:
--
-- 1. stories: "Anyone can view active stories" only checked expires_at, not
--    who's asking — any authenticated user could open StoryViewer for any
--    userId and see the story regardless of the owner's account_visibility.
-- 2. scout_posts: "Anyone can read scout posts" only checked deleted_at
--    (added in 20260724090000) but never gated on can_view_profile like its
--    sibling policy on posts did in the same migration.
DROP POLICY IF EXISTS "Anyone can view active stories" ON public.stories;
DROP POLICY IF EXISTS "Stories respect author account visibility" ON public.stories;
CREATE POLICY "Stories respect author account visibility"
  ON public.stories FOR SELECT
  USING (expires_at > now() AND public.can_view_profile(user_id));

DROP POLICY IF EXISTS "Anyone can read scout posts" ON public.scout_posts;
DROP POLICY IF EXISTS "Scout posts respect author account visibility" ON public.scout_posts;
CREATE POLICY "Scout posts respect author account visibility"
  ON public.scout_posts FOR SELECT
  USING (deleted_at IS NULL AND public.can_view_profile(user_id));
