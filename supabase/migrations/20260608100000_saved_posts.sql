-- Collections table
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.collections enable row level security;

create policy "Users can view own collections"
  on public.collections for select using (auth.uid() = user_id);

create policy "Users can insert own collections"
  on public.collections for insert with check (auth.uid() = user_id);

create policy "Users can update own collections"
  on public.collections for update using (auth.uid() = user_id);

create policy "Users can delete own collections"
  on public.collections for delete using (auth.uid() = user_id);

-- Saved posts table
create table if not exists public.saved_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  collection_id uuid references public.collections(id) on delete set null,
  created_at timestamptz not null default now(),
  unique(user_id, post_id)
);

alter table public.saved_posts enable row level security;

create policy "Users can view own saved posts"
  on public.saved_posts for select using (auth.uid() = user_id);

create policy "Users can insert own saved posts"
  on public.saved_posts for insert with check (auth.uid() = user_id);

create policy "Users can delete own saved posts"
  on public.saved_posts for delete using (auth.uid() = user_id);
