create table if not exists public.user_privacy_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  feed_activity_visibility text not null default 'followers'
    check (feed_activity_visibility in ('followers', 'no_one')),
  updated_at timestamptz not null default now()
);

alter table public.user_privacy_settings enable row level security;

create policy "privacy_settings_select_all"
  on public.user_privacy_settings for select
  using (true);

create policy "privacy_settings_insert_own"
  on public.user_privacy_settings for insert
  with check (auth.uid() = user_id);

create policy "privacy_settings_update_own"
  on public.user_privacy_settings for update
  using (auth.uid() = user_id);
