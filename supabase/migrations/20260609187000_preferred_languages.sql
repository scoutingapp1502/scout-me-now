alter table public.user_privacy_settings
  add column if not exists preferred_languages text[] not null default '{en}';
