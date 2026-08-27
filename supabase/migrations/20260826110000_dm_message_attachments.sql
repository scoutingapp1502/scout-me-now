-- File attachments for 1:1 direct messages (Docs tab in conversation media view),
-- mirroring the group chat attachment support added in 20260826100000.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS attachment_url text NULL,
  ADD COLUMN IF NOT EXISTS attachment_name text NULL,
  ADD COLUMN IF NOT EXISTS attachment_size integer NULL,
  ADD COLUMN IF NOT EXISTS attachment_type text NULL;

-- Non-recursive participant check, mirrors is_group_member() for group chat.
CREATE OR REPLACE FUNCTION public.is_conversation_participant(p_conversation_id uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversations
    WHERE id = p_conversation_id AND (user1_id = auth.uid() OR user2_id = auth.uid())
  );
$$;

-- Storage bucket for uploaded files, one folder per conversation ("{conversation_id}/{filename}").
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-attachments', 'message-attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Conversation participants can upload attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'message-attachments' AND public.is_conversation_participant((storage.foldername(name))[1]::uuid));

CREATE POLICY "Conversation participants can delete their attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'message-attachments' AND public.is_conversation_participant((storage.foldername(name))[1]::uuid));

CREATE POLICY "Anyone can read message attachments"
  ON storage.objects FOR SELECT
  TO public
  USING (bucket_id = 'message-attachments');
