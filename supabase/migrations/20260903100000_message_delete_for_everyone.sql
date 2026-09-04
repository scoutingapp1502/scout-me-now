-- "Delete for everyone" on own messages, DM and group alike. Soft-delete
-- (deleted_at set, content/attachment fields cleared) rather than a hard
-- DELETE, so the message bubble stays in place as a "This message was
-- deleted" placeholder for all participants — deleting a message shouldn't
-- shift the rest of the conversation or hide that something was sent there.
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.group_messages ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- The existing "Recipients can mark messages as read" UPDATE policy only
-- lets the *recipient* update a message (sender_id != auth.uid()), so the
-- sender needs a separate policy to delete their own.
DROP POLICY IF EXISTS "Senders can delete own messages" ON public.messages;
CREATE POLICY "Senders can delete own messages"
ON public.messages FOR UPDATE
TO authenticated
USING (auth.uid() = sender_id)
WITH CHECK (auth.uid() = sender_id);

-- group_messages had no UPDATE policy at all before this.
DROP POLICY IF EXISTS "Senders can delete own group messages" ON public.group_messages;
CREATE POLICY "Senders can delete own group messages"
ON public.group_messages FOR UPDATE
TO authenticated
USING (auth.uid() = sender_id)
WITH CHECK (auth.uid() = sender_id);
