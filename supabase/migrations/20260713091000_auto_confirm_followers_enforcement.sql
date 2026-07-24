-- "Auto-confirm anyone who follows you" was saved to user_privacy_settings
-- but nothing ever checked it — every incoming follow still landed as
-- "pending" regardless. request_follow() now inserts as 'accepted'
-- directly when the target has auto_confirm_followers enabled.
CREATE OR REPLACE FUNCTION public.request_follow(_following_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _existing public.follows%ROWTYPE;
  _new_id uuid;
  _auto_confirm boolean;
  _initial_status text;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _caller = _following_id THEN
    RAISE EXCEPTION 'You cannot follow yourself';
  END IF;

  SELECT auto_confirm_followers INTO _auto_confirm
  FROM public.user_privacy_settings WHERE user_id = _following_id;
  _initial_status := CASE WHEN COALESCE(_auto_confirm, false) THEN 'accepted' ELSE 'pending' END;

  SELECT * INTO _existing
  FROM public.follows
  WHERE follower_id = _caller
    AND following_id = _following_id
  LIMIT 1;

  IF _existing.id IS NULL THEN
    INSERT INTO public.follows (follower_id, following_id, status, responded_at)
    VALUES (
      _caller, _following_id, _initial_status,
      CASE WHEN _initial_status = 'accepted' THEN now() ELSE NULL END
    )
    RETURNING id INTO _new_id;

    RETURN _new_id;
  END IF;

  IF _existing.status = 'accepted' THEN
    RAISE EXCEPTION 'Already following';
  END IF;

  IF _existing.status = 'pending' THEN
    RAISE EXCEPTION 'Follow request already pending';
  END IF;

  UPDATE public.follows
  SET status = _initial_status,
      created_at = now(),
      responded_at = CASE WHEN _initial_status = 'accepted' THEN now() ELSE NULL END
  WHERE id = _existing.id
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$function$;
