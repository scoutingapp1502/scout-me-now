-- The "invite 3 friends -> unlock a test" feature was completely broken:
-- useInviteFriends.ts's unlockTestViaInvite() wrote a bookkeeping row into
-- invite_test_unlocks (which any authenticated user can insert for any
-- test_key with no validation — its RLS policy is "FOR ALL USING
-- (auth.uid() = user_id)" with no WITH CHECK on the actual unlock count),
-- then tried to upsert player_test_unlocks.unlocked_tests directly from the
-- client. player_test_unlocks has no INSERT/UPDATE policy for regular users
-- (writes are meant to only happen through SECURITY DEFINER functions like
-- ping_daily_visit), so that upsert silently failed under RLS every time —
-- the real "unlocked" gate never actually unlocked anything.
--
-- This adds a SECURITY DEFINER RPC that recomputes the validated-invite
-- count server-side (mirroring useInviteFriends.ts's calcCompletion >= 55%
-- rule), checks the caller actually has an unused unlock slot, and performs
-- both writes atomically and correctly.
CREATE OR REPLACE FUNCTION public.unlock_test_via_invite(_test_key text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _validated_count integer;
  _already_unlocked_count integer;
  _available_slots integer;
  _current_tests text[];
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- Recompute validated invite count server-side (completion >= 55%),
  -- mirroring calcCompletion() in src/hooks/useInviteFriends.ts.
  SELECT count(*) INTO _validated_count
  FROM public.invite_uses iu
  JOIN public.player_profiles p ON p.user_id = iu.invitee_id
  WHERE iu.inviter_id = _uid
    AND (
      (CASE WHEN p.video_highlights IS NOT NULL AND array_length(p.video_highlights, 1) > 0 THEN 35 ELSE 0 END) +
      (CASE WHEN p.career_description IS NOT NULL AND p.career_description <> '' THEN 25 ELSE 0 END) +
      (CASE WHEN p.height_cm IS NOT NULL AND p.weight_kg IS NOT NULL AND p.preferred_foot IS NOT NULL THEN 20 ELSE 0 END) +
      (CASE WHEN p.photo_url IS NOT NULL AND p.photo_url <> '' THEN 5 ELSE 0 END) +
      (CASE WHEN p.position IS NOT NULL AND p.position <> '' THEN 5 ELSE 0 END) +
      (CASE WHEN p.current_team IS NOT NULL AND p.current_team <> '' THEN 2.5 ELSE 0 END) +
      (CASE WHEN p.nationality IS NOT NULL AND p.nationality <> '' THEN 2.5 ELSE 0 END) +
      (CASE WHEN p.date_of_birth IS NOT NULL THEN 5 ELSE 0 END)
    ) >= 55;

  SELECT count(*) INTO _already_unlocked_count
  FROM public.invite_test_unlocks WHERE user_id = _uid;

  _available_slots := floor(_validated_count / 3.0) - _already_unlocked_count;

  IF _available_slots <= 0 THEN
    RETURN false;
  END IF;

  IF EXISTS (SELECT 1 FROM public.invite_test_unlocks WHERE user_id = _uid AND test_key = _test_key) THEN
    RETURN false;
  END IF;

  INSERT INTO public.invite_test_unlocks (user_id, test_key) VALUES (_uid, _test_key);

  INSERT INTO public.player_test_unlocks (user_id, unlocked_tests)
  VALUES (_uid, ARRAY[_test_key])
  ON CONFLICT (user_id) DO UPDATE
  SET unlocked_tests = CASE
    WHEN _test_key = ANY(public.player_test_unlocks.unlocked_tests) THEN public.player_test_unlocks.unlocked_tests
    ELSE array_append(public.player_test_unlocks.unlocked_tests, _test_key)
  END;

  RETURN true;
END;
$$;
