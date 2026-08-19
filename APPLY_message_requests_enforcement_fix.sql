-- "Mesaje și răspunsuri" → "Solicitări de mesaje" never actually respected
-- the chosen value beyond 'everyone'. can_message_user() let anyone who
-- simply follows the recipient (one-directional, either way) message them
-- regardless of message_requests_visibility — so choosing "Nimeni" still
-- let any of your followers message you, contradicting the setting.
-- "Urmăritorii tăi" (followers) had no real branch at all — it fell
-- through to the same "denied unless existing relationship" path as
-- "Nimeni", so the two options behaved identically.
--
-- Reported directly by the user with the "Nimeni" example: choosing it
-- must mean nobody NEW can message you. An existing conversation always
-- stays open (matches the UI's own copy: "Persoanele... cu care ai vorbit
-- pot întotdeauna să îți trimită mesaje") — that's not a bypass of the
-- setting, it's the one exception the setting's own description promises.
-- Blocking (is_blocked_between) still overrides everything, checked first.
CREATE OR REPLACE FUNCTION public.can_message_user(_other_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _visibility text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() = _other_user_id THEN
    RETURN false;
  END IF;

  IF public.is_blocked_between(auth.uid(), _other_user_id) THEN
    RETURN false;
  END IF;

  -- An existing conversation always stays open, regardless of the
  -- recipient's current setting (per the UI's own description).
  IF EXISTS (
    SELECT 1 FROM public.conversations
    WHERE (user1_id = auth.uid() AND user2_id = _other_user_id)
       OR (user1_id = _other_user_id AND user2_id = auth.uid())
  ) THEN
    RETURN true;
  END IF;

  SELECT message_requests_visibility INTO _visibility
  FROM public.user_privacy_settings WHERE user_id = _other_user_id;
  _visibility := COALESCE(_visibility, 'everyone');

  IF _visibility = 'everyone' THEN RETURN true; END IF;

  IF _visibility = 'followers' THEN
    -- "Urmăritorii tăi": the sender must actually follow the recipient.
    RETURN EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = auth.uid() AND following_id = _other_user_id AND status = 'accepted'
    );
  END IF;

  -- 'no_one': no new contact, no matter the relationship.
  RETURN false;
END;
$$;

-- "Solicitări de grup" → "Doar cei pe care îi urmăresc" was actually
-- letting in anyone the target follows OR is followed by, OR has an
-- existing conversation with — far more permissive than the UI's own
-- label ("Doar cei pe care îi urmăresc" = only people the target
-- themselves actively follows). Narrowed to match the label exactly, per
-- explicit user decision. Also added the missing block check (every other
-- interaction gate in this schema checks is_blocked_between; this one
-- never did).
CREATE OR REPLACE FUNCTION public.can_add_to_group(_target_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _visibility text;
BEGIN
  IF auth.uid() = _target_user_id THEN RETURN true; END IF;
  IF public.is_blocked_between(auth.uid(), _target_user_id) THEN RETURN false; END IF;

  SELECT group_chat_visibility INTO _visibility
  FROM public.user_privacy_settings WHERE user_id = _target_user_id;
  _visibility := COALESCE(_visibility, 'everyone');

  IF _visibility = 'everyone' THEN RETURN true; END IF;

  -- 'following_or_messaged': the target must actually follow the adder
  -- (i.e. the adder is someone the target follows).
  RETURN EXISTS (
    SELECT 1 FROM public.follows
    WHERE follower_id = _target_user_id AND following_id = auth.uid() AND status = 'accepted'
  );
END;
$$;

-- "Răspunsuri la story" already matched its own label correctly
-- ("Permite răspunsuri... doar de la cei urmăriți" = the story owner
-- follows the replier), but was missing the block check every other
-- interaction gate in this schema has. Added for consistency.
CREATE OR REPLACE FUNCTION public.can_reply_to_story(_story_owner_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _visibility text;
BEGIN
  IF auth.uid() IS NULL OR auth.uid() = _story_owner_id THEN RETURN true; END IF;
  IF public.is_blocked_between(auth.uid(), _story_owner_id) THEN RETURN false; END IF;

  SELECT story_replies_visibility INTO _visibility
  FROM public.user_privacy_settings WHERE user_id = _story_owner_id;
  _visibility := COALESCE(_visibility, 'everyone');

  IF _visibility = 'no_one' THEN RETURN false; END IF;
  IF _visibility = 'followers' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = _story_owner_id AND following_id = auth.uid() AND status = 'accepted'
    );
  END IF;
  RETURN true; -- 'everyone'
END;
$$;

-- StoryViewer.tsx's handleSend() only checked can_reply_to_story()
-- client-side, then sent the reply through get_or_create_conversation() +
-- a direct messages insert — neither of those enforces
-- story_replies_visibility server-side, only can_message_user() (a
-- different setting). A modified client or direct API call could send a
-- "story reply" to anyone regardless of this setting. Same class of gap
-- already fixed for story shares (share_story_to_conversation);
-- replicated here with a dedicated RPC the client now calls instead of
-- inserting directly.
CREATE OR REPLACE FUNCTION public.reply_to_story(
  _story_owner_id uuid,
  _content text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _conv_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF NOT public.can_reply_to_story(_story_owner_id) THEN
    RAISE EXCEPTION 'Cannot reply to this story';
  END IF;

  -- get_or_create_conversation() enforces can_message_user() internally.
  _conv_id := public.get_or_create_conversation(_story_owner_id);

  INSERT INTO public.messages (conversation_id, sender_id, content)
  VALUES (_conv_id, auth.uid(), _content);

  UPDATE public.conversations SET updated_at = now() WHERE id = _conv_id;

  RETURN _conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reply_to_story(uuid, text) TO authenticated;
