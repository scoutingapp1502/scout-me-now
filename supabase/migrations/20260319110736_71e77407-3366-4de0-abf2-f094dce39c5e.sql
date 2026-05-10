
-- Add documents column to scout_certifications
ALTER TABLE public.scout_certifications ADD COLUMN documents text[] DEFAULT '{}'::text[];

-- Create storage bucket for scout documents
INSERT INTO storage.buckets (id, name, public) VALUES ('scout-documents', 'scout-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload to scout-documents bucket
CREATE POLICY "Authenticated users can upload scout documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'scout-documents');

-- Allow authenticated users to read scout documents
CREATE POLICY "Anyone can read scout documents"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'scout-documents');

-- Allow users to delete their own scout documents
CREATE POLICY "Users can delete own scout documents"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'scout-documents' AND (storage.foldername(name))[1] = auth.uid()::text);
