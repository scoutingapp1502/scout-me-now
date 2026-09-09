-- CommunitySection previously fetched EVERY player_profiles row (up to
-- 1000) and EVERY scout_profiles row (up to 1000) plus several unbounded
-- auxiliary tables on every single visit, then did completion-percentage
-- gating, tab filtering, search, field filtering, sorting and dropdown-
-- option derivation entirely in JS against that in-memory set. At any real
-- user count this doesn't scale — it re-downloads (and re-computes) the
-- whole directory on every page load regardless of what's actually shown.
--
-- This moves completion-gating, filtering, search and sorting into SQL and
-- adds real LIMIT/OFFSET pagination, so the client only ever fetches one
-- page (e.g. 24 cards) at a time. Filter dropdown option lists are served
-- by a separate lightweight RPC (distinct values only, not full rows), and
-- tab counts by another (COUNT only, no rows).
--
-- Player completion mirrors calcPlayerCompletion() in
-- src/lib/profileCompletion.ts exactly (35/25/20/5/5/2.5/2.5/5, threshold
-- >= 55); scout completion mirrors calcScoutCompletion() there
-- (10/10/5/10/10/10/15/10/10/5/5, same threshold). Keep both in sync if
-- either changes.

-- Basic indexes for the filter columns hit most often, so the sequential
-- scan inside get_community_cards/_counts/_filter_options at least skips
-- irrelevant rows quickly instead of evaluating the completion functions
-- against every row every time.
CREATE INDEX IF NOT EXISTS idx_player_profiles_sport ON public.player_profiles (sport);
CREATE INDEX IF NOT EXISTS idx_player_profiles_position ON public.player_profiles (position);
CREATE INDEX IF NOT EXISTS idx_player_profiles_nationality ON public.player_profiles (nationality);
CREATE INDEX IF NOT EXISTS idx_scout_profiles_organization ON public.scout_profiles (organization);
CREATE INDEX IF NOT EXISTS idx_scout_profiles_country ON public.scout_profiles (country);

CREATE OR REPLACE FUNCTION public._player_completion_pct(p public.player_profiles, has_career boolean)
RETURNS numeric
LANGUAGE sql STABLE
AS $$
  SELECT
    (CASE WHEN p.video_highlights IS NOT NULL AND array_length(p.video_highlights, 1) > 0 THEN 35 ELSE 0 END) +
    (CASE WHEN has_career THEN 25 ELSE 0 END) +
    (CASE WHEN p.height_cm IS NOT NULL AND p.weight_kg IS NOT NULL AND p.preferred_foot IS NOT NULL THEN 20 ELSE 0 END) +
    (CASE WHEN p.photo_url IS NOT NULL THEN 5 ELSE 0 END) +
    (CASE WHEN p.position IS NOT NULL THEN 5 ELSE 0 END) +
    (CASE WHEN p.current_team IS NOT NULL THEN 2.5 ELSE 0 END) +
    (CASE WHEN p.nationality IS NOT NULL THEN 2.5 ELSE 0 END) +
    (CASE WHEN p.date_of_birth IS NOT NULL THEN 5 ELSE 0 END)
$$;

CREATE OR REPLACE FUNCTION public._scout_completion_pct(
  s public.scout_profiles,
  has_experience boolean,
  has_post boolean,
  has_education boolean,
  has_certification boolean
)
RETURNS numeric
LANGUAGE sql STABLE
AS $$
  SELECT
    (CASE WHEN s.photo_url IS NOT NULL THEN 10 ELSE 0 END) +
    (CASE WHEN s.first_name IS NOT NULL AND s.last_name IS NOT NULL AND s.country IS NOT NULL THEN 10 ELSE 0 END) +
    (CASE WHEN s.cover_photo_url IS NOT NULL THEN 5 ELSE 0 END) +
    (CASE WHEN s.bio IS NOT NULL AND length(s.bio) > 10 THEN 10 ELSE 0 END) +
    (CASE WHEN s.title IS NOT NULL OR s.organization IS NOT NULL THEN 10 ELSE 0 END) +
    (CASE WHEN s.skills IS NOT NULL AND array_length(s.skills, 1) > 0 THEN 10 ELSE 0 END) +
    (CASE WHEN has_experience THEN 15 ELSE 0 END) +
    (CASE WHEN has_education THEN 10 ELSE 0 END) +
    (CASE WHEN has_certification THEN 10 ELSE 0 END) +
    (CASE WHEN s.languages IS NOT NULL AND array_length(s.languages, 1) > 0 THEN 5 ELSE 0 END) +
    (CASE WHEN has_post THEN 5 ELSE 0 END)
$$;

-- One page of community cards for a given tab, with search/filters applied
-- and completion-gating/verification enforced server-side. Ordered
-- alphabetically by name (same as before), LIMIT/OFFSET paginated.
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

GRANT EXECUTE ON FUNCTION public.get_community_cards(text, text, text, text, text, date, date, integer, text, text, text, text, text, integer, integer) TO authenticated;

