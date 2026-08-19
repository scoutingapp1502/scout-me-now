-- Data-correction migration: user_id 3be6b6db-e5c2-494a-8b3d-baa5b4886b1b
-- ("Marius Velicu") is a real player account — full player_profiles data
-- (position: Atacant, club, athletic tests, etc., confirmed via
-- screenshot) — but was incorrectly left with role = 'cauta_jucator' by
-- 20260806181000_migrate_fabrizio_to_cauta_jucator.sql. That migration's
-- own comment describes its target as "the one kept legacy scout account"
-- ("Fabrizio") — this user_id was migrated in error, it does not match
-- the account the migration was actually meant for.
--
-- Fixes the root cause of two reported problems: this account's card was
-- rendered under Community's "Caută Jucător" tab (scout_profiles-backed)
-- instead of "Jucători" (player_profiles-backed), so a mutually-followed
-- player friend could never find it under Players no matter what
-- account_visibility said. Restoring role = 'player' also matches the
-- account's actual, complete player_profiles data.
UPDATE public.user_roles
SET role = 'player'
WHERE user_id = '3be6b6db-e5c2-494a-8b3d-baa5b4886b1b';

-- The scout_verification_requests row inserted by that same migration
-- (grandfathering the account past document verification) is now
-- meaningless for a player account — remove it so it doesn't linger as
-- stale data if the role is ever changed to cauta_jucator again later.
DELETE FROM public.scout_verification_requests
WHERE user_id = '3be6b6db-e5c2-494a-8b3d-baa5b4886b1b'
  AND reviewer_notes = 'Auto-approved during role-collapse migration (2026-08-06): pre-existing scout account with no prior verification flow, grandfathered in to avoid disrupting an active account.';
