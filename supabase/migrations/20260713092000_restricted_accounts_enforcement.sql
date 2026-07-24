-- Restricted accounts previously only stored a row that nothing else in the
-- app ever checked. This wires up two of the effects promised by the
-- "How restrict works" sheet:
--   1. Restricted people don't see your online status.
--   2. Comments from someone you've restricted are only visible to you and
--      them (not to other viewers) — unlike a full block, which hides the
--      comment from everyone but its author.
-- The third promised effect (moving their messages into a separate
-- "requests" section) needs a real requests-inbox feature that doesn't
-- exist yet in the app, so it's intentionally left out of this pass.

-- Returns only a boolean so the restricted person's client can suppress
-- presence for that user, without exposing the restricted_accounts row
-- itself (which stays owner-only per its RLS policy — "we won't let them
-- know you restricted them").
CREATE OR REPLACE FUNCTION public.am_i_restricted_by(_other_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restricted_accounts
    WHERE restrictor_id = _other_user_id AND restricted_id = auth.uid()
  );
$$;

CREATE INDEX IF NOT EXISTS idx_restricted_accounts_restricted_id ON public.restricted_accounts (restricted_id);
CREATE INDEX IF NOT EXISTS idx_blocked_commenters_blocked_id ON public.blocked_commenters (blocked_id);

DROP POLICY IF EXISTS "Anyone authenticated can view comments" ON public.post_comments;
DROP POLICY IF EXISTS "View comments respecting blocks and restrictions" ON public.post_comments;
CREATE POLICY "View comments respecting blocks and restrictions"
  ON public.post_comments FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR (
      -- Fully blocked: invisible to everyone but the author.
      NOT EXISTS (
        SELECT 1 FROM public.posts p
        JOIN public.blocked_commenters bc ON bc.blocker_id = p.user_id AND bc.blocked_id = post_comments.user_id
        WHERE p.id = post_comments.post_id
      )
      AND (
        -- Restricted: invisible to everyone except the post owner and the author.
        NOT EXISTS (
          SELECT 1 FROM public.posts p
          JOIN public.restricted_accounts ra ON ra.restrictor_id = p.user_id AND ra.restricted_id = post_comments.user_id
          WHERE p.id = post_comments.post_id
        )
        OR auth.uid() = (SELECT user_id FROM public.posts WHERE id = post_comments.post_id)
      )
    )
  );
