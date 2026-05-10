-- Recomandari: tabel principal
CREATE TABLE public.recommendations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recipient_user_id UUID NOT NULL,
  author_user_id UUID NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  -- 'pending' = autor invitat sa scrie (recipient a cerut), nu are continut inca
  -- 'submitted' = autor a scris, asteapta aprobarea recipientului
  -- 'accepted' = recipient a aprobat, este publica
  -- 'rejected' = recipient a refuzat
  status TEXT NOT NULL DEFAULT 'submitted',
  -- cine a initiat: 'request' (recipient a cerut) sau 'offer' (autor a oferit direct)
  initiated_by TEXT NOT NULL DEFAULT 'offer',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT recommendations_no_self CHECK (recipient_user_id <> author_user_id),
  CONSTRAINT recommendations_status_chk CHECK (status IN ('pending','submitted','accepted','rejected')),
  CONSTRAINT recommendations_initiated_chk CHECK (initiated_by IN ('request','offer'))
);

CREATE INDEX idx_recommendations_recipient ON public.recommendations(recipient_user_id, status);
CREATE INDEX idx_recommendations_author ON public.recommendations(author_user_id, status);

ALTER TABLE public.recommendations ENABLE ROW LEVEL SECURITY;

-- Vizibilitate: oricine autentificat vede recomandarile acceptate; partile implicate vad propriile in orice status
CREATE POLICY "View accepted recommendations"
ON public.recommendations FOR SELECT
TO authenticated
USING (status = 'accepted' OR auth.uid() = recipient_user_id OR auth.uid() = author_user_id);

-- Insert: doar daca exista o conexiune mutuala (follow accepted in oricare directie)
-- Autorul ofera direct (initiated_by='offer', status='submitted')
-- SAU recipientul cere (initiated_by='request', status='pending', author scrie ulterior)
CREATE POLICY "Authors can offer recommendations to connected users"
ON public.recommendations FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = author_user_id
  AND initiated_by = 'offer'
  AND status = 'submitted'
  AND public.can_message_user(recipient_user_id)
);

CREATE POLICY "Recipients can request recommendations from connected users"
ON public.recommendations FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = recipient_user_id
  AND initiated_by = 'request'
  AND status = 'pending'
  AND public.can_message_user(author_user_id)
);

-- Update: recipientul aproba/refuza, autorul completeaza o cerere pending
CREATE POLICY "Recipients can update recommendation status"
ON public.recommendations FOR UPDATE
TO authenticated
USING (auth.uid() = recipient_user_id)
WITH CHECK (auth.uid() = recipient_user_id);

CREATE POLICY "Authors can fill in their pending recommendation"
ON public.recommendations FOR UPDATE
TO authenticated
USING (auth.uid() = author_user_id AND status = 'pending')
WITH CHECK (auth.uid() = author_user_id);

-- Delete: autorul isi poate retrage recomandarea, recipientul o poate sterge de pe profil
CREATE POLICY "Authors can delete their recommendations"
ON public.recommendations FOR DELETE
TO authenticated
USING (auth.uid() = author_user_id);

CREATE POLICY "Recipients can delete recommendations on their profile"
ON public.recommendations FOR DELETE
TO authenticated
USING (auth.uid() = recipient_user_id);

CREATE TRIGGER update_recommendations_updated_at
BEFORE UPDATE ON public.recommendations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Setari per-utilizator pentru sectiunea Recomandari (vizibilitate)
CREATE TABLE public.recommendations_settings (
  user_id UUID NOT NULL PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.recommendations_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read settings"
ON public.recommendations_settings FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users manage their own settings"
ON public.recommendations_settings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update their own settings"
ON public.recommendations_settings FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER update_recommendations_settings_updated_at
BEFORE UPDATE ON public.recommendations_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();