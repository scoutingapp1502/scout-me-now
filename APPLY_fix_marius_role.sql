-- Run this in Supabase SQL Editor to fix Marius Velicu's role.
-- His account (3be6b6db-e5c2-494a-8b3d-baa5b4886b1b) has full, real
-- player_profiles data (position, club, athletic tests — confirmed via
-- screenshot) but was left with role = 'cauta_jucator' by a migration
-- that mismatched him for a different legacy scout account ("Fabrizio").
-- This is why his card never appeared under Community's "Jucători" tab
-- for a mutually-followed player, no matter what account_visibility said
-- — Community reads player cards from player_profiles + role = 'player',
-- and his was rendering (if at all) under "Caută Jucător" instead.

-- ===== 20260812091000_fix_marius_velicu_role.sql =====
UPDATE public.user_roles
SET role = 'player'
WHERE user_id = '3be6b6db-e5c2-494a-8b3d-baa5b4886b1b';

DELETE FROM public.scout_verification_requests
WHERE user_id = '3be6b6db-e5c2-494a-8b3d-baa5b4886b1b'
  AND reviewer_notes = 'Auto-approved during role-collapse migration (2026-08-06): pre-existing scout account with no prior verification flow, grandfathered in to avoid disrupting an active account.';
