-- A "cauta_jucator" (Descoperitor) account could publish scout_posts even
-- before an admin approved their document verification — the INSERT policy
-- only checked auth.uid() = user_id + has_role(...), never verification
-- status. Client-side (NewPostComposer.tsx) now also disables the "Publică"
-- button while the account is locked, but this is defense-in-depth so a
-- direct Supabase client call can't bypass it.
DROP POLICY IF EXISTS "Scouts and agents can insert own posts" ON public.scout_posts;
CREATE POLICY "Scouts and agents can insert own posts" ON public.scout_posts
  FOR INSERT TO public
  WITH CHECK (auth.uid() = user_id AND (
    has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'cauta_jucator'::app_role)
  ) AND public.is_verification_approved(auth.uid()));
