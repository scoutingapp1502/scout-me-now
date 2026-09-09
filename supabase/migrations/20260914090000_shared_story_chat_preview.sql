-- Sharing a story into a DM today (share_story_to_conversation, added in
-- 20260811097000_story_share_server_enforcement.sql) only sends a plain
-- text message ("Ți-am trimis un story de la X") with no structural link
-- back to the stories row — once you look at the message bubble there's no
-- way to render a preview, detect expiry, or reopen the actual story.
--
-- This mirrors the existing shared_post_id pattern (see
-- 20260806160000_message_shared_post.sql) for stories: a shared_story_id FK
-- (ON DELETE SET NULL, matching the posts precedent) plus a denormalized
-- shared_story_owner_name snapshot — needed because once the story
-- expires/is deleted the FK goes null and the owner's name would otherwise
-- be unrecoverable for the "story-ul lui X a expirat" bubble text.
--
-- Group chat story-sharing doesn't exist today (only 1:1, via
-- StoryShareSheet.tsx) and is intentionally out of scope here.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS shared_story_id uuid REFERENCES public.stories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS shared_story_owner_name text;

CREATE INDEX IF NOT EXISTS idx_messages_shared_story_id ON public.messages (shared_story_id) WHERE shared_story_id IS NOT NULL;

-- Real, server-readable "can I view this person's stories" check, mirroring
-- get_story_shares_enabled()'s narrow-purpose style — lets the chat-embedded
-- story preview distinguish "owner has no active stories right now" from
-- "blocked by their account_visibility privacy setting" instead of both
-- silently looking like zero rows through the stories RLS policy.
CREATE OR REPLACE FUNCTION public.can_view_story(_story_owner_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.can_view_profile(_story_owner_id);
$$;

GRANT EXECUTE ON FUNCTION public.can_view_story(uuid) TO authenticated;

-- Extends share_story_to_conversation to record which specific story was
-- shared (previously only the owner id, content was a plain-text summary
-- with no link back to the story row). Signature change (new required
-- param) means the old 3-arg version must be dropped explicitly — SQL
-- can't CREATE OR REPLACE across a parameter-list change.
DROP FUNCTION IF EXISTS public.share_story_to_conversation(uuid, uuid, text);

CREATE OR REPLACE FUNCTION public.share_story_to_conversation(
  _story_id uuid,
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
  _owner_name text;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT COALESCE(story_shares_enabled, true) INTO _shares_enabled
  FROM public.user_privacy_settings WHERE user_id = _story_owner_id;
  IF NOT COALESCE(_shares_enabled, true) THEN
    RAISE EXCEPTION 'This person does not allow their stories to be shared';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.stories WHERE id = _story_id AND user_id = _story_owner_id AND expires_at > now()) THEN
    RAISE EXCEPTION 'This story is no longer available';
  END IF;

  SELECT COALESCE(p.first_name || ' ' || p.last_name, s.first_name || ' ' || s.last_name, 'User')
  INTO _owner_name
  FROM (SELECT 1) dummy
  LEFT JOIN public.player_profiles p ON p.user_id = _story_owner_id
  LEFT JOIN public.scout_profiles s ON s.user_id = _story_owner_id;

  -- get_or_create_conversation() enforces can_message_user() internally.
  _conv_id := public.get_or_create_conversation(_recipient_id);

  INSERT INTO public.messages (conversation_id, sender_id, content, shared_story_id, shared_story_owner_name)
  VALUES (_conv_id, auth.uid(), _content, _story_id, _owner_name);

  UPDATE public.conversations SET updated_at = now() WHERE id = _conv_id;

  RETURN _conv_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.share_story_to_conversation(uuid, uuid, uuid, text) TO authenticated;
