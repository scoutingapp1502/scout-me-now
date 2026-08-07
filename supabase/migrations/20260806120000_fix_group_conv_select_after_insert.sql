-- Creating a group always failed with "Eroare la creare grup": NewGroupChat.tsx
-- does `.insert({...}).select().single()` on group_conversations to get the
-- new row back, but the SELECT policy only allowed rows where the caller is
-- already a group_members row for that group — and that membership row is
-- only inserted in a *separate* follow-up query, after this select already
-- ran. So the read-back after insert always matched zero rows under RLS,
-- `.single()` errored, and the client treated that as a failed creation
-- (while an orphaned group_conversations row with no members was left
-- behind). Let the creator see their own group immediately, regardless of
-- membership rows.
DROP POLICY IF EXISTS "group_conv_select" ON public.group_conversations;
CREATE POLICY "group_conv_select" ON public.group_conversations
  FOR SELECT USING (public.is_group_member(id) OR created_by = auth.uid());
