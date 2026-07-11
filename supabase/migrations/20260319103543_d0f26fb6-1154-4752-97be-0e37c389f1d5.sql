
-- Education table
CREATE TABLE public.scout_education (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  institution text NOT NULL DEFAULT '',
  degree text NOT NULL DEFAULT '',
  field_of_study text DEFAULT NULL,
  start_date text DEFAULT NULL,
  end_date text DEFAULT NULL,
  description text DEFAULT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scout_education ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all scout education" ON public.scout_education FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage own scout education" ON public.scout_education FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scout education" ON public.scout_education FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own scout education" ON public.scout_education FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Certifications table
CREATE TABLE public.scout_certifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL DEFAULT '',
  issuing_organization text NOT NULL DEFAULT '',
  issue_date text DEFAULT NULL,
  expiry_date text DEFAULT NULL,
  credential_url text DEFAULT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scout_certifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all scout certifications" ON public.scout_certifications FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage own scout certifications" ON public.scout_certifications FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scout certifications" ON public.scout_certifications FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own scout certifications" ON public.scout_certifications FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Languages as array on scout_profiles
ALTER TABLE public.scout_profiles ADD COLUMN IF NOT EXISTS languages text[] DEFAULT NULL;
