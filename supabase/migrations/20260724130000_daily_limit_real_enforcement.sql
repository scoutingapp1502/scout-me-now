-- The "Daily limit" setting (DailyLimitSection.tsx) promised "We'll remind
-- you to close SportRise when you spend this amount of time in a day," but
-- it only wrote a value to localStorage — nothing ever read it back to
-- actually show a reminder. Time tracking already exists and works
-- (app_sessions + increment_session_duration, wired via useTimeTracking.ts),
-- so this makes increment_session_duration return the day's running total,
-- letting the client compare it against the saved limit and show a real
-- toast instead of a placebo setting.
--
-- Postgres won't let CREATE OR REPLACE change a function's return type
-- (void -> integer here), so drop the old version first.
DROP FUNCTION IF EXISTS public.increment_session_duration(uuid, date, integer);
CREATE OR REPLACE FUNCTION public.increment_session_duration(
  p_user_id uuid,
  p_date date,
  p_seconds integer
) RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _total integer;
BEGIN
  INSERT INTO public.app_sessions (user_id, date, duration_seconds)
  VALUES (p_user_id, p_date, p_seconds)
  ON CONFLICT (user_id, date)
  DO UPDATE SET duration_seconds = app_sessions.duration_seconds + excluded.duration_seconds
  RETURNING duration_seconds INTO _total;
  RETURN _total;
END;
$$;
