-- Extends the "users at risk of blocking" system (previously player-only)
-- to scouts too, since scout_profiles now also has a rejected_posts_count
-- (avatar-moderation migration) that must actually feed into this list to
-- mean anything. get_users_at_risk and set_user_warned are rewritten to
-- union/branch across both tables; AdminUsersAtRisk.tsx and the ban-user /
-- close-account-permanently Edge Functions need no changes since they only
-- ever worked off generic user_id/email, never assuming "player".
ALTER TABLE public.scout_profiles
  ADD COLUMN IF NOT EXISTS warned_at timestamptz;

CREATE OR REPLACE FUNCTION public.get_users_at_risk(p_min_rejected integer DEFAULT 3)
RETURNS TABLE (
  user_id uuid,
  first_name text,
  last_name text,
  rejected_posts_count integer,
  warned_at timestamptz,
  email text,
  banned_until timestamptz
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  -- auth.users.email is character varying(255), not text — PostgreSQL's
  -- RETURNS TABLE match is strict about this once a UNION ALL is involved
  -- (a plain single SELECT tolerates the implicit varchar→text coercion,
  -- but the combined UNION ALL result column apparently doesn't), so it
  -- must be cast explicitly or every call fails with 42804 "Returned type
  -- character varying(255) does not match expected type text in column 6."
  RETURN QUERY
  SELECT pp.user_id, pp.first_name, pp.last_name, pp.rejected_posts_count, pp.warned_at,
         u.email::text, u.banned_until
  FROM public.player_profiles pp
  JOIN auth.users u ON u.id = pp.user_id
  WHERE pp.rejected_posts_count >= p_min_rejected
  UNION ALL
  SELECT sp.user_id, sp.first_name, sp.last_name, sp.rejected_posts_count, sp.warned_at,
         u.email::text, u.banned_until
  FROM public.scout_profiles sp
  JOIN auth.users u ON u.id = sp.user_id
  WHERE sp.rejected_posts_count >= p_min_rejected
  ORDER BY rejected_posts_count DESC;
END;
$$;

-- Same warning flag, now settable regardless of which profile table the
-- account actually has a row in — tries player_profiles first, then
-- scout_profiles, exactly one of which will ever match for a given user_id.
CREATE OR REPLACE FUNCTION public.set_user_warned(p_user_id uuid, p_warned boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  UPDATE public.player_profiles
  SET warned_at = CASE WHEN p_warned THEN now() ELSE NULL END
  WHERE user_id = p_user_id;

  UPDATE public.scout_profiles
  SET warned_at = CASE WHEN p_warned THEN now() ELSE NULL END
  WHERE user_id = p_user_id;
END;
$$;
