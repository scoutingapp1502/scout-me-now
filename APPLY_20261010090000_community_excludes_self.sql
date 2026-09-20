-- Community previously showed the viewer's own card alongside everyone
-- else's (it never had a reason not to — you don't message/follow/scout
-- yourself, but nothing filtered it out either). Excludes auth.uid() at the
-- source in both get_community_cards and get_community_counts, so the tab
-- counts and the actual list stay consistent with each other.
CREATE OR REPLACE FUNCTION public.get_community_cards(
  p_role text,
  p_search text DEFAULT NULL,
  p_sport text DEFAULT NULL,
  p_position text DEFAULT NULL,
  p_nationality text DEFAULT NULL,
  p_dob_from date DEFAULT NULL,
  p_dob_to date DEFAULT NULL,
  p_min_height integer DEFAULT NULL,
  p_preferred_foot text DEFAULT NULL,
  p_sport_spec text DEFAULT NULL,
  p_organization text DEFAULT NULL,
  p_activity_country text DEFAULT NULL,
  p_language text DEFAULT NULL,
  p_limit integer DEFAULT 24,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  user_id uuid,
  role text,
  first_name text,
  last_name text,
  photo_url text,
  sport text,
  "position" text,
  current_team text,
  nationality text,
  date_of_birth date,
  height_cm integer,
  preferred_foot text,
  organization text,
  title text,
  country text,
  sports text[],
  languages text[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH player_rows AS (
    SELECT
      p.user_id, 'player'::text AS role, p.first_name, p.last_name, p.photo_url,
      p.sport, p.position, p.current_team, p.nationality, p.date_of_birth,
      p.height_cm, p.preferred_foot,
      NULL::text AS organization, NULL::text AS title, NULL::text AS country,
      NULL::text[] AS sports, NULL::text[] AS languages
    FROM public.player_profiles p
    WHERE p_role = 'player'
      AND p.user_id <> auth.uid()
      AND public._player_completion_pct(p, EXISTS (SELECT 1 FROM public.player_career_entries pce WHERE pce.user_id = p.user_id)) >= 55
      AND (p_search IS NULL OR p_search = '' OR (p.first_name || ' ' || p.last_name) ILIKE '%' || p_search || '%')
      AND (p_sport IS NULL OR p_sport = 'all' OR p.sport = p_sport)
      AND (p_position IS NULL OR p_position = 'all' OR p.position = p_position)
      AND (p_nationality IS NULL OR p_nationality = 'all' OR p.nationality = p_nationality)
      AND (p_dob_from IS NULL OR p.date_of_birth >= p_dob_from)
      AND (p_dob_to IS NULL OR p.date_of_birth <= p_dob_to)
      AND (p_min_height IS NULL OR p.height_cm >= p_min_height)
      AND (p_preferred_foot IS NULL OR p_preferred_foot = 'all' OR p.preferred_foot = p_preferred_foot)
  ),
  scout_rows AS (
    SELECT
      s.user_id, 'cauta_jucator'::text AS role, s.first_name, s.last_name, s.photo_url,
      NULL::text AS sport, NULL::text AS position, NULL::text AS current_team,
      NULL::text AS nationality, NULL::date AS date_of_birth, NULL::integer AS height_cm,
      NULL::text AS preferred_foot,
      s.organization, s.title, s.country, s.sports, s.languages
    FROM public.scout_profiles s
    WHERE p_role = 'cauta_jucator'
      AND s.user_id <> auth.uid()
      AND public.has_role(s.user_id, 'cauta_jucator'::app_role)
      AND public.is_verification_approved(s.user_id)
      AND public._scout_completion_pct(
            s,
            EXISTS (SELECT 1 FROM public.scout_experiences e WHERE e.user_id = s.user_id),
            EXISTS (SELECT 1 FROM public.scout_posts sp WHERE sp.user_id = s.user_id),
            EXISTS (SELECT 1 FROM public.scout_education ed WHERE ed.user_id = s.user_id),
            EXISTS (SELECT 1 FROM public.scout_certifications c WHERE c.user_id = s.user_id)
          ) >= 55
      AND (p_search IS NULL OR p_search = '' OR (s.first_name || ' ' || s.last_name) ILIKE '%' || p_search || '%')
      AND (p_sport_spec IS NULL OR p_sport_spec = 'all' OR p_sport_spec = ANY(s.sports))
      AND (p_organization IS NULL OR p_organization = 'all' OR s.organization = p_organization)
      AND (p_activity_country IS NULL OR p_activity_country = 'all' OR s.country = p_activity_country)
      AND (p_language IS NULL OR p_language = 'all' OR p_language = ANY(s.languages))
  )
  SELECT * FROM player_rows
  UNION ALL
  SELECT * FROM scout_rows
  ORDER BY first_name, last_name
  LIMIT p_limit OFFSET p_offset;
$$;

-- Tab counts must exclude self too, or the pill numbers wouldn't match how
-- many cards actually show up.
CREATE OR REPLACE FUNCTION public.get_community_counts()
RETURNS TABLE (player_count bigint, cauta_jucator_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.player_profiles p
      WHERE p.user_id <> auth.uid()
        AND public._player_completion_pct(p, EXISTS (SELECT 1 FROM public.player_career_entries pce WHERE pce.user_id = p.user_id)) >= 55),
    (SELECT count(*) FROM public.scout_profiles s
      WHERE s.user_id <> auth.uid()
        AND public.has_role(s.user_id, 'cauta_jucator'::app_role)
        AND public.is_verification_approved(s.user_id)
        AND public._scout_completion_pct(
              s,
              EXISTS (SELECT 1 FROM public.scout_experiences e WHERE e.user_id = s.user_id),
              EXISTS (SELECT 1 FROM public.scout_posts sp WHERE sp.user_id = s.user_id),
              EXISTS (SELECT 1 FROM public.scout_education ed WHERE ed.user_id = s.user_id),
              EXISTS (SELECT 1 FROM public.scout_certifications c WHERE c.user_id = s.user_id)
            ) >= 55);
$$;
