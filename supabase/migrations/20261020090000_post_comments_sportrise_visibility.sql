-- Same class of bug as can_comment_on_post() missing its sportrise_posts
-- branch (20261017090000): post_comments' own SELECT policy only ever
-- checked posts/scout_posts for the parent row, never sportrise_posts. A
-- comment on an official SportRise post therefore matched neither EXISTS
-- check in the visibility clause, so RLS hid it from EVERYONE — the post's
-- own comment count (from get_post_engagement_summary, a SECURITY DEFINER
-- RPC that counts rows directly and bypasses RLS) showed "2 comments", but
-- PostCard's own SELECT * FROM post_comments (subject to RLS) returned zero
-- rows, rendering "No comments yet" despite the count. Confirmed live: a
-- comment could be posted (INSERT succeeded after 20261017090000 fixed
-- can_comment_on_post), but never read back.
--
-- sportrise_posts has no owner-based visibility (can_view_profile) or
-- per-post comments_disabled-vs-owner distinction to make — it's public,
-- official content, so the added branch just checks the post exists and
-- isn't comments_disabled, mirroring can_comment_on_post's own
-- sportrise_posts handling. No blocked_commenters/restricted_accounts
-- check either, for the same reason can_comment_on_post skips them: there's
-- no single account to block/restrict against for official content.
DROP POLICY IF EXISTS "View comments respecting blocks, restrictions, visibility and disabled" ON public.post_comments;
CREATE POLICY "View comments respecting blocks, restrictions, visibility and disabled"
  ON public.post_comments FOR SELECT TO authenticated
  USING (
    (
      EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_comments.post_id AND public.can_view_profile(p.user_id))
      OR EXISTS (SELECT 1 FROM public.scout_posts sp WHERE sp.id = post_comments.post_id AND public.can_view_profile(sp.user_id))
      OR EXISTS (SELECT 1 FROM public.sportrise_posts srp WHERE srp.id = post_comments.post_id)
    )
    AND (
      NOT EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_comments.post_id AND p.comments_disabled)
      AND NOT EXISTS (SELECT 1 FROM public.scout_posts sp WHERE sp.id = post_comments.post_id AND sp.comments_disabled)
      AND NOT EXISTS (SELECT 1 FROM public.sportrise_posts srp WHERE srp.id = post_comments.post_id AND srp.comments_disabled)
      OR auth.uid() = (SELECT user_id FROM public.posts WHERE id = post_comments.post_id)
      OR auth.uid() = (SELECT user_id FROM public.scout_posts WHERE id = post_comments.post_id)
    )
    AND (
      user_id = auth.uid()
      OR (
        NOT EXISTS (
          SELECT 1 FROM public.posts p
          JOIN public.blocked_commenters bc ON bc.blocker_id = p.user_id AND bc.blocked_id = post_comments.user_id
          WHERE p.id = post_comments.post_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM public.scout_posts sp
          JOIN public.blocked_commenters bc ON bc.blocker_id = sp.user_id AND bc.blocked_id = post_comments.user_id
          WHERE sp.id = post_comments.post_id
        )
        AND (
          NOT EXISTS (
            SELECT 1 FROM public.posts p
            JOIN public.restricted_accounts ra ON ra.restrictor_id = p.user_id AND ra.restricted_id = post_comments.user_id
            WHERE p.id = post_comments.post_id
          )
          OR auth.uid() = (SELECT user_id FROM public.posts WHERE id = post_comments.post_id)
          OR auth.uid() = (SELECT user_id FROM public.scout_posts WHERE id = post_comments.post_id)
        )
      )
    )
  );
