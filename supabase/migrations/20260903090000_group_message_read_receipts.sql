-- Read receipts for group messages. Unlike DMs (a single boolean "read" on
-- the message row, since there's only one other person), a group message
-- needs a per-member read record so we can tell whether *every* member has
-- seen it (the UI only shows a simple single/double checkmark, matching
-- DMs — not a per-person list).
CREATE TABLE IF NOT EXISTS public.group_message_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_group_message_reads_message_id ON public.group_message_reads (message_id);
CREATE INDEX IF NOT EXISTS idx_group_message_reads_user_id ON public.group_message_reads (user_id);

ALTER TABLE public.group_message_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "group_message_reads_select" ON public.group_message_reads;
CREATE POLICY "group_message_reads_select" ON public.group_message_reads FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.group_messages gm
      WHERE gm.id = message_id AND public.is_group_member(gm.group_id)
    )
  );

DROP POLICY IF EXISTS "group_message_reads_insert" ON public.group_message_reads;
CREATE POLICY "group_message_reads_insert" ON public.group_message_reads FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM public.group_messages gm
      WHERE gm.id = message_id AND public.is_group_member(gm.group_id)
    )
  );

-- Bulk-marks every not-yet-read message in a group as read by the caller,
-- skipping their own messages (a sender doesn't need a read receipt against
-- themselves). Used once when a group conversation is opened, instead of
-- one INSERT per message from the client.
CREATE OR REPLACE FUNCTION public.mark_group_messages_read(_group_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_group_member(_group_id) THEN
    RETURN;
  END IF;
  INSERT INTO public.group_message_reads (message_id, user_id)
  SELECT gm.id, auth.uid()
  FROM public.group_messages gm
  WHERE gm.group_id = _group_id
    AND gm.sender_id <> auth.uid()
  ON CONFLICT (message_id, user_id) DO NOTHING;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_group_messages_read(uuid) TO authenticated;
