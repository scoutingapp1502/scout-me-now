-- Run this in Supabase SQL Editor to apply the "Arhivă" cross-role fix.
-- Fixes: archiving a Descoperitor's (scout_posts) post silently did
-- nothing server-side (UPDATE matched 0 rows on public.posts, the only
-- table the button ever wrote to) — the post reappeared after reload.
-- Also: scout_posts had no way to represent "archived" at all, so an
-- archived post would have stayed publicly visible even after this fix's
-- app-code changes, until this column existed.

-- ===== 20260811091000_scout_posts_archive_support.sql =====
ALTER TABLE public.scout_posts ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_scout_posts_is_archived ON public.scout_posts (user_id, is_archived) WHERE is_archived = true;
