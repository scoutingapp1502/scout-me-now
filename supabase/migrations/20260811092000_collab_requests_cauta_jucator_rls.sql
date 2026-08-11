-- "Agents can update collaboration requests" (agent_collaboration_requests)
-- still checked has_role(auth.uid(), 'agent') OR has_role(auth.uid(), 'scout')
-- — never 'cauta_jucator'. In practice this policy is never actually
-- exercised: NotificationsSection.tsx's accept/reject buttons call the
-- SECURITY DEFINER RPCs accept_collaboration_request/
-- reject_collaboration_request, which bypass RLS entirely and only check
-- auth.uid() against the request's agent_user_id/player_user_id (not
-- role). Still, this is defense-in-depth: any direct UPDATE from a
-- Descoperitor account (e.g. a future feature, or the Supabase client used
-- directly) would be silently rejected by this stale policy.
DROP POLICY IF EXISTS "Agents can update collaboration requests" ON public.agent_collaboration_requests;
CREATE POLICY "Agents can update collaboration requests"
ON public.agent_collaboration_requests
FOR UPDATE
USING (auth.uid() = agent_user_id AND (
  has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'cauta_jucator'::app_role)
));
