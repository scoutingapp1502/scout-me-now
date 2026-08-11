-- Run this in Supabase SQL Editor to apply the "Șterge contul" fix.
-- Fixes: the delete-account button called a Supabase edge function
-- ("delete-account") that doesn't exist anywhere in this project — every
-- deletion attempt always failed with a generic error, for every role.
-- Replaces it with a self-only SQL RPC (auth.uid(), never a client-
-- supplied id) that erases all data associated with the account across
-- every public-schema table, reusing the dynamic delete pattern already
-- proven in 20260806180000_delete_disposable_scout_accounts.sql.
--
-- Known limitation: this cannot remove the auth.users row itself — that
-- requires the Supabase Admin API (service_role), which must never be
-- exposed to an authenticated client. All actual account data is fully
-- erased; the client signs the user out immediately after this succeeds.

-- ===== 20260811099000_delete_my_account_rpc.sql =====
CREATE OR REPLACE FUNCTION public.delete_my_account()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  r RECORD;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  FOR r IN
    SELECT c.table_schema, c.table_name, c.column_name
    FROM information_schema.columns c
    JOIN information_schema.tables t
      ON t.table_schema = c.table_schema AND t.table_name = c.table_name AND t.table_type = 'BASE TABLE'
    WHERE c.table_schema = 'public'
      AND c.data_type = 'uuid'
      AND (
        c.column_name = 'user_id'
        OR c.column_name LIKE '%\_user\_id' ESCAPE '\'
        OR c.column_name IN (
          'follower_id','following_id','sender_id','user1_id','user2_id',
          'created_by','requester_id','requested_id','inviter_id','invitee_id',
          'restrictor_id','restricted_user_id','blocker_id','blocked_id',
          'viewer_id','reviewer_id'
        )
      )
      AND NOT (c.table_name = 'user_roles' AND c.column_name = 'user_id')
  LOOP
    EXECUTE format('DELETE FROM %I.%I WHERE %I = $1', r.table_schema, r.table_name, r.column_name)
      USING _uid;
  END LOOP;

  DELETE FROM public.user_roles WHERE user_id = _uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
