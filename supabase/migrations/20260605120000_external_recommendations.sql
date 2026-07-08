-- External recommendation requests: persoane fara cont in aplicatie
CREATE TABLE public.external_recommendation_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  requester_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  requester_name text NOT NULL,
  target_email text NOT NULL,
  relationship text,
  club text,
  season_from text,
  season_to text,
  message text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed')),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE public.external_recommendation_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "requester_select" ON public.external_recommendation_requests
  FOR SELECT USING (auth.uid() = requester_user_id);

-- Service role (edge functions) can insert/update via service key — no RLS policy needed for that

-- External recommendations: scrise de persoane fara cont
CREATE TABLE public.external_recommendations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.external_recommendation_requests(id) ON DELETE CASCADE,
  recipient_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  author_email text NOT NULL,
  content text NOT NULL,
  status text NOT NULL DEFAULT 'submitted' CHECK (status IN ('submitted', 'accepted', 'rejected')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.external_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recipient_select" ON public.external_recommendations
  FOR SELECT USING (auth.uid() = recipient_user_id);

CREATE POLICY "recipient_update" ON public.external_recommendations
  FOR UPDATE USING (auth.uid() = recipient_user_id)
  WITH CHECK (auth.uid() = recipient_user_id);

CREATE POLICY "recipient_delete" ON public.external_recommendations
  FOR DELETE USING (auth.uid() = recipient_user_id);

CREATE INDEX idx_ext_rec_requests_requester ON public.external_recommendation_requests(requester_user_id);
CREATE INDEX idx_ext_rec_requests_token ON public.external_recommendation_requests(token);
CREATE INDEX idx_ext_recs_recipient ON public.external_recommendations(recipient_user_id, status);
