-- "Recently deleted" (Activitatea ta) needs somewhere to restore from, but
-- deleting a post was always a hard DELETE with no recovery window. This adds
-- a soft-delete column to posts/scout_posts: the owner's delete button now
-- sets deleted_at instead of removing the row, everyone else's SELECT policy
-- excludes soft-deleted rows (so all 20+ existing feed/profile/grid queries
-- keep working unchanged), and the owner can list/restore/permanently-delete
-- their own trash for 30 days via can_view_own_trash-style direct queries.
-- A pg_cron-less purge is handled lazily: purge_expired_deleted_posts() is
-- invoked from the client whenever the Recently Deleted screen loads.

ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.scout_posts ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_posts_deleted_at ON public.posts (user_id, deleted_at) WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_scout_posts_deleted_at ON public.scout_posts (user_id, deleted_at) WHERE deleted_at IS NOT NULL;

-- Owner can still update their own post to set/clear deleted_at (soft-delete
-- and restore both go through the existing "Users can update own posts"
-- UPDATE policy, so no policy change is needed there).

DROP POLICY IF EXISTS "Posts respect author account visibility" ON public.posts;
CREATE POLICY "Posts respect author account visibility"
  ON public.posts FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND public.can_view_profile(user_id));

DROP POLICY IF EXISTS "Anyone can read scout posts" ON public.scout_posts;
CREATE POLICY "Anyone can read scout posts"
  ON public.scout_posts FOR SELECT
  USING (deleted_at IS NULL);

-- Owner-only trash view: lets the owner query their own soft-deleted posts
-- (the SELECT policies above hide them from everyone, including the owner,
-- since deleted_at IS NULL would otherwise exclude the owner's own trash too).
DROP POLICY IF EXISTS "Owner can view own deleted posts" ON public.posts;
CREATE POLICY "Owner can view own deleted posts"
  ON public.posts FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NOT NULL);

DROP POLICY IF EXISTS "Owner can view own deleted scout posts" ON public.scout_posts;
CREATE POLICY "Owner can view own deleted scout posts"
  ON public.scout_posts FOR SELECT TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NOT NULL);

-- Permanently purges anything past the 30-day recovery window. Called
-- opportunistically from the client when the Recently Deleted screen opens.
CREATE OR REPLACE FUNCTION public.purge_expired_deleted_posts()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  DELETE FROM public.posts WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
  DELETE FROM public.scout_posts WHERE deleted_at IS NOT NULL AND deleted_at < now() - interval '30 days';
END;
$$;
