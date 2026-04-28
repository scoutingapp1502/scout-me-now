-- Tipuri provocări
CREATE TYPE public.weekly_challenge_type AS ENUM (
  'add_video_highlight',
  'add_match_video',
  'complete_physical_data',
  'complete_career_entry',
  'complete_technical_test'
);

-- Tabel principal provocări săptămânale
CREATE TABLE public.weekly_challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  week_start DATE NOT NULL, -- luni
  challenge_type public.weekly_challenge_type NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- active | completed | expired
  completed_at TIMESTAMP WITH TIME ZONE,
  unlocked_test TEXT,
  baseline JSONB NOT NULL DEFAULT '{}'::jsonb, -- snapshot la creare pentru detectarea progresului
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

ALTER TABLE public.weekly_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view weekly challenges"
ON public.weekly_challenges
FOR SELECT
TO authenticated
USING (true);

-- Inserările/actualizările se fac doar prin funcție SECURITY DEFINER

CREATE TRIGGER trg_weekly_challenges_updated
BEFORE UPDATE ON public.weekly_challenges
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_weekly_challenges_user_week ON public.weekly_challenges(user_id, week_start DESC);

-- Badge-uri câștigate prin provocări săptămânale
CREATE TABLE public.weekly_challenge_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  week_start DATE NOT NULL,
  challenge_type public.weekly_challenge_type NOT NULL,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (user_id, week_start)
);

ALTER TABLE public.weekly_challenge_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view weekly challenge badges"
ON public.weekly_challenge_badges
FOR SELECT
TO authenticated
USING (true);

CREATE INDEX idx_weekly_challenge_badges_user ON public.weekly_challenge_badges(user_id, earned_at DESC);

-- Funcție utilitar: începutul săptămânii curente (luni, UTC)
CREATE OR REPLACE FUNCTION public.current_week_start()
RETURNS DATE
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT (date_trunc('week', (now() AT TIME ZONE 'UTC')))::date;
$$;

