create table if not exists public.post_tags (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  tagged_user_id uuid not null references auth.users(id) on delete cascade,
  tagged_by_user_id uuid not null references auth.users(id) on delete cascade,
  is_visible_on_profile boolean not null default true,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  unique(post_id, tagged_user_id)
);

alter table public.post_tags enable row level security;

-- Tagged user and post owner can see the tag
create policy "post_tags_select" on public.post_tags for select
  using (
    auth.uid() = tagged_user_id
    or auth.uid() = tagged_by_user_id
    or auth.uid() = (select user_id from public.posts where id = post_id limit 1)
  );

-- Anyone can tag others (insert)
create policy "post_tags_insert" on public.post_tags for insert
  with check (auth.uid() = tagged_by_user_id);

-- Only tagged user can update visibility/hidden
create policy "post_tags_update" on public.post_tags for update
  using (auth.uid() = tagged_user_id);

-- Tagged user or post owner can remove tag
create policy "post_tags_delete" on public.post_tags for delete
  using (auth.uid() = tagged_user_id or auth.uid() = tagged_by_user_id);
