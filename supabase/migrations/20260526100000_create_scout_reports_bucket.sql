-- Create scout-reports storage bucket
insert into storage.buckets (id, name, public)
values ('scout-reports', 'scout-reports', true)
on conflict (id) do nothing;

-- Allow authenticated users to upload their own files
create policy "Scout can upload own reports"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'scout-reports' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to update/delete their own files
create policy "Scout can update own reports"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'scout-reports' AND (storage.foldername(name))[1] = auth.uid()::text);

create policy "Scout can delete own reports"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'scout-reports' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read (bucket is public, but explicit policy for authenticated users)
create policy "Public read scout reports"
  on storage.objects for select
  to public
  using (bucket_id = 'scout-reports');
