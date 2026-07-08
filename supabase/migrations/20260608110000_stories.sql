-- Create stories bucket
insert into storage.buckets (id, name, public)
values ('stories', 'stories', true)
on conflict (id) do nothing;

-- Stories table
create table if not exists public.stories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  media_url text not null,
  caption text default '',
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);

alter table public.stories enable row level security;

create policy "Anyone can view active stories"
  on public.stories for select using (expires_at > now());

create policy "Users can insert own stories"
  on public.stories for insert with check (auth.uid() = user_id);

create policy "Users can delete own stories"
  on public.stories for delete using (auth.uid() = user_id);

-- Storage policies for stories bucket
create policy "Anyone can read stories"
  on storage.objects for select using (bucket_id = 'stories');

create policy "Authenticated users can upload stories"
  on storage.objects for insert
  with check (bucket_id = 'stories' and auth.role() = 'authenticated');

create policy "Users can delete own story media"
  on storage.objects for delete
  using (bucket_id = 'stories' and auth.uid()::text = (storage.foldername(name))[1]);
