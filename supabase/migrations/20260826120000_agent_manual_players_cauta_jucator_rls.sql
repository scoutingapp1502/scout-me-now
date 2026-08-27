-- agent_manual_players was missed when cauta_jucator was added alongside
-- scout/agent for "own scouting activity" RLS checks (see
-- 20260725100100_scout_profiles_cauta_jucator_rls.sql), so a cauta_jucator
-- user gets an RLS violation when adding a manually-entered represented player.
DROP POLICY IF EXISTS "Agents can insert own manual players" ON public.agent_manual_players;
CREATE POLICY "Agents can insert own manual players" ON public.agent_manual_players
  FOR INSERT TO public
  WITH CHECK (auth.uid() = agent_user_id AND (
    has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'cauta_jucator'::app_role)
  ));

DROP POLICY IF EXISTS "Agents can update own manual players" ON public.agent_manual_players;
CREATE POLICY "Agents can update own manual players" ON public.agent_manual_players
  FOR UPDATE TO public
  USING (auth.uid() = agent_user_id AND (
    has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'cauta_jucator'::app_role)
  ));

DROP POLICY IF EXISTS "Agents can delete own manual players" ON public.agent_manual_players;
CREATE POLICY "Agents can delete own manual players" ON public.agent_manual_players
  FOR DELETE TO public
  USING (auth.uid() = agent_user_id AND (
    has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'cauta_jucator'::app_role)
  ));
