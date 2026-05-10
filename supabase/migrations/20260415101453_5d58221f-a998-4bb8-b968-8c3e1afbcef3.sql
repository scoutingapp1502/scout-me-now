
CREATE TABLE public.agent_manual_players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_user_id UUID NOT NULL,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  position TEXT,
  birth_year INTEGER,
  current_team TEXT,
  photo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.agent_manual_players ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents can view own manual players"
ON public.agent_manual_players FOR SELECT
USING (auth.uid() = agent_user_id);

CREATE POLICY "Agents can insert own manual players"
ON public.agent_manual_players FOR INSERT
WITH CHECK (auth.uid() = agent_user_id AND has_role(auth.uid(), 'agent'::app_role));

CREATE POLICY "Agents can update own manual players"
ON public.agent_manual_players FOR UPDATE
USING (auth.uid() = agent_user_id AND has_role(auth.uid(), 'agent'::app_role));

CREATE POLICY "Agents can delete own manual players"
ON public.agent_manual_players FOR DELETE
USING (auth.uid() = agent_user_id AND has_role(auth.uid(), 'agent'::app_role));
