-- Fix constraint to use 'followers' instead of 'following'
alter table public.user_privacy_settings
  drop constraint if exists user_privacy_settings_message_requests_visibility_check;

update public.user_privacy_settings
  set message_requests_visibility = 'followers'
  where message_requests_visibility = 'following';

alter table public.user_privacy_settings
  add constraint user_privacy_settings_message_requests_visibility_check
  check (message_requests_visibility in ('everyone', 'followers', 'no_one'));

-- New columns
alter table public.user_privacy_settings
  add column if not exists group_chat_visibility text not null default 'everyone'
    check (group_chat_visibility in ('everyone', 'following_or_messaged')),
  add column if not exists hide_unwanted_requests boolean not null default true;
