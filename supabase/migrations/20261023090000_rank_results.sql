-- "Rank" leaderboard feature: admin-entered best results per player per
-- athletic/technical test, surfaced to players as a top-10 leaderboard
-- scoped to their own sport (see RankSection.tsx / AdminRankResults.tsx).
-- One row per (player, test) — admin upserts to update a player's best
-- known result rather than accumulating a history of attempts.
CREATE TABLE public.test_rankings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sport text NOT NULL CHECK (sport IN ('football', 'basketball')),
  test_key text NOT NULL,
  time_seconds numeric,
  made_count integer,
  attempted_count integer,
  value numeric,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (player_id, test_key)
);

CREATE INDEX idx_test_rankings_sport_test ON public.test_rankings (sport, test_key);

ALTER TABLE public.test_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view test rankings"
  ON public.test_rankings FOR SELECT USING (true);

CREATE POLICY "Admins can insert test rankings"
  ON public.test_rankings FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update test rankings"
  ON public.test_rankings FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete test rankings"
  ON public.test_rankings FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_test_rankings_updated_at
  BEFORE UPDATE ON public.test_rankings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Admin-only player picker, scoped by sport, for the rank-results admin page
-- (player_profiles has no general-purpose admin SELECT policy, so this
-- mirrors search_all_users' SECURITY DEFINER + has_role gate pattern).
CREATE OR REPLACE FUNCTION public.search_players_by_sport(p_search text DEFAULT NULL, p_sport text DEFAULT NULL, p_limit integer DEFAULT 20)
RETURNS TABLE (user_id uuid, first_name text, last_name text, sport text, photo_url text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT pp.user_id, pp.first_name, pp.last_name, pp.sport, pp.photo_url
  FROM public.player_profiles pp
  WHERE (p_sport IS NULL OR pp.sport = p_sport)
    AND (p_search IS NULL OR p_search = '' OR (pp.first_name || ' ' || pp.last_name) ILIKE '%' || p_search || '%')
  ORDER BY pp.first_name, pp.last_name
  LIMIT p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_players_by_sport(text, text, integer) TO authenticated;