-- Tab counts (player / cauta_jucator), same visibility rules as above, no
-- rows returned — just the two counts the tab pills need.
CREATE OR REPLACE FUNCTION public.get_community_counts()
RETURNS TABLE (player_count bigint, cauta_jucator_count bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    (SELECT count(*) FROM public.player_profiles p
      WHERE public._player_completion_pct(p, EXISTS (SELECT 1 FROM public.player_career_entries pce WHERE pce.user_id = p.user_id)) >= 55),
    (SELECT count(*) FROM public.scout_profiles s
      WHERE public.has_role(s.user_id, 'cauta_jucator'::app_role)
        AND public.is_verification_approved(s.user_id)
        AND public._scout_completion_pct(
              s,
              EXISTS (SELECT 1 FROM public.scout_experiences e WHERE e.user_id = s.user_id),
              EXISTS (SELECT 1 FROM public.scout_posts sp WHERE sp.user_id = s.user_id),
              EXISTS (SELECT 1 FROM public.scout_education ed WHERE ed.user_id = s.user_id),
              EXISTS (SELECT 1 FROM public.scout_certifications c WHERE c.user_id = s.user_id)
            ) >= 55);
$$;

GRANT EXECUTE ON FUNCTION public.get_community_counts() TO authenticated;

-- Distinct filter-dropdown option values, computed from the same
-- visible-only rows as get_community_cards (not the full unfiltered
-- table), so option lists stay accurate without shipping full profiles.
CREATE OR REPLACE FUNCTION public.get_community_filter_options(p_role text)
RETURNS TABLE (
  sports text[],
  positions text[],
  nationalities text[],
  organizations text[],
  activity_countries text[],
  sport_specs text[],
  languages text[]
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    CASE WHEN p_role = 'player' THEN
      (SELECT array_agg(DISTINCT p.sport ORDER BY p.sport) FROM public.player_profiles p
        WHERE p.sport IS NOT NULL
          AND public._player_completion_pct(p, EXISTS (SELECT 1 FROM public.player_career_entries pce WHERE pce.user_id = p.user_id)) >= 55)
    ELSE NULL END,
    CASE WHEN p_role = 'player' THEN
      (SELECT array_agg(DISTINCT p.position ORDER BY p.position) FROM public.player_profiles p
        WHERE p.position IS NOT NULL
          AND public._player_completion_pct(p, EXISTS (SELECT 1 FROM public.player_career_entries pce WHERE pce.user_id = p.user_id)) >= 55)
    ELSE NULL END,
    CASE WHEN p_role = 'player' THEN
      (SELECT array_agg(DISTINCT p.nationality ORDER BY p.nationality) FROM public.player_profiles p
        WHERE p.nationality IS NOT NULL
          AND public._player_completion_pct(p, EXISTS (SELECT 1 FROM public.player_career_entries pce WHERE pce.user_id = p.user_id)) >= 55)
    ELSE NULL END,
    CASE WHEN p_role = 'cauta_jucator' THEN
      (SELECT array_agg(DISTINCT s.organization ORDER BY s.organization) FROM public.scout_profiles s
        WHERE s.organization IS NOT NULL
          AND public.has_role(s.user_id, 'cauta_jucator'::app_role)
          AND public.is_verification_approved(s.user_id)
          AND public._scout_completion_pct(s,
                EXISTS (SELECT 1 FROM public.scout_experiences e WHERE e.user_id = s.user_id),
                EXISTS (SELECT 1 FROM public.scout_posts sp WHERE sp.user_id = s.user_id),
                EXISTS (SELECT 1 FROM public.scout_education ed WHERE ed.user_id = s.user_id),
                EXISTS (SELECT 1 FROM public.scout_certifications c WHERE c.user_id = s.user_id)) >= 55)
    ELSE NULL END,
    CASE WHEN p_role = 'cauta_jucator' THEN
      (SELECT array_agg(DISTINCT s.country ORDER BY s.country) FROM public.scout_profiles s
        WHERE s.country IS NOT NULL
          AND public.has_role(s.user_id, 'cauta_jucator'::app_role)
          AND public.is_verification_approved(s.user_id)
          AND public._scout_completion_pct(s,
                EXISTS (SELECT 1 FROM public.scout_experiences e WHERE e.user_id = s.user_id),
                EXISTS (SELECT 1 FROM public.scout_posts sp WHERE sp.user_id = s.user_id),
                EXISTS (SELECT 1 FROM public.scout_education ed WHERE ed.user_id = s.user_id),
                EXISTS (SELECT 1 FROM public.scout_certifications c WHERE c.user_id = s.user_id)) >= 55)
    ELSE NULL END,
    CASE WHEN p_role = 'cauta_jucator' THEN
      (SELECT array_agg(DISTINCT sp_elem ORDER BY sp_elem) FROM public.scout_profiles s, unnest(s.sports) AS sp_elem
        WHERE public.has_role(s.user_id, 'cauta_jucator'::app_role)
          AND public.is_verification_approved(s.user_id)
          AND public._scout_completion_pct(s,
                EXISTS (SELECT 1 FROM public.scout_experiences e WHERE e.user_id = s.user_id),
                EXISTS (SELECT 1 FROM public.scout_posts sp2 WHERE sp2.user_id = s.user_id),
                EXISTS (SELECT 1 FROM public.scout_education ed WHERE ed.user_id = s.user_id),
                EXISTS (SELECT 1 FROM public.scout_certifications c WHERE c.user_id = s.user_id)) >= 55)
    ELSE NULL END,
    CASE WHEN p_role = 'cauta_jucator' THEN
      (SELECT array_agg(DISTINCT lang_elem ORDER BY lang_elem) FROM public.scout_profiles s, unnest(s.languages) AS lang_elem
        WHERE public.has_role(s.user_id, 'cauta_jucator'::app_role)
          AND public.is_verification_approved(s.user_id)
          AND public._scout_completion_pct(s,
                EXISTS (SELECT 1 FROM public.scout_experiences e WHERE e.user_id = s.user_id),
                EXISTS (SELECT 1 FROM public.scout_posts sp2 WHERE sp2.user_id = s.user_id),
                EXISTS (SELECT 1 FROM public.scout_education ed WHERE ed.user_id = s.user_id),
                EXISTS (SELECT 1 FROM public.scout_certifications c WHERE c.user_id = s.user_id)) >= 55)
    ELSE NULL END;
$$;

GRANT EXECUTE ON FUNCTION public.get_community_filter_options(text) TO authenticated;
