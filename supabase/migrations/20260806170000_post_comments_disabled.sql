-- "Dezactivează comentariile" in the post menu was a no-op placeholder.
-- Add a per-post toggle: when set, other viewers lose read/write access to
-- the post's comments entirely (not just a hidden input) while the owner
-- keeps full visibility to moderate. Scoped to public.posts only — post_id
-- has no FK, and posts sourced from scout_posts (e.g. shown via the Recently
-- Deleted trash view) have no such column, so every check below is written
-- as "only restrict when a matching posts row says so" to leave that path
-- untouched.
ALTER TABLE public.posts ADD COLUMN comments_disabled boolean NOT NULL DEFAULT false;

DROP POLICY IF EXISTS "View comments respecting blocks and restrictions" ON public.post_comments;
DROP POLICY IF EXISTS "View comments respecting blocks, restrictions and visibility" ON public.post_comments;
CREATE POLICY "View comments respecting blocks, restrictions, visibility and disabled"
  ON public.post_comments FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.posts p WHERE p.id = post_comments.post_id AND public.can_view_profile(p.user_id)
    )
    AND (
      NOT EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_comments.post_id AND p.comments_disabled)
      OR auth.uid() = (SELECT user_id FROM public.posts WHERE id = post_comments.post_id)
    )
    AND (
      user_id = auth.uid()
      OR (
        NOT EXISTS (
          SELECT 1 FROM public.posts p
          JOIN public.blocked_commenters bc ON bc.blocker_id = p.user_id AND bc.blocked_id = post_comments.user_id
          WHERE p.id = post_comments.post_id
        )
        AND (
          NOT EXISTS (
            SELECT 1 FROM public.posts p
            JOIN public.restricted_accounts ra ON ra.restrictor_id = p.user_id AND ra.restricted_id = post_comments.user_id
            WHERE p.id = post_comments.post_id
          )
          OR auth.uid() = (SELECT user_id FROM public.posts WHERE id = post_comments.post_id)
        )
      )
    )
  );

DROP POLICY IF EXISTS "Users can create comments" ON public.post_comments;
CREATE POLICY "Users can create comments"
  ON public.post_comments FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND NOT EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_comments.post_id AND p.comments_disabled)
  );
