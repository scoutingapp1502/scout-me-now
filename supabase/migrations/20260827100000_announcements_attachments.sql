-- Allow announcements to carry an optional image, video, and/or documents
ALTER TABLE public.announcements
  ADD COLUMN image_url text NULL,
  ADD COLUMN video_url text NULL,
  ADD COLUMN document_urls text[] NOT NULL DEFAULT '{}'::text[];
