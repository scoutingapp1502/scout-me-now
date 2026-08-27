-- Club logos, matched against the free-text "current team" field on player profiles
CREATE TABLE public.club_logos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_name text NOT NULL UNIQUE,
  logo_url text NOT NULL,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.club_logos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view club logos"
  ON public.club_logos FOR SELECT
  USING (true);

CREATE POLICY "Admins can insert club logos"
  ON public.club_logos FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update club logos"
  ON public.club_logos FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete club logos"
  ON public.club_logos FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_club_logos_updated_at
  BEFORE UPDATE ON public.club_logos
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket for club logo image files (public read, admin-only write)
INSERT INTO storage.buckets (id, name, public)
VALUES ('club-logos', 'club-logos', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view club logo files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'club-logos');

CREATE POLICY "Admins can upload club logo files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'club-logos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update club logo files"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'club-logos' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete club logo files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'club-logos' AND has_role(auth.uid(), 'admin'::app_role));
