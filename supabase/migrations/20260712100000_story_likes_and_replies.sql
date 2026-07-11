-- Stories had a "like" heart button that only toggled local component state
-- (StoryViewer.tsx) and a "reply" input that only showed a fake success
-- toast — neither ever wrote to the database, so there was nothing for a
-- notification to observe. This table gives story likes real persistence
-- (story replies reuse the existing messages/conversations tables).
CREATE TABLE IF NOT EXISTS public.story_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  story_id uuid NOT NULL REFERENCES public.stories(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (story_id, user_id)
);

ALTER TABLE public.story_likes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can view story likes" ON public.story_likes;
DROP POLICY IF EXISTS "Users can like stories" ON public.story_likes;
DROP POLICY IF EXISTS "Users can unlike stories" ON public.story_likes;

CREATE POLICY "Anyone authenticated can view story likes"
  ON public.story_likes FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can like stories"
  ON public.story_likes FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can unlike stories"
  ON public.story_likes FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_story_likes_story_id ON public.story_likes (story_id);
CREATE INDEX IF NOT EXISTS idx_story_likes_user_id ON public.story_likes (user_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'story_likes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.story_likes;
  END IF;
END $$;
