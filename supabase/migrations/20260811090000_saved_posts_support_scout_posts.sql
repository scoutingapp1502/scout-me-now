-- "Salvat" (SavedSection.tsx) only ever worked for posts in public.posts.
-- PersonalProfile.tsx's PostsTab renders BOTH public.posts and
-- public.scout_posts rows through the same <PostCard>, and PostCard's save
-- button (toggleSave) writes to saved_posts for whichever post is on
-- screen — but saved_posts.post_id had a hard FK to public.posts(id) only.
-- Saving a Descoperitor's (scout_posts) post therefore always failed with a
-- foreign-key violation, for every role, silently surfaced only as a
-- generic "Nu s-a putut salva" toast.
--
-- Fix: drop the single-table FK (posts and scout_posts are two independent
-- tables with overlapping id spaces, so a single FK can't reference "either
-- table" — this mirrors how deleted_at soft-delete already treats them as
-- parallel, un-joined sources elsewhere in the app) and add a post_source
-- column so callers can tell which table a saved row's post_id belongs to.
-- Existing rows all predate scout_posts support here, so they safely
-- backfill to 'posts'.

ALTER TABLE public.saved_posts DROP CONSTRAINT IF EXISTS saved_posts_post_id_fkey;

ALTER TABLE public.saved_posts
  ADD COLUMN IF NOT EXISTS post_source text NOT NULL DEFAULT 'posts'
    CHECK (post_source IN ('posts', 'scout_posts'));

-- The original unique(user_id, post_id) constraint stays valid: post ids
-- are gen_random_uuid()-generated per table, so a collision between a
-- posts.id and a scout_posts.id is not realistically possible, and even in
-- that edge case the same user saving "the same id twice" is still exactly
-- the double-save this constraint is meant to prevent.
