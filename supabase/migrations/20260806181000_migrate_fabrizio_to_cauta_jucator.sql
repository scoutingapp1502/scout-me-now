-- Migrates the one kept legacy scout account to cauta_jucator, and
-- grandfathers it past the document-verification gate (is_verification_approved()
-- / useAccountLock) since it never went through that flow as a scout.
-- Without this, the role change alone would silently lock the account out
-- of messaging/following/acting on other profiles.
UPDATE public.user_roles
SET role = 'cauta_jucator'
WHERE user_id = '3be6b6db-e5c2-494a-8b3d-baa5b4886b1b';

INSERT INTO public.scout_verification_requests
  (user_id, document_url, status, reviewer_notes, reviewed_at)
VALUES (
  '3be6b6db-e5c2-494a-8b3d-baa5b4886b1b',
  'grandfathered-legacy-scout-migration',
  'approved',
  'Auto-approved during role-collapse migration (2026-08-06): pre-existing scout account with no prior verification flow, grandfathered in to avoid disrupting an active account.',
  now()
)
ON CONFLICT (user_id) DO UPDATE
  SET status = 'approved', reviewed_at = now();
