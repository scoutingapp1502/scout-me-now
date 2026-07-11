alter table public.user_privacy_settings
  drop constraint if exists user_privacy_settings_stories_comments_visibility_check;

alter table public.user_privacy_settings
  add constraint user_privacy_settings_stories_comments_visibility_check
    check (stories_comments_visibility in ('everyone', 'following', 'no_one'));

-- Update existing rows that might have 'followers' to 'everyone' as fallback
update public.user_privacy_settings
  set stories_comments_visibility = 'everyone'
  where stories_comments_visibility = 'followers';
