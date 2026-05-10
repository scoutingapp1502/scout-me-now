CREATE POLICY "Players can update collaboration requests"
ON public.agent_collaboration_requests
FOR UPDATE
TO public
USING (auth.uid() = player_user_id AND has_role(auth.uid(), 'player'::app_role));