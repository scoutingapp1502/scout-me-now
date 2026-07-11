alter table public.user_privacy_settings
  add column if not exists tags_visibility text not null default 'everyone'
    check (tags_visibility in ('everyone', 'following', 'no_one')),
  add column if not exists manually_approve_tags boolean not null default false,
  add column if not exists mentions_visibility text not null default 'everyone'
    check (mentions_visibility in ('everyone', 'following', 'no_one'));
