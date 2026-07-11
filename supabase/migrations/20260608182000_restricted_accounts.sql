create table if not exists public.restricted_accounts (
  id uuid primary key default gen_random_uuid(),
  restrictor_id uuid not null references auth.users(id) on delete cascade,
  restricted_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(restrictor_id, restricted_id)
);

alter table public.restricted_accounts enable row level security;

create policy "restricted_accounts_select" on public.restricted_accounts for select using (auth.uid() = restrictor_id);
create policy "restricted_accounts_insert" on public.restricted_accounts for insert with check (auth.uid() = restrictor_id);
create policy "restricted_accounts_delete" on public.restricted_accounts for delete using (auth.uid() = restrictor_id);
