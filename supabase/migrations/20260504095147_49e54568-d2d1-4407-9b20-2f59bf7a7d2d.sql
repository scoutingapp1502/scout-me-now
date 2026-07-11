
CREATE TABLE public.video_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  test_key text NOT NULL,
  video_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  grade numeric(3,1) NULL,
  reviewer_notes text NULL,
  reviewed_by uuid NULL,
  reviewed_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.video_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Players can submit videos"
  ON public.video_submissions FOR INSERT
  WITH CHECK (auth.uid() = user_id AND has_role(auth.uid(), 'player'::app_role));

CREATE POLICY "Authenticated can view all video submissions"
  ON public.video_submissions FOR SELECT
  USING (true);

CREATE POLICY "Admins can update video submissions"
  ON public.video_submissions FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_video_submissions_updated_at
  BEFORE UPDATE ON public.video_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
