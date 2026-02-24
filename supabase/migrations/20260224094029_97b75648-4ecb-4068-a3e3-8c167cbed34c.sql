
-- Add document arrays to player_profiles
ALTER TABLE public.player_profiles
ADD COLUMN about_documents text[] DEFAULT '{}'::text[],
ADD COLUMN palmares_documents text[] DEFAULT '{}'::text[];

-- Create a dedicated bucket for player documents
INSERT INTO storage.buckets (id, name, public) VALUES ('player-documents', 'player-documents', true);

-- Storage policies for player-documents bucket
CREATE POLICY "Anyone can view player documents"
ON storage.objects FOR SELECT
USING (bucket_id = 'player-documents');

CREATE POLICY "Players can upload own documents"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'player-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Players can update own documents"
ON storage.objects FOR UPDATE
USING (bucket_id = 'player-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Players can delete own documents"
ON storage.objects FOR DELETE
USING (bucket_id = 'player-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
