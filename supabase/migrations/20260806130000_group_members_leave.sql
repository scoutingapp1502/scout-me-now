-- No DELETE policy existed on group_members at all, so "leave group" was
-- impossible from the client (RLS denies by default when no policy matches
-- the operation). Let a member remove their own membership row.
CREATE POLICY "group_members_delete_self" ON public.group_members FOR DELETE
  USING (user_id = auth.uid());
