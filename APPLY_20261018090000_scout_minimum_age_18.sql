-- A Descoperitor (cauta_jucator) account requires being an adult (18+) —
-- explicit product decision. Until now enforce_minimum_age() applied the
-- exact same rule (13, with parental consent for 13-15) to both
-- player_profiles and scout_profiles, since it's the same trigger function
-- attached to both tables with no awareness of which one fired. Scouts
-- interact directly with minor players (see TermsSection.tsx's "Siguranță
-- și comportament" clause and the parental-presence messaging gate in
-- 20261017090000_minor_safety_messaging_and_activity.sql), so a Descoperitor
-- account itself must be an adult — this was previously enforceable client-
-- side only (Auth.tsx never even asked for a different minimum for this
-- role), and not at all server-side, so a direct API call could create a
-- 13-17 year old Scout account.
--
-- TG_TABLE_NAME distinguishes the two callers of the same trigger function
-- rather than duplicating it — player_profiles keeps the existing 13/16
-- rule untouched, scout_profiles now requires 18+ and never asks for
-- parental consent (a legal adult doesn't need one).
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

    IF TG_TABLE_NAME = 'scout_profiles' THEN
      IF NEW.date_of_birth > (CURRENT_DATE - INTERVAL '18 years')::date THEN
        RAISE EXCEPTION 'MINIMUM_AGE_18' USING ERRCODE = 'check_violation';
      END IF;
    ELSE
      IF NEW.date_of_birth > (CURRENT_DATE - INTERVAL '13 years')::date THEN
        RAISE EXCEPTION 'MINIMUM_AGE_13' USING ERRCODE = 'check_violation';
      END IF;
      IF NEW.date_of_birth > (CURRENT_DATE - INTERVAL '16 years')::date AND NEW.parental_consent_at IS NULL THEN
        RAISE EXCEPTION 'PARENTAL_CONSENT_REQUIRED' USING ERRCODE = 'check_violation';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
-- Triggers already exist on both tables (enforce_minimum_age_player,
-- enforce_minimum_age_scout, from 20261006090000_lower_minimum_age_to_13.sql)
-- and don't need to change — CREATE OR REPLACE FUNCTION above is enough.

-- handle_new_user() inserted whatever date_of_birth came from signup
-- metadata straight into scout_profiles too, relying only on the trigger
-- above (which, before this migration, allowed 13+) to catch anything
-- invalid. No change needed there — the trigger now does the right check
-- for scout_profiles automatically since it's the same INSERT path.
