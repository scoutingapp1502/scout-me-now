
DROP POLICY "Players can cancel own pending requests" ON public.agent_collaboration_requests;

CREATE POLICY "Players can delete own collaboration requests"
ON public.agent_collaboration_requests
FOR DELETE
USING (auth.uid() = player_user_id);
