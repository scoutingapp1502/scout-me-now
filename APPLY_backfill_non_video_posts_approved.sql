-- 20260927090000_video_moderation_schema.sql set moderation_status DEFAULT
-- 'pending' on every row in posts, but only a post WITH a video ever goes
-- through the moderation pipeline (NewPostComposer.tsx only calls
-- moderateUploadedVideo when a video file was attached). Any text-only or
-- image-only post created since that migration was inserted as 'pending'
-- and had nothing that would ever move it to 'approved' — RLS and
-- get_activity_feed both treat 'pending' as "only the author can see this",
-- so those posts silently became invisible to everyone else, forever.
--
-- This is a one-time backfill for posts already stuck this way: anything
-- with no video is approved outright (nothing to moderate). Posts that DO
-- have a video are left untouched — those may legitimately still be
-- pending/flagged/rejected and must go through the real pipeline.
UPDATE public.posts
SET moderation_status = 'approved'
WHERE moderation_status = 'pending' AND video_url IS NULL;
