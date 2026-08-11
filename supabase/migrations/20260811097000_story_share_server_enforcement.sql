-- "Distribuire și reutilizare" → story_shares_enabled toggle was only
-- enforced client-side: StoryShareSheet.tsx checked
-- get_story_shares_enabled() before enabling the "send" button, but
-- handleSendTo() then inserted directly into public.messages with no
-- server-side check at all. A modified client (or a direct API call)
-- could send someone's story-share message regardless of the setting.
-- Not specific to the cauta_jucator role — a general security gap fixed
-- alongside the role-specific verification pass at the user's request.
--
-- messages.content is free-form text with no structural "this is a story
-- share" marker, so this can't be enforced with a plain RLS predicate on
-- messages. Instead: a SECURITY DEFINER RPC that validates
-- story_shares_enabled, then delegates conversation lookup/creation to the
-- existing get_or_create_conversation() (which already enforces
-- can_message_user() — blocking/message-request rules must still apply to
-- a story share like any other message).
CREATE OR REPLACE FUNCTION public.share_story_to_conversation(
  _story_owner_id uuid,
  _recipient_id uuid,
  _content text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _shares_enabled boolean;
  _conv_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT COALESCE(story_shares_enabled, true) INTO _shares_enabled
  FROM public.user_privacy_settings WHERE user_id = _story_owner_id;
  IF NOT COALESCE(_shares_enabled, true) THEN
    RAISE EXCEPTION 'This person does not allow their stories to be shared';
  END IF;

  -- get_or_create_conversation() enforces can_message_user() internally.
  _conv_id := public.get_or_create_conversation(_recipient_id);

  INSERT INTO public.messages (conversation_id, sender_id, content)
  VALUES (_conv_id, auth.uid(), _content);

  UPDATE public.conversations SET updated_at = now() WHERE id = _conv_id;

  RETURN _conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.share_story_to_conversation(uuid, uuid, text) TO authenticated;
