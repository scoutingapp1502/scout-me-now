
-- Create scout_posts table for activity feed
CREATE TABLE public.scout_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.scout_posts ENABLE ROW LEVEL SECURITY;

-- Everyone can read posts
CREATE POLICY "Anyone can read scout posts"
ON public.scout_posts
FOR SELECT
USING (true);

-- Scouts can insert own posts
CREATE POLICY "Scouts can insert own posts"
ON public.scout_posts
FOR INSERT
WITH CHECK (auth.uid() = user_id AND has_role(auth.uid(), 'scout'::app_role));

-- Scouts can update own posts
CREATE POLICY "Scouts can update own posts"
ON public.scout_posts
FOR UPDATE
USING (auth.uid() = user_id AND has_role(auth.uid(), 'scout'::app_role));

-- Scouts can delete own posts
CREATE POLICY "Scouts can delete own posts"
ON public.scout_posts
FOR DELETE
USING (auth.uid() = user_id AND has_role(auth.uid(), 'scout'::app_role));

-- Trigger for updated_at
CREATE TRIGGER update_scout_posts_updated_at
BEFORE UPDATE ON public.scout_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
