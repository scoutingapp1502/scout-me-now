ALTER TABLE public.player_test_unlocks
  ADD COLUMN IF NOT EXISTS login_streak integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS best_login_streak integer NOT NULL DEFAULT 0;

UPDATE public.player_test_unlocks
SET login_streak = GREATEST(login_streak, COALESCE(best_streak, 0)),
    best_login_streak = GREATEST(best_login_streak, COALESCE(best_streak, 0))
WHERE login_streak = 0;