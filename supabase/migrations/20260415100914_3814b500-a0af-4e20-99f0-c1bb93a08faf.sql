-- Allow agents to insert collaboration requests (agent-initiated)
CREATE POLICY "Agents can create collaboration requests"
ON public.agent_collaboration_requests
FOR INSERT
WITH CHECK (auth.uid() = agent_user_id AND has_role(auth.uid(), 'agent'::app_role));

-- Allow agents to delete collaboration requests
CREATE POLICY "Agents can delete collaboration requests"
ON public.agent_collaboration_requests
FOR DELETE
USING (auth.uid() = agent_user_id AND has_role(auth.uid(), 'agent'::app_role));