-- Run this in Supabase SQL Editor to apply the "Distribuire și reutilizare" fix.
-- Fixes: story_shares_enabled ("allow people to share your stories") was
-- only enforced client-side — a modified client (or direct API call) could
-- send someone's story-share message regardless of the setting, since
-- StoryShareSheet.tsx wrote directly into public.messages. Not specific to
-- the cauta_jucator role, but fixed as part of this verification pass.

-- ===== 20260811097000_story_share_server_enforcement.sql =====
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

  _conv_id := public.get_or_create_conversation(_recipient_id);

  INSERT INTO public.messages (conversation_id, sender_id, content)
  VALUES (_conv_id, auth.uid(), _content);

  UPDATE public.conversations SET updated_at = now() WHERE id = _conv_id;

  RETURN _conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.share_story_to_conversation(uuid, uuid, text) TO authenticated;
