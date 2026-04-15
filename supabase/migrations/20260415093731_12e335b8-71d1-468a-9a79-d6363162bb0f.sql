
-- Create agent collaboration requests table
CREATE TABLE public.agent_collaboration_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  player_user_id UUID NOT NULL,
  agent_user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(player_user_id, agent_user_id)
);

-- Enable RLS
ALTER TABLE public.agent_collaboration_requests ENABLE ROW LEVEL SECURITY;

-- Players can view their own requests
CREATE POLICY "Players can view own collaboration requests"
ON public.agent_collaboration_requests
FOR SELECT
USING (auth.uid() = player_user_id OR auth.uid() = agent_user_id);

-- Players can create collaboration requests
CREATE POLICY "Players can create collaboration requests"
ON public.agent_collaboration_requests
FOR INSERT
WITH CHECK (auth.uid() = player_user_id AND public.has_role(auth.uid(), 'player'));

-- Agents can update requests sent to them (accept/reject)
CREATE POLICY "Agents can update collaboration requests"
ON public.agent_collaboration_requests
FOR UPDATE
USING (auth.uid() = agent_user_id AND (public.has_role(auth.uid(), 'agent') OR public.has_role(auth.uid(), 'scout')));

-- Players can delete/cancel their pending requests
CREATE POLICY "Players can cancel own pending requests"
ON public.agent_collaboration_requests
FOR DELETE
USING (auth.uid() = player_user_id AND status = 'pending');

-- Trigger for updated_at
CREATE TRIGGER update_agent_collaboration_requests_updated_at
BEFORE UPDATE ON public.agent_collaboration_requests
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
