-- Full, searchable user directory for admin account actions (ban/close),
-- separate from get_users_at_risk (which only surfaces accounts already
-- past the rejected/reports threshold). An admin needs to be able to warn/
-- block/close ANY account directly, by name or email, not just the ones
-- that already triggered the at-risk list.
--
-- Paginated (real LIMIT/OFFSET, not "fetch everything") since the user base
-- can grow — same discipline as get_community_cards.
CREATE OR REPLACE FUNCTION public.search_all_users(p_search text DEFAULT NULL, p_limit integer DEFAULT 30, p_offset integer DEFAULT 0)
RETURNS TABLE (
  user_id uuid,
  first_name text,
  last_name text,
  role text,
  rejected_posts_count integer,
  approved_reports_count integer,
  warning_count integer,
  email text,
  account_status text
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  WITH players AS (
    SELECT pp.user_id, pp.first_name, pp.last_name, 'player'::text AS role,
           pp.rejected_posts_count, pp.approved_reports_count, pp.warning_count,
           u.email::text, pp.account_status
    FROM public.player_profiles pp
    JOIN auth.users u ON u.id = pp.user_id
  ),
  scouts AS (
    SELECT sp.user_id, sp.first_name, sp.last_name, 'cauta_jucator'::text AS role,
           sp.rejected_posts_count, sp.approved_reports_count, sp.warning_count,
           u.email::text, sp.account_status
    FROM public.scout_profiles sp
    JOIN auth.users u ON u.id = sp.user_id
  ),
  everyone AS (
    SELECT * FROM players
    UNION ALL
    SELECT * FROM scouts
  )
  -- Columns qualified with the CTE alias throughout — RETURNS TABLE's own
  -- OUT parameters (first_name, last_name, email, ...) are otherwise
  -- ambiguous with the identically-named CTE columns inside a PL/pgSQL
  -- function body (confirmed in production: 42702 "column reference
  -- first_name is ambiguous").
  SELECT everyone.* FROM everyone
  WHERE p_search IS NULL OR p_search = ''
     OR (everyone.first_name || ' ' || everyone.last_name) ILIKE '%' || p_search || '%'
     OR everyone.email ILIKE '%' || p_search || '%'
  ORDER BY everyone.first_name, everyone.last_name
  LIMIT p_limit OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_all_users(text, integer, integer) TO authenticated;
