-- These tables are queried heavily by the app (see follows/posts/post_comments/
-- stories/group_messages/group_members usage in src/) but only had a primary
-- key and, for follows, a composite UNIQUE(follower_id, following_id) — which
-- does not serve lookups filtered on following_id alone. Add the indexes that
-- match the app's actual access patterns.

-- "who follows me" / notification lookups filter on following_id alone
CREATE INDEX IF NOT EXISTS idx_follows_following_id ON public.follows (following_id);
CREATE INDEX IF NOT EXISTS idx_follows_follower_id ON public.follows (follower_id);

-- feed/profile queries filter posts by user_id
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON public.posts (user_id);

-- comment counts/lists filter by post_id, comment ownership checks by user_id
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments (post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON public.post_comments (user_id);

-- story rings/archive filter by user_id, and the "active stories" RLS policy
-- and app queries both filter on expires_at
CREATE INDEX IF NOT EXISTS idx_stories_user_id ON public.stories (user_id);
CREATE INDEX IF NOT EXISTS idx_stories_expires_at ON public.stories (expires_at);

-- group chat inbox/thread queries filter by group_id
CREATE INDEX IF NOT EXISTS idx_group_messages_group_id ON public.group_messages (group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON public.group_members (group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON public.group_members (user_id);
