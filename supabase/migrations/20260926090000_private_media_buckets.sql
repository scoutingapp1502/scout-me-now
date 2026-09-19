-- Media buckets go private. Until now player-videos (test videos, many of
-- minors), player-documents (post images, profile documents), scout-reports,
-- stories, message-attachments and group-attachments were public: anyone
-- holding a URL could open the file forever, logged in or not — which also
-- contradicted the Privacy Policy's "accessible only to authorised people".
--
-- From here on the client exchanges each stored URL for a short-lived signed
-- URL (src/lib/signedMedia.ts); Storage only signs when the caller passes
-- the SELECT policy below, so access follows the same rules as the data the
-- file belongs to. Stored URLs in the database stay as they are — they are
-- only used to recover bucket + path.
--
-- Every upload path in these buckets starts with a uuid folder:
--   player-videos / player-documents / stories : {uploader user id}/...
--   scout-reports                              : {scout user id}/...
--   message-attachments                        : {conversation id}/...
--   group-attachments                          : {group id}/...

UPDATE storage.buckets
SET public = false
WHERE id IN ('player-videos', 'player-documents', 'scout-reports', 'stories', 'message-attachments', 'group-attachments');

DROP POLICY IF EXISTS "Anyone can view player videos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view player documents" ON storage.objects;
DROP POLICY IF EXISTS "Public read scout reports" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read stories" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read message attachments" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can read group attachments" ON storage.objects;

-- First folder segment as uuid, or NULL when it isn't one.
CREATE OR REPLACE FUNCTION public.storage_folder_uuid(_name text)
RETURNS uuid
LANGUAGE sql IMMUTABLE
AS $$
  SELECT CASE
    WHEN (storage.foldername(_name))[1] ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
    THEN (storage.foldername(_name))[1]::uuid
    ELSE NULL
  END;
$$;

-- A file under a user's folder is visible exactly when that user's profile
-- is (can_view_profile), to the owner, and to admins. Files published by an
-- admin account (announcements, test example videos, SportRise posts) are
-- app-wide content and readable by every signed-in user.
CREATE OR REPLACE FUNCTION public.can_view_profile_media(_name text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _owner uuid := public.storage_folder_uuid(_name);
BEGIN
  IF auth.uid() IS NULL OR _owner IS NULL THEN RETURN false; END IF;
  IF _owner = auth.uid() THEN RETURN true; END IF;
  IF public.has_role(auth.uid(), 'admin'::app_role) THEN RETURN true; END IF;
  IF public.has_role(_owner, 'admin'::app_role) THEN RETURN true; END IF;
  RETURN public.can_view_profile(_owner);
END;
$$;

DROP POLICY IF EXISTS "Player videos follow profile visibility" ON storage.objects;
CREATE POLICY "Player videos follow profile visibility"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'player-videos' AND public.can_view_profile_media(name));

DROP POLICY IF EXISTS "Player documents follow profile visibility" ON storage.objects;
CREATE POLICY "Player documents follow profile visibility"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'player-documents' AND public.can_view_profile_media(name));

DROP POLICY IF EXISTS "Stories follow profile visibility" ON storage.objects;
CREATE POLICY "Stories follow profile visibility"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'stories' AND public.can_view_profile_media(name));

-- Uploaded reports are a scout's public portfolio (the table itself is
-- readable by every user), so any signed-in user may open them; anonymous
-- visitors no longer can.
DROP POLICY IF EXISTS "Signed-in users can read scout reports" ON storage.objects;
CREATE POLICY "Signed-in users can read scout reports"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'scout-reports');

DROP POLICY IF EXISTS "Public can read scout uploaded reports" ON public.scout_uploaded_reports;
DROP POLICY IF EXISTS "Signed-in users can read scout uploaded reports" ON public.scout_uploaded_reports;
CREATE POLICY "Signed-in users can read scout uploaded reports"
  ON public.scout_uploaded_reports FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Conversation participants can read attachments" ON storage.objects;
CREATE POLICY "Conversation participants can read attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'message-attachments' AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR (public.storage_folder_uuid(name) IS NOT NULL
          AND public.is_conversation_participant(public.storage_folder_uuid(name)))
    )
  );

DROP POLICY IF EXISTS "Group members can read attachments" ON storage.objects;
CREATE POLICY "Group members can read attachments"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'group-attachments' AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR (public.storage_folder_uuid(name) IS NOT NULL
          AND public.is_group_member(public.storage_folder_uuid(name)))
    )
  );
