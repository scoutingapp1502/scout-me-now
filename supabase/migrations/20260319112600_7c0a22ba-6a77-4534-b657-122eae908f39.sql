
-- Tighten INSERT policy: viewer must be the current user
DROP POLICY "Authenticated can insert analytics" ON public.profile_analytics;
CREATE POLICY "Authenticated can insert own events"
ON public.profile_analytics FOR INSERT TO authenticated
WITH CHECK (viewer_user_id = auth.uid() OR viewer_user_id IS NULL);
