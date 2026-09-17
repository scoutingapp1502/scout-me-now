-- Public /contact form submissions from visitors who aren't signed in yet
-- (can't reuse support_tickets, which requires an authenticated user_id).
CREATE TABLE IF NOT EXISTS public.public_contact_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  phone text,
  email text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_public_contact_messages_status ON public.public_contact_messages (status);

ALTER TABLE public.public_contact_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_contact_messages_insert_anyone" ON public.public_contact_messages;
CREATE POLICY "public_contact_messages_insert_anyone" ON public.public_contact_messages
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "public_contact_messages_admin_select_all" ON public.public_contact_messages;
CREATE POLICY "public_contact_messages_admin_select_all" ON public.public_contact_messages
  FOR SELECT USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "public_contact_messages_admin_update_all" ON public.public_contact_messages;
CREATE POLICY "public_contact_messages_admin_update_all" ON public.public_contact_messages
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
