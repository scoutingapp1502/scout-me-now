-- File attachments for group chat messages (Docs tab in group media view).
ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS attachment_url text NULL,
  ADD COLUMN IF NOT EXISTS attachment_name text NULL,
  ADD COLUMN IF NOT EXISTS attachment_size integer NULL,
  ADD COLUMN IF NOT EXISTS attachment_type text NULL;

-- Storage bucket for uploaded files, one folder per group ("{group_id}/{filename}"),
-- gated by the existing is_group_member() helper so only members can upload/delete.
INSERT INTO storage.buckets (id, name, public)
VALUES ('group-attachments', 'group-attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Group members can upload attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'group-attachments' AND public.is_group_member((storage.foldername(name))[1]::uuid));

CREATE POLICY "Group members can delete their group's attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'group-attachments' AND public.is_group_member((storage.foldername(name))[1]::uuid));

CREATE POLICY "Anyone can read group attachments"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'group-attachments');
