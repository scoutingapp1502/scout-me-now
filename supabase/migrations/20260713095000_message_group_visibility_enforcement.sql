-- can_message_user() used to hardcode "the sender must already follow the
-- recipient" for every conversation, ignoring message_requests_visibility
-- entirely (the setting was saved but had no effect). Now it checks the
-- recipient's actual preference: 'everyone' allows a first message from
-- anyone, 'followers' requires the sender to already follow the recipient,
-- 'no_one' blocks new contacts outright. An existing follow relationship
-- (either direction) or a prior conversation always keeps messaging open,
-- matching the description already shown in the settings UI.
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
  RETURN false; -- 'followers' or 'no_one', and no existing relationship
END;
$$;

-- "Who can add you to group chats" (group_chat_visibility) was also saved
-- but never checked — anyone could add anyone to a new group.
CREATE OR REPLACE FUNCTION public.can_add_to_group(_target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _visibility text;
BEGIN
  IF auth.uid() = _target_user_id THEN RETURN true; END IF;

  SELECT group_chat_visibility INTO _visibility
  FROM public.user_privacy_settings WHERE user_id = _target_user_id;
  _visibility := COALESCE(_visibility, 'everyone');

  IF _visibility = 'everyone' THEN RETURN true; END IF;

  -- 'following_or_messaged': adder must follow the target, be followed back,
  -- or already have a conversation with them.
  RETURN EXISTS (
    SELECT 1 FROM public.follows
    WHERE (follower_id = auth.uid() AND following_id = _target_user_id AND status = 'accepted')
       OR (follower_id = _target_user_id AND following_id = auth.uid() AND status = 'accepted')
  ) OR EXISTS (
    SELECT 1 FROM public.conversations
    WHERE (user1_id = auth.uid() AND user2_id = _target_user_id)
       OR (user1_id = _target_user_id AND user2_id = auth.uid())
  );
END;
$$;

DROP POLICY IF EXISTS "group_members_insert" ON public.group_members;
CREATE POLICY "group_members_insert" ON public.group_members FOR INSERT
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.group_conversations WHERE id = group_id AND created_by = auth.uid())
    AND (user_id = auth.uid() OR public.can_add_to_group(user_id))
  );
