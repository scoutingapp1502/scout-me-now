-- ScoutPersonalProfile.tsx has read/written public.scout_experiences for a
-- while (organization/role/location/start_date/end_date/description/skills),
-- but no migration in this repo ever created it — it must have been added
-- by hand in Supabase Studio previously and is missing from this database.
-- Recreated here mirroring the existing scout_education / scout_certifications
-- table + RLS pattern from 20260319103543_d0f26fb6-1154-4752-97be-0e37c389f1d5.sql.

CREATE TABLE IF NOT EXISTS public.scout_experiences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  organization text NOT NULL DEFAULT '',
  role text NOT NULL DEFAULT '',
  location text DEFAULT NULL,
  start_date text DEFAULT NULL,
  end_date text DEFAULT NULL,
  description text DEFAULT NULL,
  skills text[] DEFAULT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.scout_experiences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view all scout experiences" ON public.scout_experiences;
DROP POLICY IF EXISTS "Users can manage own scout experiences" ON public.scout_experiences;
DROP POLICY IF EXISTS "Users can update own scout experiences" ON public.scout_experiences;
DROP POLICY IF EXISTS "Users can delete own scout experiences" ON public.scout_experiences;

CREATE POLICY "Users can view all scout experiences" ON public.scout_experiences FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can manage own scout experiences" ON public.scout_experiences FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own scout experiences" ON public.scout_experiences FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own scout experiences" ON public.scout_experiences FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_scout_experiences_user_id ON public.scout_experiences (user_id);
