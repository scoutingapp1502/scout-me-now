
CREATE OR REPLACE FUNCTION public.send_collaboration_request(
  _agent_user_id uuid,
  _player_user_id uuid,
  _initiated_by text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _caller uuid := auth.uid();
  _existing record;
  _new_id uuid;
  _days_left int;
BEGIN
  IF _initiated_by NOT IN ('player','agent') THEN
    RAISE EXCEPTION 'Invalid initiated_by';
  END IF;

  IF _initiated_by = 'player' AND _caller <> _player_user_id THEN
    RAISE EXCEPTION 'Only the player can send this request';
  END IF;
  IF _initiated_by = 'agent' AND _caller <> _agent_user_id THEN
    RAISE EXCEPTION 'Only the agent can send this request';
  END IF;

  -- Check the most recent request between this exact pair
  SELECT * INTO _existing
  FROM public.agent_collaboration_requests
  WHERE agent_user_id = _agent_user_id AND player_user_id = _player_user_id
  ORDER BY updated_at DESC
  LIMIT 1;

  IF _existing IS NOT NULL THEN
    IF _existing.status = 'pending' THEN
      RAISE EXCEPTION 'A pending request already exists';
    END IF;
    IF _existing.status = 'accepted' THEN
      RAISE EXCEPTION 'Collaboration is already active';
    END IF;
    IF _existing.status = 'rejected' AND _existing.updated_at > now() - interval '21 days' THEN
      _days_left := CEIL(EXTRACT(EPOCH FROM ((_existing.updated_at + interval '21 days') - now())) / 86400)::int;
      RAISE EXCEPTION 'COOLDOWN_ACTIVE:%', _days_left;
    END IF;
    -- Cooldown elapsed: remove old rejected row so a fresh one can be inserted
    DELETE FROM public.agent_collaboration_requests WHERE id = _existing.id;
  END IF;

  INSERT INTO public.agent_collaboration_requests (agent_user_id, player_user_id, status, initiated_by)
  VALUES (_agent_user_id, _player_user_id, 'pending', _initiated_by)
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$$;
