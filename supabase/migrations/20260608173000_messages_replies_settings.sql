alter table public.user_privacy_settings
  add column if not exists message_requests_visibility text not null default 'everyone'
    check (message_requests_visibility in ('everyone', 'following', 'no_one')),
  add column if not exists story_replies_visibility text not null default 'everyone'
    check (story_replies_visibility in ('everyone', 'following', 'no_one'));
