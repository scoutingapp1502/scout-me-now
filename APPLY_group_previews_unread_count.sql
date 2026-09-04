-- get_group_message_previews never returned an unread count (unlike its DM
-- sibling get_conversation_previews), so the inbox's Groups list had no way
-- to bold/badge a group with unseen messages. Now that group_message_reads
-- exists (read receipts feature), we can compute it the same way: messages
-- not sent by the caller and with no matching read row for them.
DROP FUNCTION IF EXISTS public.get_group_message_previews(uuid[]);
CREATE OR REPLACE FUNCTION public.get_group_message_previews(p_group_ids uuid[], p_user_id uuid)
RETURNS TABLE (
  group_id uuid,
  content text,
  created_at timestamptz,
  sender_id uuid,
  unread_count bigint
)
LANGUAGE sql STABLE SET search_path = public
AS $$
  SELECT
    ids.group_id,
    lm.content,
    lm.created_at,
    lm.sender_id,
    COALESCE(uc.unread_count, 0)
  FROM unnest(p_group_ids) AS ids(group_id)
  LEFT JOIN LATERAL (
    SELECT content, created_at, sender_id
    FROM public.group_messages
    WHERE group_id = ids.group_id AND deleted_at IS NULL
    ORDER BY created_at DESC
    LIMIT 1
  ) lm ON true
  LEFT JOIN LATERAL (
    SELECT count(*) AS unread_count
    FROM public.group_messages gm
    WHERE gm.group_id = ids.group_id
      AND gm.deleted_at IS NULL
      AND gm.sender_id <> p_user_id
      AND NOT EXISTS (
        SELECT 1 FROM public.group_message_reads gmr
        WHERE gmr.message_id = gm.id AND gmr.user_id = p_user_id
      )
  ) uc ON true;
$$;
