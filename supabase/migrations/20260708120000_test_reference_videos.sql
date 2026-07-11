CREATE TABLE public.test_reference_videos (
  test_key text PRIMARY KEY,
  video_url text NOT NULL,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.test_reference_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view test reference videos"
  ON public.test_reference_videos FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert test reference videos"
  ON public.test_reference_videos FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update test reference videos"
  ON public.test_reference_videos FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete test reference videos"
  ON public.test_reference_videos FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_test_reference_videos_updated_at
  BEFORE UPDATE ON public.test_reference_videos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
