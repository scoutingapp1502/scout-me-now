-- "Arhivă" (ArchiveSection.tsx) → "Postări arhivate" only ever read from
-- public.posts (WHERE is_archived = true). PersonalProfile.tsx's PostsTab
-- renders scout_posts rows through the same <PostCard> as posts rows, and
-- PostCard's archive button (handleArchive) unconditionally wrote
-- UPDATE posts SET is_archived = true — for a Descoperitor's own post
-- (which lives in scout_posts, not posts), that UPDATE matches zero rows
-- (no error, since UPDATE with no match isn't a Postgres error), so the
-- post silently stayed un-archived server-side while the client removed it
-- from view via onDelete(post.id) — the post would then reappear on next
-- reload/re-fetch since it was never actually archived.
--
-- scout_posts never had an is_archived column at all (it does have
-- deleted_at from 20260724090000, but that's the separate soft-delete
-- feature, not archive). This adds it, mirroring public.posts.
ALTER TABLE public.scout_posts ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_scout_posts_is_archived ON public.scout_posts (user_id, is_archived) WHERE is_archived = true;

-- The existing "Scouts and agents can update own posts" UPDATE policy
-- (auth.uid() = user_id AND has scout/agent/cauta_jucator role) already
-- covers writing this new column — no RLS change needed.
