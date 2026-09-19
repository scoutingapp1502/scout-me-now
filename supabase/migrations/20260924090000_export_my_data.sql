-- Self-service data export (GDPR art. 20, right to portability). Until now
-- the Privacy Policy promised a manual process via the contact form and
-- nothing in the app could actually produce a copy of a user's data.
--
-- Same dynamic scan as delete_my_account(), but over a deliberately
-- narrower set of columns: only those where the user is the *actor/owner*
-- of the row (their profile, their posts, messages they sent, people they
-- follow, accounts they blocked, reports they filed...). Columns where the
-- user is the *target* of someone else's action (blocked_id, following_id,
-- reported_user_id, player_user_id in a scout's favourites, ...) are left
-- out on purpose: those rows are other people's data about this user, and
-- handing them over would expose what others did privately.
--
-- Self-only by construction (auth.uid()), returns one jsonb document keyed
-- "<table>.<column>" so a table reachable through two columns doesn't
-- collapse into one key.
CREATE OR REPLACE FUNCTION public.export_my_data()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  r RECORD;
  _rows jsonb;
  _account jsonb;
  _tables jsonb := '{}'::jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'created_at', u.created_at,
    'last_sign_in_at', u.last_sign_in_at
  )
  INTO _account
  FROM auth.users u
  WHERE u.id = _uid;

  FOR r IN
    SELECT c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.data_type = 'uuid'
      AND c.column_name IN (
        'user_id','sender_id','created_by','author_id',
        'follower_id','requester_id','requester_user_id','inviter_id',
        'blocker_id','restrictor_id','viewer_id','reviewer_id','scout_user_id'
      )
    ORDER BY c.table_name, c.column_name
  LOOP
    EXECUTE format(
      'SELECT COALESCE(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) FROM %I.%I x WHERE %I = $1',
      'public', r.table_name, r.column_name
    )
    INTO _rows USING _uid;

    IF jsonb_array_length(_rows) > 0 THEN
      _tables := _tables || jsonb_build_object(r.table_name || '.' || r.column_name, _rows);
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'exported_at', now(),
    'account', _account,
    'data', _tables
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.export_my_data() TO authenticated;
