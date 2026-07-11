alter table public.user_privacy_settings
  add column if not exists hide_like_share_counts boolean not null default false;
