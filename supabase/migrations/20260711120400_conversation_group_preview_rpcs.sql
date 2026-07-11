-- MessagesSection.tsx previously fetched the last message + unread count for
-- each conversation (and last message for each group) with a sequential
-- await inside a for-loop — 2 round trips per conversation and 3+ per group.
-- These RPCs return one row per conversation/group in a single query.

CREATE OR REPLACE FUNCTION public.get_conversation_previews(p_conversation_ids uuid[], p_user_id uuid)
RETURNS TABLE (
  conversation_id uuid,
  last_content text,
  last_created_at timestamptz,
  last_sender_id uuid,
  last_read boolean,
  unread_count bigint
)
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT
    ids.conversation_id,
    lm.content,
    lm.created_at,
    lm.sender_id,
    lm.read,
    COALESCE(uc.unread_count, 0)
  FROM unnest(p_conversation_ids) AS ids(conversation_id)
  LEFT JOIN LATERAL (
    SELECT content, created_at, sender_id, read
    FROM public.messages
    WHERE conversation_id = ids.conversation_id
    ORDER BY created_at DESC
    LIMIT 1
  ) lm ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS unread_count
    FROM public.messages
    WHERE conversation_id = ids.conversation_id AND read = false AND sender_id <> p_user_id
  ) uc ON true;
$$;

CREATE OR REPLACE FUNCTION public.get_group_message_previews(p_group_ids uuid[])
RETURNS TABLE (
  group_id uuid,
  content text,
  created_at timestamptz
)
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT ids.group_id, lm.content, lm.created_at
  FROM unnest(p_group_ids) AS ids(group_id)
  LEFT JOIN LATERAL (
    SELECT content, created_at
    FROM public.group_messages
    WHERE group_id = ids.group_id
    ORDER BY created_at DESC
    LIMIT 1
  ) lm ON true;
$$;
