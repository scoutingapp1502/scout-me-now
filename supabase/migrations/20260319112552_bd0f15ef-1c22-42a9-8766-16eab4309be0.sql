
-- Create profile analytics events table
CREATE TABLE public.profile_analytics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_user_id uuid NOT NULL,
  event_type text NOT NULL, -- 'profile_view', 'search_appearance', 'post_impression'
  viewer_user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast queries
CREATE INDEX idx_profile_analytics_user_type ON public.profile_analytics (profile_user_id, event_type, created_at);

-- Enable RLS
ALTER TABLE public.profile_analytics ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can insert analytics events
CREATE POLICY "Authenticated can insert analytics"
ON public.profile_analytics FOR INSERT TO authenticated
WITH CHECK (true);

-- Users can only read their own analytics
CREATE POLICY "Users can read own analytics"
ON public.profile_analytics FOR SELECT TO authenticated
USING (profile_user_id = auth.uid());
