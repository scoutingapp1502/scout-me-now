-- Run this in Supabase SQL Editor to apply the "Salvat" cross-role fix.
-- Fixes: saving a Descoperitor's (scout_posts) post always failed with a
-- foreign-key violation, for every role, because saved_posts.post_id only
-- ever referenced public.posts(id).

-- ===== 20260811090000_saved_posts_support_scout_posts.sql =====
ALTER TABLE public.saved_posts DROP CONSTRAINT IF EXISTS saved_posts_post_id_fkey;

ALTER TABLE public.saved_posts
  ADD COLUMN IF NOT EXISTS post_source text NOT NULL DEFAULT 'posts'
    CHECK (post_source IN ('posts', 'scout_posts'));
