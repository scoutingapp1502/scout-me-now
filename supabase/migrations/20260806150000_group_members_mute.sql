-- Per-user "mute" preference for a group: hides notifications for that
-- group without affecting anyone else. Lives on group_members since each
-- row already represents one (group, user) pair.
ALTER TABLE public.group_members ADD COLUMN muted boolean NOT NULL DEFAULT false;

-- No UPDATE policy existed on group_members at all, so toggling mute would
-- be denied by RLS by default. Let a member update only their own row.
CREATE POLICY "group_members_update_self" ON public.group_members FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
