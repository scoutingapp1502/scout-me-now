-- Group conversations table (no RLS yet)
create table if not exists public.group_conversations (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Group members table (must exist before the helper function)
create table if not exists public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.group_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  unique(group_id, user_id)
);

-- Group messages table
create table if not exists public.group_messages (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.group_conversations(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  content text not null,
  created_at timestamptz not null default now()
);

-- Helper: non-recursive membership check (security definer bypasses RLS)
create or replace function public.is_group_member(p_group_id uuid)
returns boolean language sql security definer as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid()
  );
$$;

-- RLS
alter table public.group_conversations enable row level security;
alter table public.group_members        enable row level security;
alter table public.group_messages       enable row level security;

create policy "group_conv_select"   on public.group_conversations for select using (is_group_member(id));
create policy "group_conv_insert"   on public.group_conversations for insert with check (auth.uid() = created_by);
create policy "group_conv_update"   on public.group_conversations for update using (is_group_member(id));

create policy "group_members_select" on public.group_members for select using (is_group_member(group_id));
create policy "group_members_insert" on public.group_members for insert
  with check (
    exists (select 1 from public.group_conversations where id = group_id and created_by = auth.uid())
  );

create policy "group_messages_select" on public.group_messages for select   using (is_group_member(group_id));
create policy "group_messages_insert" on public.group_messages for insert   with check (auth.uid() = sender_id and is_group_member(group_id));
