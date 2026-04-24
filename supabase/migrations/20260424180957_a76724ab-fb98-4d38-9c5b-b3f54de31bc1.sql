
-- Tabel pentru tracking streak zilnic + teste tehnice deblocate per utilizator
CREATE TABLE public.player_test_unlocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  current_streak integer NOT NULL DEFAULT 0,
  last_visit_date date,
  unlocked_tests text[] NOT NULL DEFAULT '{}',
  next_unlock_started_on date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.player_test_unlocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own unlocks"
  ON public.player_test_unlocks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Anyone authenticated can read unlocks for visible profiles"
  ON public.player_test_unlocks FOR SELECT
  TO authenticated
  USING (true);

CREATE TRIGGER trg_player_test_unlocks_updated_at
  BEFORE UPDATE ON public.player_test_unlocks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Funcție RPC: incrementează streak și deblochează un test când e cazul
-- Reguli:
--   - Prima deblocare la 3 zile consecutive
--   - Fiecare deblocare următoare la încă 4 zile consecutive
--   - Dacă utilizatorul ratează o zi (gap > 1) -> streak revine la 1
--   - Maxim 5 teste deblocate (pentru fotbal); funcția primește lista de chei valide
CREATE OR REPLACE FUNCTION public.ping_daily_visit(_available_tests text[])
RETURNS TABLE (
  current_streak integer,
  unlocked_tests text[],
  days_until_next_unlock integer,
  newly_unlocked text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _row public.player_test_unlocks%ROWTYPE;
  _today date := (now() AT TIME ZONE 'UTC')::date;
  _gap integer;
  _required integer;
  _candidates text[];
  _new_test text := NULL;
  _days_left integer := 0;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Inițializează rândul dacă nu există
  INSERT INTO public.player_test_unlocks (user_id, current_streak, last_visit_date, next_unlock_started_on)
  VALUES (_uid, 1, _today, _today)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT * INTO _row FROM public.player_test_unlocks WHERE user_id = _uid;

  -- Calculează gap-ul față de ultima vizită
  IF _row.last_visit_date IS NULL THEN
    _row.current_streak := 1;
    _row.last_visit_date := _today;
    _row.next_unlock_started_on := _today;
  ELSE
    _gap := _today - _row.last_visit_date;
    IF _gap = 0 THEN
      -- aceeași zi, nu schimbăm streak-ul
      NULL;
    ELSIF _gap = 1 THEN
      _row.current_streak := _row.current_streak + 1;
      _row.last_visit_date := _today;
    ELSE
      -- a ratat o zi -> reset
      _row.current_streak := 1;
      _row.last_visit_date := _today;
      _row.next_unlock_started_on := _today;
    END IF;
  END IF;

  -- Determină câte zile sunt necesare pentru următoarea deblocare
  IF array_length(_row.unlocked_tests, 1) IS NULL OR array_length(_row.unlocked_tests, 1) = 0 THEN
    _required := 3;
  ELSE
    _required := 4;
  END IF;

  -- Verifică dacă putem debloca un test nou
  IF _row.current_streak >= _required AND array_length(COALESCE(_row.unlocked_tests, '{}'), 1) IS DISTINCT FROM array_length(_available_tests, 1) THEN
    -- candidații = teste disponibile minus cele deja deblocate
    SELECT array_agg(t) INTO _candidates
    FROM unnest(_available_tests) t
    WHERE t <> ALL (COALESCE(_row.unlocked_tests, '{}'::text[]));

    IF _candidates IS NOT NULL AND array_length(_candidates, 1) > 0 THEN
      _new_test := _candidates[1 + floor(random() * array_length(_candidates, 1))::int];
      _row.unlocked_tests := array_append(COALESCE(_row.unlocked_tests, '{}'::text[]), _new_test);
      -- Resetăm baza pentru următoarea deblocare
      _row.current_streak := 0;
      _row.next_unlock_started_on := _today;
      _required := 4;
    END IF;
  END IF;

  -- Salvăm
  UPDATE public.player_test_unlocks
  SET current_streak = _row.current_streak,
      last_visit_date = _row.last_visit_date,
      unlocked_tests = _row.unlocked_tests,
      next_unlock_started_on = _row.next_unlock_started_on
  WHERE user_id = _uid;

  _days_left := GREATEST(_required - _row.current_streak, 0);

  RETURN QUERY SELECT _row.current_streak, _row.unlocked_tests, _days_left, _new_test;
END;
$$;
