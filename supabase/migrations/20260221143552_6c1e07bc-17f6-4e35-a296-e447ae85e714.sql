
-- Add fields to scout_profiles for LinkedIn-style profile
ALTER TABLE public.scout_profiles
ADD COLUMN IF NOT EXISTS photo_url TEXT,
ADD COLUMN IF NOT EXISTS cover_photo_url TEXT,
ADD COLUMN IF NOT EXISTS title TEXT,
ADD COLUMN IF NOT EXISTS skills TEXT[];

-- Create scout_experiences table
CREATE TABLE public.scout_experiences (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  organization TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT '',
  location TEXT,
  start_date TEXT,
  end_date TEXT,
  description TEXT,
  skills TEXT[],
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.scout_experiences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all scout experiences"
ON public.scout_experiences FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Users can manage own scout experiences"
ON public.scout_experiences FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own scout experiences"
ON public.scout_experiences FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own scout experiences"
ON public.scout_experiences FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
