-- Create table if it was added to old DB without a migration
CREATE TABLE IF NOT EXISTS public.scout_player_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  player_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position TEXT,
  current_club TEXT,
  league TEXT,
  contract_until TEXT,
  salary_range TEXT,
  transfer_value TEXT,
  agent_name TEXT,
  overall_rating INTEGER,
  fit_rating INTEGER,
  technical_rating INTEGER,
  technical_notes TEXT,
  physical_rating INTEGER,
  physical_notes TEXT,
  mental_rating INTEGER,
  mental_notes TEXT,
  financial_notes TEXT,
  pros_list TEXT[],
  cons_list TEXT[],
  conclusion_text TEXT,
  recommendation TEXT,
  hidden_sections TEXT[] DEFAULT '{}',
  custom_sections JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(scout_user_id, player_user_id)
);

ALTER TABLE public.scout_player_reports ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'scout_player_reports' AND policyname = 'Scouts can manage own reports'
  ) THEN
    CREATE POLICY "Scouts can manage own reports"
      ON public.scout_player_reports FOR ALL
      USING (auth.uid() = scout_user_id);
  END IF;
END $$;

-- Add columns if table already existed without them
ALTER TABLE public.scout_player_reports
  ADD COLUMN IF NOT EXISTS hidden_sections text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS custom_sections jsonb DEFAULT '[]';
