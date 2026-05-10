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
BEGIN
  _role := COALESCE(NEW.raw_user_meta_data->>'role', 'player');
  _full_name := COALESCE(NEW.raw_user_meta_data->>'full_name', '');
  _first_name := split_part(_full_name, ' ', 1);
  _last_name := CASE WHEN position(' ' in _full_name) > 0 THEN substring(_full_name from position(' ' in _full_name) + 1) ELSE '' END;
  _gender := NEW.raw_user_meta_data->>'gender';
  _sport := COALESCE(NEW.raw_user_meta_data->>'sport', 'football');
  _club_name := NEW.raw_user_meta_data->>'club_name';

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

  IF _role = 'player' THEN
    INSERT INTO public.player_profiles (user_id, first_name, last_name, sport, gender)
    VALUES (NEW.id, _first_name, _last_name, _sport, _gender)
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    INSERT INTO public.scout_profiles (user_id, first_name, last_name, gender, sports, organization)
    VALUES (NEW.id, _first_name, _last_name, _gender, _sports, _club_name)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$function$;