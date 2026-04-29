
-- Table: scout_player_notes — private notes from a scouter about a player
CREATE TABLE public.scout_player_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  scout_user_id UUID NOT NULL,
  player_user_id UUID NOT NULL,
  label TEXT,
  personal_rating SMALLINT NOT NULL DEFAULT 0,
  observed_qualities TEXT[] NOT NULL DEFAULT '{}',
  match_watched TEXT,
  match_date DATE,
  observations TEXT,
  priority TEXT,
  custom_labels TEXT[] NOT NULL DEFAULT '{}',
  custom_qualities TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scout_user_id, player_user_id)
);

CREATE INDEX idx_scout_player_notes_scout ON public.scout_player_notes(scout_user_id);
CREATE INDEX idx_scout_player_notes_player ON public.scout_player_notes(player_user_id);

ALTER TABLE public.scout_player_notes ENABLE ROW LEVEL SECURITY;

-- Only the scouter who created the note can view/manage it
CREATE POLICY "Scouts view own notes"
ON public.scout_player_notes
FOR SELECT
USING (auth.uid() = scout_user_id);

CREATE POLICY "Scouts insert own notes"
ON public.scout_player_notes
FOR INSERT
WITH CHECK (auth.uid() = scout_user_id);

CREATE POLICY "Scouts update own notes"
ON public.scout_player_notes
FOR UPDATE
USING (auth.uid() = scout_user_id);

CREATE POLICY "Scouts delete own notes"
ON public.scout_player_notes
FOR DELETE
USING (auth.uid() = scout_user_id);

-- updated_at trigger (reuses public.update_updated_at_column if exists)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_scout_player_notes_updated_at
BEFORE UPDATE ON public.scout_player_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
