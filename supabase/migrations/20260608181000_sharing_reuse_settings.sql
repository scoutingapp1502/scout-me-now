alter table public.user_privacy_settings
  add column if not exists story_shares_enabled boolean not null default true,
  add column if not exists stories_to_stories text not null default 'everyone'
    check (stories_to_stories in ('everyone', 'followers_you_follow_back', 'off')),
  add column if not exists posts_to_stories_enabled boolean not null default true,
  add column if not exists reposts_enabled boolean not null default true;
