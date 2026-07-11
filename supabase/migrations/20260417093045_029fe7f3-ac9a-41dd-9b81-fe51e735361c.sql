-- Function to accept a collaboration request and update player profile atomically
CREATE OR REPLACE FUNCTION public.accept_collaboration_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req record;
  _agent_first text;
  _agent_last text;
  _agent_email text;
  _caller uuid := auth.uid();
BEGIN
  SELECT * INTO _req FROM public.agent_collaboration_requests WHERE id = _request_id;
  IF _req IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;

  -- Only the receiver of the request can accept
  IF _req.initiated_by = 'player' AND _caller <> _req.agent_user_id THEN
    RAISE EXCEPTION 'Only the agent can accept this request';
  END IF;
  IF _req.initiated_by = 'agent' AND _caller <> _req.player_user_id THEN
    RAISE EXCEPTION 'Only the player can accept this request';
  END IF;

  UPDATE public.agent_collaboration_requests
    SET status = 'accepted', updated_at = now()
    WHERE id = _request_id;

  SELECT first_name, last_name INTO _agent_first, _agent_last
    FROM public.scout_profiles WHERE user_id = _req.agent_user_id;

  SELECT email INTO _agent_email FROM auth.users WHERE id = _req.agent_user_id;

  UPDATE public.player_profiles
    SET agent_name = TRIM(COALESCE(_agent_first,'') || ' ' || COALESCE(_agent_last,'')),
        agent_email = COALESCE(_agent_email, agent_email)
    WHERE user_id = _req.player_user_id;
END;
$$;

-- Function to reject a collaboration request
CREATE OR REPLACE FUNCTION public.reject_collaboration_request(_request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _req record;
  _caller uuid := auth.uid();
BEGIN
  SELECT * INTO _req FROM public.agent_collaboration_requests WHERE id = _request_id;
  IF _req IS NULL THEN RAISE EXCEPTION 'Request not found'; END IF;

  IF _req.initiated_by = 'player' AND _caller <> _req.agent_user_id THEN
    RAISE EXCEPTION 'Only the agent can reject this request';
  END IF;
  IF _req.initiated_by = 'agent' AND _caller <> _req.player_user_id THEN
    RAISE EXCEPTION 'Only the player can reject this request';
  END IF;

  UPDATE public.agent_collaboration_requests
    SET status = 'rejected', updated_at = now()
    WHERE id = _request_id;
END;
$$;

-- Backfill the existing accepted request that didn't propagate
UPDATE public.player_profiles pp
SET agent_name = TRIM(COALESCE(sp.first_name,'') || ' ' || COALESCE(sp.last_name,'')),
    agent_email = COALESCE((SELECT email FROM auth.users WHERE id = acr.agent_user_id), pp.agent_email)
FROM public.agent_collaboration_requests acr
JOIN public.scout_profiles sp ON sp.user_id = acr.agent_user_id
WHERE acr.status = 'accepted'
  AND pp.user_id = acr.player_user_id
  AND (pp.agent_name IS NULL OR pp.agent_name = '');