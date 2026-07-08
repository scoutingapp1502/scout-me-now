alter table public.user_privacy_settings
  add column if not exists translate_reels_text boolean not null default true,
  add column if not exists translate_voice boolean not null default true;
