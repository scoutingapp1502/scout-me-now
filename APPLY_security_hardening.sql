-- Security hardening pass before public launch. Four independent fixes.

-- ---------------------------------------------------------------------------
-- 1. scout-documents bucket was PUBLIC.
--    20260319 created it with public = true; 20260605 meant to recreate it
--    private but used INSERT ... ON CONFLICT DO NOTHING, which left the
--    original row untouched. Identity documents uploaded for scout
--    verification were therefore downloadable by anyone holding the URL.
--
--    Two kinds of files share this bucket, told apart by filename:
--      {user_id}/{timestamp}.{ext}       verification ID document
--                                        (uploaded by the submit-scout-document
--                                        Edge Function with the service role)
--      {user_id}/cert-{timestamp}.{ext}  certification the scout attaches to
--                                        their profile, visible to other users
-- ---------------------------------------------------------------------------
UPDATE storage.buckets SET public = false WHERE id = 'scout-documents';

DROP POLICY IF EXISTS "Anyone can read scout documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload scout documents" ON storage.objects;
DROP POLICY IF EXISTS "Scout documents: owner, admin, or shared certificates" ON storage.objects;
DROP POLICY IF EXISTS "Scout documents: upload into own folder" ON storage.objects;

CREATE POLICY "Scout documents: owner, admin, or shared certificates"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'scout-documents' AND (
      (storage.foldername(name))[1] = auth.uid()::text
      OR public.has_role(auth.uid(), 'admin'::app_role)
      OR split_part(name, '/', 2) LIKE 'cert-%'
    )
  );

CREATE POLICY "Scout documents: upload into own folder"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'scout-documents' AND (storage.foldername(name))[1] = auth.uid()::text);

-- ---------------------------------------------------------------------------
-- 2. Invite codes.
--    invite_uses allowed INSERT WITH CHECK (true) — anyone could credit any
--    inviter with any invitee — and user_invite_codes was readable by anon
--    (every code and its owner's id), because the signup form had to look a
--    code up before a session existed. Both move server-side: the code
--    travels in the signup metadata and a trigger on auth.users resolves it.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "insert_any" ON public.invite_uses;

DROP POLICY IF EXISTS "select_all" ON public.user_invite_codes;
DROP POLICY IF EXISTS "select_own" ON public.user_invite_codes;
CREATE POLICY "select_own" ON public.user_invite_codes
  FOR SELECT USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.handle_new_user_invite()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _code text := upper(trim(NEW.raw_user_meta_data->>'invite_code'));
  _inviter uuid;
BEGIN
  IF COALESCE(NEW.raw_user_meta_data->>'role', 'player') <> 'player'
     OR _code IS NULL OR _code = '' THEN
    RETURN NEW;
  END IF;

  SELECT user_id INTO _inviter FROM public.user_invite_codes WHERE code = _code;
  IF _inviter IS NOT NULL AND _inviter <> NEW.id THEN
    INSERT INTO public.invite_uses (inviter_id, invitee_id)
    VALUES (_inviter, NEW.id)
    ON CONFLICT (invitee_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_invite ON auth.users;
CREATE TRIGGER on_auth_user_created_invite
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_invite();

-- ---------------------------------------------------------------------------
-- 3. player_career_entries had a leftover "TO anon USING (true)" read policy
--    from before account visibility was enforced, plus an unconditional
--    authenticated read. Career history now follows the same rule as the
--    profile it belongs to.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view career entries" ON public.player_career_entries;
DROP POLICY IF EXISTS "Authenticated can view all career entries" ON public.player_career_entries;
DROP POLICY IF EXISTS "Career entries respect account visibility" ON public.player_career_entries;
CREATE POLICY "Career entries respect account visibility"
  ON public.player_career_entries FOR SELECT TO authenticated
  USING (public.can_view_profile(user_id));

-- ---------------------------------------------------------------------------
-- 4. is_admin_email() was callable by anon, so anyone could probe which
--    email belongs to the admin. The forgot-password flow now goes through
--    the request-password-reset Edge Function, which performs this check
--    with the service role and answers identically either way.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.is_admin_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_email(text) TO service_role;
