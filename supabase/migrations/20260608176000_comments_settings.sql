alter table public.user_privacy_settings
  add column if not exists posts_comments_visibility text not null default 'everyone'
    check (posts_comments_visibility in ('everyone', 'following', 'followers', 'no_one')),
  add column if not exists stories_comments_visibility text not null default 'everyone'
    check (stories_comments_visibility in ('everyone', 'following', 'followers', 'no_one')),
  add column if not exists hide_unwanted_comments text not null default 'some'
    check (hide_unwanted_comments in ('off', 'some', 'more'));

-- Blocked commenters table
create table if not exists public.blocked_commenters (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(blocker_id, blocked_id)
);

alter table public.blocked_commenters enable row level security;

create policy "blocked_commenters_select" on public.blocked_commenters for select using (auth.uid() = blocker_id);
create policy "blocked_commenters_insert" on public.blocked_commenters for insert with check (auth.uid() = blocker_id);
create policy "blocked_commenters_delete" on public.blocked_commenters for delete using (auth.uid() = blocker_id);
