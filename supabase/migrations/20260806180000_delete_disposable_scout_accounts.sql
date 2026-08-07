-- Deletes 6 disposable scout/club_rep test accounts, as part of collapsing
-- the app's role system down to just player/cauta_jucator ("Descoperitor").
-- These accounts were created purely for testing and are being retired
-- rather than migrated. Fabrizio's account (3be6b6db-...) is deliberately
-- excluded here -- see the companion migration that migrates his role to
-- cauta_jucator instead of deleting him.
--
-- Many content tables in this schema have NO foreign key back to
-- auth.users (confirmed via pg_constraint, not just by reading migration
-- files -- scout_experiences in particular has no tracked CREATE TABLE at
-- all): follows, conversations, messages, posts, scout_posts, post_likes,
-- post_comments, comment_likes, agent_collaboration_requests,
-- agent_manual_players, recommendations, scout_player_notes,
-- profile_analytics, scout_education, scout_certifications,
-- scout_experiences. A plain DELETE FROM auth.users would silently orphan
-- rows in all of these instead of erroring. Clean up explicitly first,
-- schema-wide, then delete the auth.users rows as a final safety net for
-- the tables that do have a real FK cascade.
DO $$
DECLARE
  target_ids uuid[] := ARRAY[
    'd85b1653-c57a-4b99-a24d-23cbe80cbb66',
    '46b16959-7739-4b41-8056-22f131804b16',
    '8297a627-6955-4cbe-b571-63d83b7b9ab6',
    'fff2acc9-6914-48a1-ab4c-a0577c919d3f',
    '8249a9ee-6838-4eca-89de-03780bf0dc79',
    '499c9ba9-f2e2-4ea1-9dcd-b3961772d4fc'
  ]::uuid[];
  r RECORD;
  found_count int;
BEGIN
  -- Sanity guards: refuse to run against a differently-shaped DB than the
  -- one this was audited against.
  SELECT count(*) INTO found_count FROM public.user_roles WHERE user_id = ANY(target_ids);
  IF found_count <> 6 THEN
    RAISE EXCEPTION 'Expected exactly 6 user_roles rows for the target ids, found %. Aborting.', found_count;
  END IF;
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = ANY(target_ids) AND role NOT IN ('scout','club_rep')) THEN
    RAISE EXCEPTION 'A target id has an unexpected role (not scout/club_rep). Aborting.';
  END IF;
  IF '3be6b6db-e5c2-494a-8b3d-baa5b4886b1b'::uuid = ANY(target_ids) THEN
    RAISE EXCEPTION 'Fabrizio''s id must not be in the delete list. Aborting.';
  END IF;

  -- Delete every row in every public-schema table whose column looks like
  -- a user reference and holds one of the target ids.
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
  LOOP
    EXECUTE format('DELETE FROM %I.%I WHERE %I = ANY($1)', r.table_schema, r.table_name, r.column_name)
      USING target_ids;
  END LOOP;

  -- Final safety net for tables that DO have a real FK cascade (user_roles,
  -- profiles, scout_profiles, scout_verification_requests,
  -- scout_uploaded_reports, scout_player_reports, story_likes, stories,
  -- support_tickets, group_members, group_messages, group_conversations,
  -- external_recommendation_requests/external_recommendations, invite_*) --
  -- no-op for those already cleaned above.
  DELETE FROM auth.users WHERE id = ANY(target_ids);
END $$;

-- Post-flight verification: should print nothing. If it prints anything,
-- the deletion above missed a table -- investigate before considering this
-- migration successful (this is exactly how a table like scout_experiences,
-- which has no tracked migration, could otherwise get missed).
DO $$
DECLARE
  r RECORD;
  cnt bigint;
  target_ids uuid[] := ARRAY[
    'd85b1653-c57a-4b99-a24d-23cbe80cbb66',
    '46b16959-7739-4b41-8056-22f131804b16',
    '8297a627-6955-4cbe-b571-63d83b7b9ab6',
    'fff2acc9-6914-48a1-ab4c-a0577c919d3f',
    '8249a9ee-6838-4eca-89de-03780bf0dc79',
    '499c9ba9-f2e2-4ea1-9dcd-b3961772d4fc'
  ]::uuid[];
BEGIN
  FOR r IN
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public' AND data_type = 'uuid'
  LOOP
    EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I = ANY($1)', r.table_schema, r.table_name, r.column_name)
      INTO cnt USING target_ids;
    IF cnt > 0 THEN
      RAISE WARNING 'ORPHANED ROWS REMAIN: %.%.% has % row(s)', r.table_schema, r.table_name, r.column_name, cnt;
    END IF;
  END LOOP;
END $$;
