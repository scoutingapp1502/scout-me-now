-- Returns the count of likes visible to a specific viewer,
-- excluding likes from users who set feed_activity_visibility = 'no_one'
-- (unless the viewer is the liker themselves).
create or replace function get_visible_likes_count(p_post_id uuid, p_viewer_id uuid)
returns integer
language sql
security definer
as $$
  select count(*)::integer
  from post_likes pl
  left join user_privacy_settings ups on ups.user_id = pl.user_id
  where pl.post_id = p_post_id
    and (
      pl.user_id = p_viewer_id
      or coalesce(ups.feed_activity_visibility, 'followers') <> 'no_one'
    );
$$;
