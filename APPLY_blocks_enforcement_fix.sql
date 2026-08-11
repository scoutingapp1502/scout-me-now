-- Run this in Supabase SQL Editor to apply real "Blocat" (block) enforcement.
-- Before this: blocking someone via "Profile blocate" only wrote/deleted a
-- row in public.blocks — nothing else in the schema ever read that table.
-- The blocked person could still see your profile/posts, follow you, and
-- message you, exactly as before. This wires the block into the three
-- places the UI already promises it affects: profile/post visibility,
-- messaging, and new follow requests. Pre-existing gap, affects both roles
-- equally — not specific to the cauta_jucator role.

-- ===== 20260811093000_blocks_real_enforcement.sql =====
CREATE OR REPLACE FUNCTION public.is_blocked_between(_a uuid, _b uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT _a IS DISTINCT FROM _b AND EXISTS (
    SELECT 1 FROM public.blocks
    WHERE (blocker_id = _a AND blocked_id = _b)
       OR (blocker_id = _b AND blocked_id = _a)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_profile(_profile_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _visibility text;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  IF auth.uid() = _profile_user_id THEN RETURN true; END IF;
  IF public.is_blocked_between(auth.uid(), _profile_user_id) THEN RETURN false; END IF;
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN true; END IF;

  SELECT account_visibility INTO _visibility FROM public.user_privacy_settings WHERE user_id = _profile_user_id;
  _visibility := COALESCE(_visibility, 'scouts_only');

  IF _visibility = 'everyone' THEN
    RETURN true;
  END IF;

  IF (public.has_role(auth.uid(), 'scout'::app_role) OR public.has_role(auth.uid(), 'agent'::app_role)
      OR public.has_role(auth.uid(), 'cauta_jucator'::app_role))
     AND public.is_verification_approved(auth.uid()) THEN
    RETURN true;
  END IF;

  IF public.has_role(_profile_user_id, 'player'::app_role) AND public.has_role(auth.uid(), 'player'::app_role) THEN
    RETURN true;
  END IF;

  IF _visibility = 'scouts_and_mutual' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = auth.uid() AND following_id = _profile_user_id AND status = 'accepted'
    ) AND EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = _profile_user_id AND following_id = auth.uid() AND status = 'accepted'
    );
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.can_message_user(_other_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _visibility text;
  _sender_follows_recipient boolean;
  _recipient_follows_sender boolean;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() = _other_user_id THEN
    RETURN false;
  END IF;

  IF public.is_blocked_between(auth.uid(), _other_user_id) THEN
    RETURN false;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.conversations
    WHERE (user1_id = auth.uid() AND user2_id = _other_user_id)
       OR (user1_id = _other_user_id AND user2_id = auth.uid())
  ) THEN
    RETURN true;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.follows
    WHERE follower_id = auth.uid() AND following_id = _other_user_id AND status = 'accepted'
  ) INTO _sender_follows_recipient;

  SELECT EXISTS (
    SELECT 1 FROM public.follows
    WHERE follower_id = _other_user_id AND following_id = auth.uid() AND status = 'accepted'
  ) INTO _recipient_follows_sender;

  IF _sender_follows_recipient OR _recipient_follows_sender THEN
    RETURN true;
  END IF;

  SELECT message_requests_visibility INTO _visibility
  FROM public.user_privacy_settings WHERE user_id = _other_user_id;
  _visibility := COALESCE(_visibility, 'everyone');

  IF _visibility = 'everyone' THEN RETURN true; END IF;
  RETURN false;
END;
$$;

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

  IF public.is_blocked_between(_caller, _following_id) THEN
    RAISE EXCEPTION 'Cannot follow this user';
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
