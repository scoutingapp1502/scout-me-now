
DROP POLICY "Users can view own career entries" ON public.player_career_entries;

CREATE POLICY "Authenticated can view all career entries"
ON public.player_career_entries
FOR SELECT
TO authenticated
USING (true);
