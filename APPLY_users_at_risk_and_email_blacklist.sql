-- Admin tooling for repeat offenders: a visual warning flag, plus a
-- permanent email blacklist for accounts closed irreversibly.

-- Warning is purely informational for the admin panel (per explicit product
-- decision: no automatic ban on the next rejection) — it just highlights an
-- already-warned user in the at-risk list so an admin recognizes them faster
-- next time, without re-reading their whole history.
ALTER TABLE public.player_profiles
  ADD COLUMN IF NOT EXISTS warned_at timestamptz;

-- Lists players with at least p_min_rejected rejected posts, for the admin
-- "users at risk of being blocked" view. Admin-only (SECURITY DEFINER doing
-- its own role check, same pattern as get_my_moderation_counts and friends).
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

  RETURN QUERY
  SELECT pp.user_id, pp.first_name, pp.last_name, pp.rejected_posts_count, pp.warned_at,
         u.email, u.banned_until
  FROM public.player_profiles pp
  JOIN auth.users u ON u.id = pp.user_id
  WHERE pp.rejected_posts_count >= p_min_rejected
  ORDER BY pp.rejected_posts_count DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_users_at_risk(integer) TO authenticated;

-- Sets/clears the warning flag. Admin-only.
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
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_warned(uuid, boolean) TO authenticated;

-- Permanent email blacklist. An entry here means: this email can never
-- register a SportRise account again, ever — checked at signup (via a
-- trigger, so it's enforced no matter which client path creates the
-- auth.users row) and never automatically removed by any code path in this
-- project. Storing the lowercased email (not the user id) is deliberate:
-- the whole point is blocking the *email address* even after the original
-- account and its auth.users row eventually go away.
CREATE TABLE IF NOT EXISTS public.email_blacklist (
  email text PRIMARY KEY,
  reason text,
  blacklisted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  blacklisted_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_blacklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_blacklist_admin_select ON public.email_blacklist;
CREATE POLICY email_blacklist_admin_select ON public.email_blacklist
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- No INSERT/UPDATE/DELETE policy for authenticated/anon on purpose — every
-- write goes through the close-account-permanently Edge Function with the
-- service role, after that function has independently verified the caller
-- is an admin. A client can never add or remove a blacklist entry directly.

-- Enforced at signup time, independent of any client-side check: rejects
-- the auth.users insert outright if the email is blacklisted, so this can't
-- be bypassed by calling the Auth API directly.
CREATE OR REPLACE FUNCTION public.reject_blacklisted_email()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.email_blacklist WHERE email = lower(NEW.email)) THEN
    RAISE EXCEPTION 'This email address is not allowed to register.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reject_blacklisted_email_trigger ON auth.users;
CREATE TRIGGER reject_blacklisted_email_trigger
  BEFORE INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.reject_blacklisted_email();
