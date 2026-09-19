-- Rejected posts are now deleted outright (see reject-post Edge Function)
-- instead of just flipping moderation_status — they were only ever kept
-- around as rejected rows to show a badge, and take up storage/DB space for
-- no further purpose once the decision is final. Since the row disappears,
-- a durable counter is needed for the author to still see how many of their
-- posts have been rejected over time.
ALTER TABLE public.player_profiles
  ADD COLUMN IF NOT EXISTS rejected_posts_count integer NOT NULL DEFAULT 0;

-- Called by the reject-post Edge Function (service role) after deleting a
-- post's row/files — a plain atomic increment, admin-review flow only, not
-- exposed to authenticated clients directly.
CREATE OR REPLACE FUNCTION public.increment_rejected_posts_count(p_user_id uuid)
RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  UPDATE public.player_profiles SET rejected_posts_count = rejected_posts_count + 1 WHERE user_id = p_user_id;
$$;

-- Only the owner and admins may ever read this — it's a private moderation
-- history, not part of the public profile.
CREATE OR REPLACE FUNCTION public.get_my_moderation_counts()
RETURNS TABLE (pending_count bigint, rejected_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.posts WHERE user_id = auth.uid() AND moderation_status IN ('pending', 'flagged')),
    (SELECT COALESCE(rejected_posts_count, 0) FROM public.player_profiles WHERE user_id = auth.uid());
$$;

GRANT EXECUTE ON FUNCTION public.get_my_moderation_counts() TO authenticated;
