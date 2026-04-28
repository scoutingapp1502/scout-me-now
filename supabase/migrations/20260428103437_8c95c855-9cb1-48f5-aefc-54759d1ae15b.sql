-- Add best_streak column to track the longest streak ever achieved
ALTER TABLE public.player_test_unlocks
ADD COLUMN IF NOT EXISTS best_streak integer NOT NULL DEFAULT 0;

-- Backfill best_streak from current_streak for existing rows
UPDATE public.player_test_unlocks
SET best_streak = GREATEST(best_streak, current_streak);

-- Drop and recreate ping_daily_visit (return type changed)
DROP FUNCTION IF EXISTS public.ping_daily_visit(text[]);

CREATE OR REPLACE FUNCTION public.ping_daily_visit(_available_tests text[])
 RETURNS TABLE(current_streak integer, unlocked_tests text[], days_until_next_unlock integer, newly_unlocked text, next_test_preview text, best_streak integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _row public.player_test_unlocks%ROWTYPE;
  _today date := (now() AT TIME ZONE 'UTC')::date;
  _gap integer;
  _required integer;
  _candidates text[];
  _new_test text := NULL;
  _days_left integer := 0;
  _grace_earned integer;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  INSERT INTO public.player_test_unlocks (user_id, current_streak, last_visit_date, next_unlock_started_on, best_streak)
  VALUES (_uid, 1, _today, _today, 1)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO _row FROM public.player_test_unlocks WHERE user_id = _uid;

  IF _row.last_visit_date IS NULL THEN
    _row.current_streak := 1;
    _row.last_visit_date := _today;
    _row.next_unlock_started_on := _today;
    _row.grace_days_used := 0;
  ELSE
    _gap := _today - _row.last_visit_date;
    IF _gap = 0 THEN
      NULL;
    ELSIF _gap = 1 THEN
      _row.current_streak := _row.current_streak + 1;
      _row.last_visit_date := _today;
    ELSIF _gap = 2 THEN
      _grace_earned := floor(_row.current_streak / 7);
      IF COALESCE(_row.grace_days_used, 0) < _grace_earned THEN
        _row.grace_days_used := COALESCE(_row.grace_days_used, 0) + 1;
        _row.last_visit_date := _today;
      ELSE
        _row.current_streak := 1;
        _row.last_visit_date := _today;
        _row.next_unlock_started_on := _today;
        _row.next_test_preview := NULL;
        _row.grace_days_used := 0;
      END IF;
    ELSE
      _row.current_streak := 1;
      _row.last_visit_date := _today;
      _row.next_unlock_started_on := _today;
      _row.next_test_preview := NULL;
      _row.grace_days_used := 0;
    END IF;
  END IF;

  -- Update best_streak if current beats it
  IF _row.current_streak > COALESCE(_row.best_streak, 0) THEN
    _row.best_streak := _row.current_streak;
  END IF;

  IF array_length(_row.unlocked_tests, 1) IS NULL OR array_length(_row.unlocked_tests, 1) = 0 THEN
    _required := 3;
  ELSE
    _required := 4;
  END IF;

  IF _row.current_streak >= _required AND array_length(COALESCE(_row.unlocked_tests, '{}'), 1) IS DISTINCT FROM array_length(_available_tests, 1) THEN
    SELECT array_agg(t) INTO _candidates
    FROM unnest(_available_tests) t
    WHERE t <> ALL (COALESCE(_row.unlocked_tests, '{}'::text[]));

    IF _candidates IS NOT NULL AND array_length(_candidates, 1) > 0 THEN
      IF _row.next_test_preview IS NOT NULL AND _row.next_test_preview = ANY(_candidates) THEN
        _new_test := _row.next_test_preview;
      ELSE
        _new_test := _candidates[1 + floor(random() * array_length(_candidates, 1))::int];
      END IF;
      _row.unlocked_tests := array_append(COALESCE(_row.unlocked_tests, '{}'::text[]), _new_test);
      _row.current_streak := 0;
      _row.next_unlock_started_on := _today;
      _row.next_test_preview := NULL;
      _row.grace_days_used := 0;
      _required := 4;
    END IF;
  ELSE
    IF (_required - _row.current_streak) = 1 THEN
      SELECT array_agg(t) INTO _candidates
      FROM unnest(_available_tests) t
      WHERE t <> ALL (COALESCE(_row.unlocked_tests, '{}'::text[]));
      IF _candidates IS NOT NULL AND array_length(_candidates, 1) > 0 THEN
        IF _row.next_test_preview IS NULL OR NOT (_row.next_test_preview = ANY(_candidates)) THEN
          _row.next_test_preview := _candidates[1 + floor(random() * array_length(_candidates, 1))::int];
        END IF;
      END IF;
    ELSE
      _row.next_test_preview := NULL;
    END IF;
  END IF;

  UPDATE public.player_test_unlocks
  SET current_streak = _row.current_streak,
      last_visit_date = _row.last_visit_date,
      unlocked_tests = _row.unlocked_tests,
      next_unlock_started_on = _row.next_unlock_started_on,
      next_test_preview = _row.next_test_preview,
      grace_days_used = _row.grace_days_used,
      best_streak = _row.best_streak
  WHERE user_id = _uid;

  _days_left := GREATEST(_required - _row.current_streak, 0);

  RETURN QUERY SELECT _row.current_streak, _row.unlocked_tests, _days_left, _new_test, _row.next_test_preview, _row.best_streak;
END;
$function$;