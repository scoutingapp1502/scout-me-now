-- "Who liked this" becomes private to the content's own author — explicit
-- product decision, replacing the previous Instagram-style "anyone can see
-- who liked" behavior. The like COUNT stays visible to everyone exactly as
-- before (it's read through separate SECURITY DEFINER RPCs —
-- get_post_engagement_summary for posts, a plain client SELECT with no
-- ownership check for comment_likes' count — neither of which this
-- migration touches), only the actual LIST of accounts is restricted.
--
-- post_likes: its own direct-SELECT RLS policy is what PostCard.tsx's
-- loadLikers() reads from, so narrowing that policy itself is enough — no
-- new RPC needed. Narrowed to: your own like row, or the post's author.
-- (The post's author already had unconditional access via this exact
-- EXISTS clause in the prior policy; every OTHER account's access —
-- gated on the liker's own feed_activity_visibility setting — is removed.)
DROP POLICY IF EXISTS "Post likes respect author account visibility" ON public.post_likes;
CREATE POLICY "Post likes visible to own like and post author only"
  ON public.post_likes FOR SELECT TO authenticated
  USING (
    post_likes.user_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.posts p WHERE p.id = post_likes.post_id AND p.user_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.scout_posts sp WHERE sp.id = post_likes.post_id AND sp.user_id = auth.uid())
  );

-- comment_likes has no per-row visibility policy narrow enough to reuse for
-- this — its SELECT policy stays USING (true) because PostCard.tsx's
-- loadComments() reads comment_likes directly to compute each comment's
-- likes_count for EVERY comment shown to EVERY viewer (not just the
-- comment's own author), and narrowing the policy would silently break
-- that count for non-owners. Instead, the LIST of who liked a specific
-- comment is exposed only through this new RPC, which enforces ownership
-- itself; PostCard.tsx calls this instead of a direct SELECT.
CREATE OR REPLACE FUNCTION public.get_comment_likers(p_comment_id uuid)
RETURNS TABLE (user_id uuid, created_at timestamptz)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _comment_owner uuid;
BEGIN
  SELECT pc.user_id INTO _comment_owner FROM public.post_comments pc WHERE pc.id = p_comment_id;
  IF _comment_owner IS NULL THEN
    RAISE EXCEPTION 'Comment not found';
  END IF;
  IF _comment_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT cl.user_id, cl.created_at FROM public.comment_likes cl
  WHERE cl.comment_id = p_comment_id
  ORDER BY cl.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_comment_likers(uuid) TO authenticated;
