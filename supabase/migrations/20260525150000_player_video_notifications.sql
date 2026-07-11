-- Table to track new video uploads by players (highlights & test videos).
-- Used to notify scouts/agents/club_reps who follow the player.

CREATE TABLE public.player_video_notifications (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID        NOT NULL,
  type      TEXT        NOT NULL CHECK (type IN ('highlight', 'test')),
  video_url TEXT,
  test_key  TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX player_video_notifications_player_created
  ON public.player_video_notifications (player_id, created_at DESC);

ALTER TABLE public.player_video_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read video notifications"
  ON public.player_video_notifications FOR SELECT
  TO authenticated USING (true);

-- -----------------------------------------------------------------------
-- Trigger: new test video submission → insert notification
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_test_video_upload()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = NEW.user_id AND role = 'player'
  ) THEN
    INSERT INTO public.player_video_notifications (player_id, type, video_url, test_key)
    VALUES (NEW.user_id, 'test', NEW.video_url, NEW.test_key);
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_test_video
  AFTER INSERT ON public.video_submissions
  FOR EACH ROW EXECUTE FUNCTION public.notify_test_video_upload();

-- -----------------------------------------------------------------------
-- Trigger: new URL added to player_profiles.video_highlights → insert notification
-- -----------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.notify_highlight_upload()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  new_url  TEXT;
  old_urls TEXT[];
BEGIN
  IF NEW.video_highlights IS NULL OR array_length(NEW.video_highlights, 1) IS NULL THEN
    RETURN NEW;
  END IF;
  old_urls := COALESCE(OLD.video_highlights, ARRAY[]::TEXT[]);
  FOREACH new_url IN ARRAY NEW.video_highlights
  LOOP
    IF NOT (new_url = ANY(old_urls)) THEN
      INSERT INTO public.player_video_notifications (player_id, type, video_url)
      VALUES (NEW.user_id, 'highlight', new_url);
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_highlight
  AFTER UPDATE OF video_highlights ON public.player_profiles
  FOR EACH ROW EXECUTE FUNCTION public.notify_highlight_upload();
