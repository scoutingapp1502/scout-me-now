create table if not exists public.scout_uploaded_reports (
  id uuid primary key default gen_random_uuid(),
  scout_user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  description text,
  file_url text not null,
  file_name text,
  created_at timestamptz not null default now()
);

alter table public.scout_uploaded_reports enable row level security;

create policy "Scout can manage own uploaded reports"
  on public.scout_uploaded_reports
  for all
  to authenticated
  using (scout_user_id = auth.uid())
  with check (scout_user_id = auth.uid());

create policy "Public can read scout uploaded reports"
  on public.scout_uploaded_reports
  for select
  to public
  using (true);