-- Funcția principală: obține/creează/verifică provocarea săptămânii
CREATE OR REPLACE FUNCTION public.get_or_create_weekly_challenge(_available_tests text[])
RETURNS TABLE(
  id uuid,
  challenge_type public.weekly_challenge_type,
  status text,
  week_start date,
  completed_at timestamptz,
  unlocked_test text,
  newly_completed boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _week_start date := public.current_week_start();
  _row public.weekly_challenges%ROWTYPE;
  _player public.player_profiles%ROWTYPE;
  _unlocks public.player_test_unlocks%ROWTYPE;
  _types public.weekly_challenge_type[];
  _picked public.weekly_challenge_type;
  _baseline jsonb;
  _is_completed boolean := false;
  _newly_completed boolean := false;
  _candidates text[];
  _new_test text := NULL;
  _video_count int;
  _match_count int;
  _career_count int;
  _baseline_videos int;
  _baseline_matches int;
  _baseline_career int;
  _baseline_tests int;
  _now_tests int;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO _player FROM public.player_profiles WHERE user_id = _uid;
  IF _player.user_id IS NULL THEN
    RAISE EXCEPTION 'Player profile required';
  END IF;

  SELECT * INTO _row FROM public.weekly_challenges
    WHERE user_id = _uid AND week_start = _week_start;

  -- Mark previous week as expired if still active
  UPDATE public.weekly_challenges
    SET status = 'expired'
    WHERE user_id = _uid AND week_start < _week_start AND status = 'active';

  IF _row.id IS NULL THEN
    -- Pick a challenge type, avoiding the one used last week if possible
    _types := ARRAY[
      'add_video_highlight',
      'add_match_video',
      'complete_physical_data',
      'complete_career_entry',
      'complete_technical_test'
    ]::public.weekly_challenge_type[];

    _picked := _types[1 + floor(random() * array_length(_types, 1))::int];

    -- Snapshot baseline for progress detection
    SELECT count(*) INTO _baseline_career FROM public.player_career_entries WHERE user_id = _uid;
    _baseline := jsonb_build_object(
      'video_highlights_count', COALESCE(array_length(_player.video_highlights, 1), 0),
      'full_match_videos_count', COALESCE(array_length(_player.full_match_videos, 1), 0),
      'career_entries_count', _baseline_career,
      'height_cm', _player.height_cm,
      'weight_kg', _player.weight_kg,
      'preferred_foot', _player.preferred_foot,
      'nationality', _player.nationality
    );

    -- Snapshot tests count for technical test challenge
    SELECT * INTO _unlocks FROM public.player_test_unlocks WHERE user_id = _uid;
    _baseline := _baseline || jsonb_build_object(
      'unlocked_tests_count', COALESCE(array_length(_unlocks.unlocked_tests, 1), 0)
    );

    INSERT INTO public.weekly_challenges (user_id, week_start, challenge_type, baseline)
    VALUES (_uid, _week_start, _picked, _baseline)
    RETURNING * INTO _row;
  END IF;

  -- Check completion if still active
  IF _row.status = 'active' THEN
    SELECT * INTO _player FROM public.player_profiles WHERE user_id = _uid;
    _baseline_videos := COALESCE((_row.baseline->>'video_highlights_count')::int, 0);
    _baseline_matches := COALESCE((_row.baseline->>'full_match_videos_count')::int, 0);
    _baseline_career := COALESCE((_row.baseline->>'career_entries_count')::int, 0);
    _baseline_tests := COALESCE((_row.baseline->>'unlocked_tests_count')::int, 0);

    _video_count := COALESCE(array_length(_player.video_highlights, 1), 0);
    _match_count := COALESCE(array_length(_player.full_match_videos, 1), 0);
    SELECT count(*) INTO _career_count FROM public.player_career_entries WHERE user_id = _uid;

    CASE _row.challenge_type
      WHEN 'add_video_highlight' THEN
        _is_completed := _video_count > _baseline_videos;
      WHEN 'add_match_video' THEN
        _is_completed := _match_count > _baseline_matches;
      WHEN 'complete_physical_data' THEN
        _is_completed := _player.height_cm IS NOT NULL
          AND _player.weight_kg IS NOT NULL
          AND _player.preferred_foot IS NOT NULL
          AND _player.nationality IS NOT NULL;
      WHEN 'complete_career_entry' THEN
        _is_completed := _career_count > _baseline_career;
      WHEN 'complete_technical_test' THEN
        SELECT * INTO _unlocks FROM public.player_test_unlocks WHERE user_id = _uid;
        _now_tests := COALESCE(array_length(_unlocks.unlocked_tests, 1), 0);
        -- consider the player completed it if any tech video was uploaded since baseline
        _is_completed := (
          _player.star_shooting_drill_video IS NOT NULL OR
          _player.crossover_video IS NOT NULL OR
          _player.between_the_legs_video IS NOT NULL OR
          _player.double_cross_video IS NOT NULL OR
          _player.between_legs_cross_video IS NOT NULL OR
          _player.free_throw_shooting_video IS NOT NULL OR
          _player.control_pass_video IS NOT NULL OR
          _player.slalom_video IS NOT NULL OR
          _player.precision_video IS NOT NULL OR
          _player.coordination_video IS NOT NULL OR
          _player.long_pass_video IS NOT NULL
        ) AND COALESCE((_row.baseline->>'has_any_tech_video')::boolean, false) IS NOT TRUE;
        -- Simpler: check tests count grew
        IF NOT _is_completed THEN
          _is_completed := _now_tests > _baseline_tests;
        END IF;
    END CASE;

    IF _is_completed THEN
      -- Unlock a random test as reward
      SELECT * INTO _unlocks FROM public.player_test_unlocks WHERE user_id = _uid;
      IF _unlocks.user_id IS NULL THEN
        INSERT INTO public.player_test_unlocks (user_id) VALUES (_uid);
        SELECT * INTO _unlocks FROM public.player_test_unlocks WHERE user_id = _uid;
      END IF;

      SELECT array_agg(t) INTO _candidates
      FROM unnest(_available_tests) t
      WHERE t <> ALL (COALESCE(_unlocks.unlocked_tests, '{}'::text[]));

      IF _candidates IS NOT NULL AND array_length(_candidates, 1) > 0 THEN
        _new_test := _candidates[1 + floor(random() * array_length(_candidates, 1))::int];
        UPDATE public.player_test_unlocks
          SET unlocked_tests = array_append(COALESCE(unlocked_tests, '{}'::text[]), _new_test),
              updated_at = now()
          WHERE user_id = _uid;
      END IF;

      UPDATE public.weekly_challenges
        SET status = 'completed',
            completed_at = now(),
            unlocked_test = _new_test
        WHERE id = _row.id
        RETURNING * INTO _row;

      INSERT INTO public.weekly_challenge_badges (user_id, week_start, challenge_type)
      VALUES (_uid, _week_start, _row.challenge_type)
      ON CONFLICT (user_id, week_start) DO NOTHING;

      _newly_completed := true;
    END IF;
  END IF;

  RETURN QUERY SELECT _row.id, _row.challenge_type, _row.status, _row.week_start,
                      _row.completed_at, _row.unlocked_test, _newly_completed;
END;
$$;