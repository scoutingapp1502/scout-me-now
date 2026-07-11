-- PostCard now subscribes to post_likes/post_comments filtered by
-- post_id=eq.<id> so a post's like/comment counts update live for anyone
-- viewing it. Filtering on a DELETE event requires the old row's post_id
-- (and user_id, used to avoid double-counting the acting user's own
-- optimistic update) to be present, which needs REPLICA IDENTITY FULL.
ALTER TABLE public.post_likes REPLICA IDENTITY FULL;
ALTER TABLE public.post_comments REPLICA IDENTITY FULL;
