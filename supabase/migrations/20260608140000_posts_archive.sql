alter table public.posts add column if not exists is_archived boolean not null default false;

-- Users can archive their own posts
create policy "Users can update own posts archive"
  on public.posts for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
