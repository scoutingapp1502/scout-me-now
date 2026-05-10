
CREATE TABLE public.player_career_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  team_name TEXT NOT NULL DEFAULT '',
  start_date DATE,
  end_date DATE,
  currently_active BOOLEAN NOT NULL DEFAULT false,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.player_career_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own career entries"
  ON public.player_career_entries FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own career entries"
  ON public.player_career_entries FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own career entries"
  ON public.player_career_entries FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own career entries"
  ON public.player_career_entries FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Anyone can view career entries"
  ON public.player_career_entries FOR SELECT
  TO anon
  USING (true);
