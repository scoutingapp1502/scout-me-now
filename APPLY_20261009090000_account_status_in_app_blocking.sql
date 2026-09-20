-- Replaces Supabase Auth's ban_duration mechanism with an in-app account
-- status the client checks right after login, so a banned/closed user can
-- actually be shown a dedicated page explaining why (with a contact email
-- for the banned case) instead of just failing to authenticate at all.
--
-- This is a deliberate architecture change, not a bug fix: ban_duration
-- rejects the login request itself at the Supabase Auth layer, before the
-- app's own code ever runs — there is no way for the app to intercept that
-- and show a custom page, the two mechanisms are mutually exclusive by
-- construction. account_status lets the login succeed normally and puts
-- the decision (and the UI) entirely in the app's hands.
--
-- 'active' (default) behaves exactly as any account did before this
-- migration. 'banned' is reversible (ban-user's "unban" sets it back to
-- 'active'). 'closed' is permanent — set only by close-account-permanently,
-- alongside the existing email_blacklist entry, and never reset by any
-- code path in this project.
ALTER TABLE public.player_profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'banned', 'closed'));
ALTER TABLE public.scout_profiles
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active'
    CHECK (account_status IN ('active', 'banned', 'closed'));

-- Self-only read — the app checks this immediately after every login, same
-- self-only/admin-only pattern as get_my_avatar_moderation_status and
-- friends elsewhere in this project.
CREATE OR REPLACE FUNCTION public.get_my_account_status()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT account_status FROM public.player_profiles WHERE user_id = auth.uid()),
    (SELECT account_status FROM public.scout_profiles WHERE user_id = auth.uid()),
    'active'
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_my_account_status() TO authenticated;

-- Sets account_status on whichever profile table the account has a row in
-- — exactly one of the two UPDATEs will ever match a given user_id. Called
-- only by ban-user / close-account-permanently (service role); never
-- exposed for a client to call on themselves or anyone else directly.
CREATE OR REPLACE FUNCTION public.set_account_status(p_user_id uuid, p_status text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_status NOT IN ('active', 'banned', 'closed') THEN
    RAISE EXCEPTION 'Invalid account_status: %', p_status;
  END IF;

  UPDATE public.player_profiles SET account_status = p_status WHERE user_id = p_user_id;
  UPDATE public.scout_profiles SET account_status = p_status WHERE user_id = p_user_id;
END;
$$;

-- get_users_at_risk now reports account_status instead of banned_until
-- (auth.users.banned_until is meaningless now that ban-user no longer sets
-- ban_duration) — another changed OUT-parameter shape, so the old
-- signature must be dropped first (see the 20261008090000 migration's note
-- on PostgreSQL error 42P13).
DROP FUNCTION IF EXISTS public.get_users_at_risk(integer);

CREATE OR REPLACE FUNCTION public.get_users_at_risk(p_min_rejected integer DEFAULT 3)
RETURNS TABLE (
  user_id uuid,
  first_name text,
  last_name text,
  rejected_posts_count integer,
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
  SELECT pp.user_id, pp.first_name, pp.last_name, pp.rejected_posts_count, pp.warning_count,
         u.email::text, pp.account_status
  FROM public.player_profiles pp
  JOIN auth.users u ON u.id = pp.user_id
  WHERE pp.rejected_posts_count >= p_min_rejected
  UNION ALL
  SELECT sp.user_id, sp.first_name, sp.last_name, sp.rejected_posts_count, sp.warning_count,
         u.email::text, sp.account_status
  FROM public.scout_profiles sp
  JOIN auth.users u ON u.id = sp.user_id
  WHERE sp.rejected_posts_count >= p_min_rejected
  ORDER BY rejected_posts_count DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_users_at_risk(integer) TO authenticated;
