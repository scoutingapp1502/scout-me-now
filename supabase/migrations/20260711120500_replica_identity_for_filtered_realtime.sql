-- The realtime subscriptions on follows, agent_collaboration_requests and
-- recommendations now filter on non-primary-key columns (e.g.
-- following_id=eq.<uid>) and listen for DELETE among other events. Under
-- the default REPLICA IDENTITY, a DELETE's "old row" payload only contains
-- the primary key, so Postgres changes filtered on any other column would
-- silently never match a DELETE. REPLICA IDENTITY FULL includes the whole
-- old row so filtered DELETE events are delivered correctly.
ALTER TABLE public.follows REPLICA IDENTITY FULL;
ALTER TABLE public.agent_collaboration_requests REPLICA IDENTITY FULL;
ALTER TABLE public.recommendations REPLICA IDENTITY FULL;
