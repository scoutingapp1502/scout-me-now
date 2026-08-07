-- "Add to profile" on a report card had no way to know it had already been
-- uploaded once, so a scout could add the same report to their profile
-- repeatedly (duplicate scout_uploaded_reports rows for the same source
-- report). Track which scout_player_reports row an uploaded report came
-- from so the UI can detect "already added" and disable the button.
ALTER TABLE public.scout_uploaded_reports
  ADD COLUMN source_report_id uuid REFERENCES public.scout_player_reports(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scout_uploaded_reports_source_report_id
  ON public.scout_uploaded_reports (source_report_id) WHERE source_report_id IS NOT NULL;
