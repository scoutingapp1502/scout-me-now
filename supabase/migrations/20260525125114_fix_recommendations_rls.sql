-- Relaxează politica RLS pentru cereri de recomandare (initiated_by='request').
-- Autorul (cel rugat să scrie) poate oricum ignora/refuza cererea, deci conexiunea
-- mutuală nu e necesară pentru a crea înregistrarea pending.

DROP POLICY IF EXISTS "Recipients can request recommendations from connected users" ON public.recommendations;

CREATE POLICY "Recipients can request recommendations"
ON public.recommendations FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = recipient_user_id
  AND initiated_by = 'request'
  AND status = 'pending'
  AND recipient_user_id <> author_user_id
  AND EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = author_user_id
  )
);
