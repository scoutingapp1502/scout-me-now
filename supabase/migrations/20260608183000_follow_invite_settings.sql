alter table public.user_privacy_settings
  add column if not exists auto_confirm_followers boolean not null default false,
  add column if not exists flag_for_review boolean not null default true,
  add column if not exists invitation_code text;

-- Generate a unique 8-char alphanumeric code for existing rows that don't have one
update public.user_privacy_settings
  set invitation_code = upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 8))
  where invitation_code is null;
