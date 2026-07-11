create table if not exists public.app_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null default current_date,
  duration_seconds integer not null default 0,
  created_at timestamptz not null default now(),
  unique (user_id, date)
);

alter table public.app_sessions enable row level security;

create policy "Users can read own sessions"
  on public.app_sessions for select using (auth.uid() = user_id);

create policy "Users can insert own sessions"
  on public.app_sessions for insert with check (auth.uid() = user_id);

create policy "Users can update own sessions"
  on public.app_sessions for update using (auth.uid() = user_id);
