alter table public.user_privacy_settings
  drop constraint if exists user_privacy_settings_posts_comments_visibility_check;

alter table public.user_privacy_settings
  add constraint user_privacy_settings_posts_comments_visibility_check
    check (posts_comments_visibility in ('everyone', 'following', 'followers', 'following_and_followers', 'no_one'));
