-- Admin-controlled maintenance mode: a single global settings row (not
-- per-user), pushed live to every connected client via realtime so the
-- warning banner/full-page blocker react instantly without a reload.
--
-- is_scheduled + scheduled_start/scheduled_end drive the "soft" warning
-- banner shown to everyone (player and cauta_jucator alike) ahead of time —
-- purely informational, computed from these fields client-side.
-- is_active is the actual on/off switch: when true, every non-admin is
-- shown the full-page maintenance blocker instead of the dashboard,
-- regardless of whether "now" falls inside the scheduled window (an admin
-- flips this manually rather than relying on a time-based cron, so it can
-- also be turned off early if the fix lands ahead of schedule).
CREATE TABLE IF NOT EXISTS public.maintenance_mode (
  id boolean PRIMARY KEY DEFAULT true CONSTRAINT maintenance_mode_singleton CHECK (id = true),
  is_scheduled boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT false,
  scheduled_start timestamptz,
  scheduled_end timestamptz,
  message text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

INSERT INTO public.maintenance_mode (id) VALUES (true) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.maintenance_mode ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read maintenance mode" ON public.maintenance_mode;
CREATE POLICY "Anyone authenticated can read maintenance mode"
  ON public.maintenance_mode FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Admins can update maintenance mode" ON public.maintenance_mode;
CREATE POLICY "Admins can update maintenance mode"
  ON public.maintenance_mode FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP TRIGGER IF EXISTS trg_maintenance_mode_updated_at ON public.maintenance_mode;
CREATE TRIGGER trg_maintenance_mode_updated_at
  BEFORE UPDATE ON public.maintenance_mode
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'maintenance_mode'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.maintenance_mode;
  END IF;
END $$;
