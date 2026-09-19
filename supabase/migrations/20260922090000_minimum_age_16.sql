-- Minimum age of 16 for every account, enforced in the database rather
-- than only in the signup form: the form is the only signup path today,
-- but a direct API call could otherwise skip the field entirely.
--
-- Two layers:
--   1. handle_new_user() now requires a valid date_of_birth in the signup
--      metadata and writes it to the role's profile row (player_profiles
--      already had the column; scout_profiles gets it here).
--   2. A BEFORE INSERT/UPDATE trigger on both profile tables rejects any
--      date_of_birth under 16 years and refuses to clear a date once set,
--      so the value can't be edited below the threshold or removed later.
--
-- Existing accounts without a date_of_birth are intentionally left alone:
-- the trigger only checks the value being written (NULL -> NULL passes).
--
-- Side effect to be aware of: creating a user directly from the Supabase
-- dashboard (Authentication -> Users -> Add user) no longer works, because
-- that form can't attach date_of_birth metadata and the trigger will refuse
-- the row. Create accounts through the app's signup instead and grant any
-- extra role afterwards in SQL.

ALTER TABLE public.scout_profiles
  ADD COLUMN IF NOT EXISTS date_of_birth date;

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
    IF NEW.date_of_birth > (CURRENT_DATE - INTERVAL '16 years')::date THEN
      RAISE EXCEPTION 'MINIMUM_AGE_16' USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_minimum_age_player ON public.player_profiles;
CREATE TRIGGER enforce_minimum_age_player
  BEFORE INSERT OR UPDATE OF date_of_birth ON public.player_profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_minimum_age();

DROP TRIGGER IF EXISTS enforce_minimum_age_scout ON public.scout_profiles;
CREATE TRIGGER enforce_minimum_age_scout
  BEFORE INSERT OR UPDATE OF date_of_birth ON public.scout_profiles
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

  -- The age itself is checked by enforce_minimum_age on the profile insert.
  IF _role = 'player' THEN
    INSERT INTO public.player_profiles (user_id, first_name, last_name, sport, gender, date_of_birth)
    VALUES (NEW.id, _first_name, _last_name, _sport, _gender, _dob)
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    INSERT INTO public.scout_profiles (user_id, first_name, last_name, gender, sports, organization, date_of_birth)
    VALUES (NEW.id, _first_name, _last_name, _gender, _sports, _club_name, _dob)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;
