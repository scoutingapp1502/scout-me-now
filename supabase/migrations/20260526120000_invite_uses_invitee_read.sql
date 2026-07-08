-- Allow invitees to read their own entry (needed for retroactive invite code check)
DROP POLICY IF EXISTS "invitee_reads_own" ON invite_uses;
CREATE POLICY "invitee_reads_own" ON invite_uses
  FOR SELECT USING (auth.uid() = invitee_id);
