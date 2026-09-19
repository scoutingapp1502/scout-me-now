-- Durable record of which version of the Terms of Service and Privacy
-- Policy each user accepted, and when. Until now the signup checkbox was
-- React state only — nothing proved a user ever agreed to anything.
--
-- Rows are written two ways:
--   * at signup, by a trigger on auth.users reading terms_version /
--     privacy_version from the signup metadata (with email confirmation on,
--     the client has no session yet at that point, so it can't insert under
--     RLS itself);
--   * later, by the client, when the versions in src/lib/legalVersions.ts
--     move past what the user last accepted and the blocking dialog in the
--     dashboard collects a fresh acceptance.
-- A signup that arrives without version metadata simply gets no rows, and
-- the dashboard dialog asks on first login instead.

CREATE TABLE IF NOT EXISTS public.user_consents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  consent_type text NOT NULL CHECK (consent_type IN ('terms_of_service', 'privacy_policy')),
  version text NOT NULL,
  accepted_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_consents_user_type ON public.user_consents (user_id, consent_type);

ALTER TABLE public.user_consents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS user_consents_select_own ON public.user_consents;
CREATE POLICY user_consents_select_own ON public.user_consents
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS user_consents_insert_own ON public.user_consents;
CREATE POLICY user_consents_insert_own ON public.user_consents
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS user_consents_admin_select_all ON public.user_consents;
CREATE POLICY user_consents_admin_select_all ON public.user_consents
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- No UPDATE/DELETE policies on purpose: a consent record is append-only.

CREATE OR REPLACE FUNCTION public.handle_new_user_consents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _terms text := NEW.raw_user_meta_data->>'terms_version';
  _privacy text := NEW.raw_user_meta_data->>'privacy_version';
BEGIN
  IF _terms IS NOT NULL AND _terms <> '' THEN
    INSERT INTO public.user_consents (user_id, consent_type, version)
    VALUES (NEW.id, 'terms_of_service', _terms);
  END IF;
  IF _privacy IS NOT NULL AND _privacy <> '' THEN
    INSERT INTO public.user_consents (user_id, consent_type, version)
    VALUES (NEW.id, 'privacy_policy', _privacy);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_consents ON auth.users;
CREATE TRIGGER on_auth_user_created_consents
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_consents();
