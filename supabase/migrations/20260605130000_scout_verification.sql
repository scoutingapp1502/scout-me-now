-- Scout verification requests
CREATE TABLE public.scout_verification_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  document_url text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewer_notes text,
  created_at timestamptz DEFAULT now(),
  reviewed_at timestamptz,
  UNIQUE(user_id)
);

ALTER TABLE public.scout_verification_requests ENABLE ROW LEVEL SECURITY;

-- User can see their own request
CREATE POLICY "user_select_own" ON public.scout_verification_requests
  FOR SELECT USING (auth.uid() = user_id);

-- Storage bucket for scout documents (private, admin-only read)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'scout-documents',
  'scout-documents',
  false,
  10485760, -- 10MB
  ARRAY['application/pdf','image/jpeg','image/png','image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- No RLS on storage — access via service role only (edge functions)
