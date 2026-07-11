alter table public.user_privacy_settings
  add column if not exists is_private_account boolean not null default false,
  add column if not exists allow_profile_pic_expansion boolean not null default false;
