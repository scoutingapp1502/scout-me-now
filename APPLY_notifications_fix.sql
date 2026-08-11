-- Run this in Supabase SQL Editor to apply the "Notificări" cross-role fix.
-- Defense-in-depth only: the RLS UPDATE policy on agent_collaboration_requests
-- still checked has_role('agent') OR has_role('scout'), never 'cauta_jucator'.
-- Not exploitable today (accept/reject buttons go through a SECURITY DEFINER
-- RPC that bypasses this policy), but any future direct UPDATE from a
-- Descoperitor account would have been silently rejected.

-- ===== 20260811092000_collab_requests_cauta_jucator_rls.sql =====
DROP POLICY IF EXISTS "Agents can update collaboration requests" ON public.agent_collaboration_requests;
CREATE POLICY "Agents can update collaboration requests"
ON public.agent_collaboration_requests
FOR UPDATE
USING (auth.uid() = agent_user_id AND (
  has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'cauta_jucator'::app_role)
));
