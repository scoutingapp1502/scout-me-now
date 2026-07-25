-- ping_daily_visit(_available_tests text[]) trusted the client-supplied test
-- list to decide which technical test gets unlocked next. Since a player's
-- sport (and therefore their real test list) lives in player_profiles.sport
-- and the client can pass any array it wants, a malicious client could pass
-- an arbitrary/foreign test_key array to influence which key ends up in
-- unlocked_tests (e.g. keys belonging to the other sport, or a made-up key).
-- Actual video verification is still admin-gated elsewhere, so this couldn't
-- forge a verified result, but the unlock-gate itself should not trust
-- client input. This recomputes the available test list server-side from
-- the caller's own player_profiles.sport, ignoring the parameter.
CREATE OR REPLACE FUNCTION public.ping_daily_visit(_available_tests text[])
RETURNS TABLE(current_streak integer, unlocked_tests text[], days_until_next_unlock integer, newly_unlocked text, next_test_preview text, best_streak integer, login_streak integer, best_login_streak integer)
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
  _sport text;
  _real_available_tests text[];
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT sport INTO _sport FROM public.player_profiles WHERE user_id = _uid;

  _real_available_tests := CASE COALESCE(_sport, 'football')
    WHEN 'basketball' THEN ARRAY[
      'free_throw_shooting_video', 'star_shooting_drill_video', 'crossover_video',
      'between_the_legs_video', 'double_cross_video', 'between_legs_cross_video'
    ]
    ELSE ARRAY[
      'control_pass_video', 'slalom_video', 'precision_video', 'coordination_video'
    ]
  END;

  INSERT INTO public.player_test_unlocks (user_id, current_streak, last_visit_date, next_unlock_started_on, best_streak, login_streak, best_login_streak)
  VALUES (_uid, 1, _today, _today, 1, 1, 1)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO _row FROM public.player_test_unlocks WHERE user_id = _uid;

  IF _row.last_visit_date IS NULL THEN
    _row.current_streak := 1;
    _row.login_streak := 1;
    _row.last_visit_date := _today;
    _row.next_unlock_started_on := _today;
    _row.grace_days_used := 0;
  ELSE
    _gap := _today - _row.last_visit_date;
    IF _gap = 0 THEN
      IF _row.current_streak < 1 THEN
        _row.current_streak := 1;
      END IF;
      IF COALESCE(_row.login_streak, 0) < 1 THEN
        _row.login_streak := 1;
      END IF;
    ELSIF _gap = 1 THEN
      _row.current_streak := _row.current_streak + 1;
      _row.login_streak := COALESCE(_row.login_streak, 0) + 1;
      _row.last_visit_date := _today;
    ELSIF _gap = 2 THEN
      _grace_earned := floor(COALESCE(_row.login_streak, _row.current_streak) / 7);
      IF COALESCE(_row.grace_days_used, 0) < _grace_earned THEN
        _row.grace_days_used := COALESCE(_row.grace_days_used, 0) + 1;
        _row.last_visit_date := _today;
      ELSE
        _row.current_streak := 1;
        _row.login_streak := 1;
        _row.last_visit_date := _today;
        _row.next_unlock_started_on := _today;
        _row.next_test_preview := NULL;
        _row.grace_days_used := 0;
      END IF;
    ELSE
      _row.current_streak := 1;
      _row.login_streak := 1;
      _row.last_visit_date := _today;
      _row.next_unlock_started_on := _today;
      _row.next_test_preview := NULL;
      _row.grace_days_used := 0;
    END IF;
  END IF;

  IF _row.current_streak > COALESCE(_row.best_streak, 0) THEN
    _row.best_streak := _row.current_streak;
  END IF;
  IF COALESCE(_row.login_streak, 0) > COALESCE(_row.best_login_streak, 0) THEN
    _row.best_login_streak := _row.login_streak;
  END IF;

  IF array_length(_row.unlocked_tests, 1) IS NULL OR array_length(_row.unlocked_tests, 1) = 0 THEN
    _required := 3;
  ELSE
    _required := 4;
  END IF;

  IF _row.current_streak >= _required AND array_length(COALESCE(_row.unlocked_tests, '{}'), 1) IS DISTINCT FROM array_length(_real_available_tests, 1) THEN
    SELECT array_agg(t) INTO _candidates
    FROM unnest(_real_available_tests) t
    WHERE t <> ALL (COALESCE(_row.unlocked_tests, '{}'::text[]));

    IF _candidates IS NOT NULL AND array_length(_candidates, 1) > 0 THEN
      IF _row.next_test_preview IS NOT NULL AND _row.next_test_preview = ANY(_candidates) THEN
        _new_test := _row.next_test_preview;
      ELSE
        _new_test := _candidates[1 + floor(random() * array_length(_candidates, 1))::int];
      END IF;
      _row.unlocked_tests := array_append(COALESCE(_row.unlocked_tests, '{}'::text[]), _new_test);
      _row.current_streak := 1;
      _row.next_unlock_started_on := _today;
      _row.next_test_preview := NULL;
      _row.grace_days_used := 0;
      _required := 4;
    END IF;
  ELSE
    IF (_required - _row.current_streak) = 1 THEN
      SELECT array_agg(t) INTO _candidates
      FROM unnest(_real_available_tests) t
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
      best_streak = _row.best_streak,
      login_streak = _row.login_streak,
      best_login_streak = _row.best_login_streak
  WHERE user_id = _uid;

  _days_left := GREATEST(_required - _row.current_streak, 0);

  RETURN QUERY SELECT _row.current_streak, _row.unlocked_tests, _days_left, _new_test, _row.next_test_preview, _row.best_streak, _row.login_streak, _row.best_login_streak;
END;
$function$;
