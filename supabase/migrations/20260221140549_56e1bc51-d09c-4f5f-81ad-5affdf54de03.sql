-- Create storage bucket for player videos
INSERT INTO storage.buckets (id, name, public)
VALUES ('player-videos', 'player-videos', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload their own videos
CREATE POLICY "Players can upload own videos"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'player-videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow anyone to view player videos (public profiles)
CREATE POLICY "Anyone can view player videos"
ON storage.objects
FOR SELECT
USING (bucket_id = 'player-videos');

-- Allow players to delete their own videos
CREATE POLICY "Players can delete own videos"
ON storage.objects
FOR DELETE
USING (
  bucket_id = 'player-videos'
  AND auth.uid()::text = (storage.foldername(name))[1]
);
