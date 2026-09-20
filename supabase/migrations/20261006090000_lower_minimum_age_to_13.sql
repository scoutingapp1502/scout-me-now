-- Lowers the absolute minimum registration age from 16 to 13, and adds a
-- self-declared parental consent flag for the 13-15 age range.
--
-- There is no independent verification of the parent/guardian's identity:
-- this is a checkbox the minor ticks at signup ("a parent/guardian knows
-- about and agrees with this registration"), same trust level as the
-- existing age-of-majority self-declaration. It exists to make the
-- requirement explicit and to give SportRise a documented basis for it,
-- not to prove a real adult was involved.
--
-- Mirrors the two-layer approach of 20260922090000_minimum_age_16.sql:
--   1. handle_new_user() now also reads parental_consent from the signup
--      metadata and records it (as a timestamp) on the profile row.
--   2. enforce_minimum_age() rejects dates of birth under 13 outright, and
--      rejects dates of birth between 13 and 16 that don't carry a
--      parental_consent_at value, so a direct API call can't skip the
--      checkbox any more than it can skip date_of_birth itself.
--
-- Also re-adds date_of_birth with IF NOT EXISTS on both tables: the
-- 20260922090000_minimum_age_16.sql migration that was supposed to add it
-- to scout_profiles was never actually applied to production, so
-- handle_new_user() below would otherwise fail at creation time
-- (check_function_bodies validates the INSERT column list against the
-- real schema).

ALTER TABLE public.player_profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date;

ALTER TABLE public.scout_profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date;

ALTER TABLE public.player_profiles
  ADD COLUMN IF NOT EXISTS parental_consent_at timestamptz;

ALTER TABLE public.scout_profiles
  ADD COLUMN IF NOT EXISTS parental_consent_at timestamptz;

CREATE OR REPLACE FUNCTION public.enforce_minimum_age()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.date_of_birth IS NOT NULL AND NEW.date_of_birth IS NULL THEN
    RAISE EXCEPTION 'DATE_OF_BIRTH_REQUIRED' USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.date_of_birth IS NOT NULL THEN
    IF NEW.date_of_birth < DATE '1900-01-01' THEN
      RAISE EXCEPTION 'DATE_OF_BIRTH_INVALID' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.date_of_birth > (CURRENT_DATE - INTERVAL '13 years')::date THEN
      RAISE EXCEPTION 'MINIMUM_AGE_13' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.date_of_birth > (CURRENT_DATE - INTERVAL '16 years')::date AND NEW.parental_consent_at IS NULL THEN
      RAISE EXCEPTION 'PARENTAL_CONSENT_REQUIRED' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_minimum_age_player ON public.player_profiles;
CREATE TRIGGER enforce_minimum_age_player
  BEFORE INSERT OR UPDATE OF date_of_birth, parental_consent_at ON public.player_profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_minimum_age();

DROP TRIGGER IF EXISTS enforce_minimum_age_scout ON public.scout_profiles;
CREATE TRIGGER enforce_minimum_age_scout
  BEFORE INSERT OR UPDATE OF date_of_birth, parental_consent_at ON public.scout_profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_minimum_age();

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _role text;
  _full_name text;
  _first_name text;
  _last_name text;
  _gender text;
  _sport text;
  _sports text[];
  _club_name text;
  _dob date;
  _parental_consent boolean;
  _parental_consent_at timestamptz;
BEGIN
  _role := COALESCE(NEW.raw_user_meta_data->>'role', 'player');
  _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  _first_name := split_part(_full_name, ' ', 1);
  _last_name := CASE WHEN position(' ' in _full_name) > 0 THEN substring(_full_name from position(' ' in _full_name) + 1) ELSE '' END;
  _gender := NEW.raw_user_meta_data->>'gender';
  _sport := COALESCE(NEW.raw_user_meta_data->>'sport', 'football');
  _club_name := NEW.raw_user_meta_data->>'club_name';

  BEGIN
    _dob := (NEW.raw_user_meta_data->>'date_of_birth')::date;
  EXCEPTION WHEN OTHERS THEN
    _dob := NULL;
  END;
  IF _dob IS NULL THEN
    RAISE EXCEPTION 'DATE_OF_BIRTH_REQUIRED' USING ERRCODE = 'check_violation';
  END IF;

  _parental_consent := COALESCE((NEW.raw_user_meta_data->>'parental_consent')::boolean, false);
  _parental_consent_at := CASE WHEN _parental_consent THEN now() ELSE NULL END;

  IF NEW.raw_user_meta_data ? 'sports' THEN
    SELECT array_agg(elem::text) INTO _sports
    FROM jsonb_array_elements_text(NEW.raw_user_meta_data->'sports') AS elem;
  ELSE
    _sports := '{}'::text[];
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, _role::app_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  INSERT INTO public.profiles (user_id, full_name)
  VALUES (NEW.id, _full_name)
  ON CONFLICT (user_id) DO NOTHING;

  -- The age itself (and the parental consent flag, for 13-15 year olds)
  -- is checked by enforce_minimum_age on the profile insert.
  IF _role = 'player' THEN
    INSERT INTO public.player_profiles (user_id, first_name, last_name, sport, gender, date_of_birth, parental_consent_at)
    VALUES (NEW.id, _first_name, _last_name, _sport, _gender, _dob, _parental_consent_at)
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    INSERT INTO public.scout_profiles (user_id, first_name, last_name, gender, sports, organization, date_of_birth, parental_consent_at)
    VALUES (NEW.id, _first_name, _last_name, _gender, _sports, _club_name, _dob, _parental_consent_at)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;
