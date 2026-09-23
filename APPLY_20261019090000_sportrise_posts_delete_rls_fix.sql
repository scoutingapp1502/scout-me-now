-- Root cause of the 403 on deleting a sportrise_post from admin (extensively
-- diagnosed live, see chat history): "Anyone authenticated can read
-- sportrise posts" (SELECT policy) is USING (deleted_at IS NULL AND
-- is_archived = false). An admin's soft-delete does exactly
-- UPDATE sportrise_posts SET deleted_at = now() — the moment that commits,
-- the row it just wrote to no longer satisfies the SELECT policy. PostgREST
-- always evaluates a post-UPDATE RETURNING against the SELECT policy (not
-- just the UPDATE policy's WITH CHECK), regardless of whether the client
-- asked for Prefer: return=representation, and reports the mismatch as a
-- generic 42501 "new row violates row-level security policy" — this is why
-- every isolated test of the UPDATE policy itself (has_role, direct EXISTS
-- on user_roles, different auth.uid() contexts) kept succeeding while the
-- real UPDATE kept failing: the UPDATE policy was never the problem, the
-- SELECT policy's post-write visibility was.
--
-- Same class of bug already fixed for posts (its own policy has
-- "OR auth.uid() = user_id OR has_role(admin)" precisely so the author/an
-- admin can still see a row they just soft-deleted). sportrise_posts has no
-- per-row owner to check against — content_by is who published it, not a
-- live "current user" concept an admin action should be scoped to — so the
-- added clause is simply "OR has_role(auth.uid(), 'admin')", letting any
-- admin see a sportrise_post regardless of deleted_at/is_archived.
DROP POLICY IF EXISTS "Anyone authenticated can read sportrise posts" ON public.sportrise_posts;
CREATE POLICY "Anyone authenticated can read sportrise posts"
  ON public.sportrise_posts FOR SELECT TO authenticated
  USING (
    (deleted_at IS NULL AND is_archived = false)
    OR public.has_role(auth.uid(), 'admin'::app_role)
  );

-- Restores the UPDATE policy to its real, intended form — a prior live
-- diagnostic step (see chat) temporarily replaced it with an EXISTS-based
-- test version ("Admins can update sportrise posts (test)") to rule out
-- has_role() itself as the cause; that test policy must not stay live.
DROP POLICY IF EXISTS "Admins can update sportrise posts (test)" ON public.sportrise_posts;
DROP POLICY IF EXISTS "Admins can update sportrise posts" ON public.sportrise_posts;
CREATE POLICY "Admins can update sportrise posts"
  ON public.sportrise_posts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
