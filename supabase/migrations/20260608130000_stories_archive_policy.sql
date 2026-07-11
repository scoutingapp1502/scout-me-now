-- Allow users to view their own stories regardless of expiry (for archive)
create policy "Users can view own stories archive"
  on public.stories for select using (auth.uid() = user_id);
