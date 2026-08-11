-- "Șterge contul" (SettingsSection.tsx's handleDeleteAccount) calls
-- supabase.functions.invoke("delete-account", ...) — but no such edge
-- function exists anywhere in this project (confirmed: not in
-- supabase/functions/, not referenced by any other file). Every attempt
-- to delete an account has always failed with a generic "Eroare la
-- ștergerea contului" toast, for every role. Account deletion has never
-- worked.
--
-- This adds a SECURITY DEFINER RPC the client can call directly instead,
-- self-only (auth.uid(), never a client-supplied id — the previous code
-- passed userId from React state to an edge function, which would have
-- been a privilege-escalation risk had that function ever been
-- implemented naively). It reuses the dynamic delete pattern already
-- proven in 20260806180000_delete_disposable_scout_accounts.sql (scans
-- every public-schema uuid column that looks like a user reference,
-- including tables with no tracked CREATE TABLE migration like
-- scout_experiences, and deletes matching rows).
--
-- Known limitation: this cannot remove the auth.users row itself — that
-- requires the Supabase Admin API (service_role), which must never be
-- callable directly from an authenticated client (it would let any user
-- delete any other user's auth account). All of the account's actual data
-- is fully erased; the auth.users row is left behind but empty/orphaned,
-- with nothing else in the schema referencing it. The client signs the
-- user out immediately after this succeeds.
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
      -- user_roles is deleted last, explicitly, below — deleting it mid-loop
      -- here in unspecified column order could let a later iteration's
      -- has_role()-gated policy (if any table ever adds one) behave
      -- unexpectedly for the remainder of this same statement.
      AND NOT (c.table_name = 'user_roles' AND c.column_name = 'user_id')
  LOOP
    EXECUTE format('DELETE FROM %I.%I WHERE %I = $1', r.table_schema, r.table_name, r.column_name)
      USING _uid;
  END LOOP;

  DELETE FROM public.user_roles WHERE user_id = _uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_my_account() TO authenticated;
