create table if not exists public.user_favourites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  favourite_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, favourite_user_id)
);

alter table public.user_favourites enable row level security;

create policy "user_favourites_select" on public.user_favourites for select using (auth.uid() = user_id);
create policy "user_favourites_insert" on public.user_favourites for insert with check (auth.uid() = user_id);
create policy "user_favourites_delete" on public.user_favourites for delete using (auth.uid() = user_id);
