-- Enable realtime so the admin sidebar's pending-item badges (Verificare
-- Videouri, Verificare Documente Înregistrate, Rapoarte Utilizatori) update
-- live without a manual refresh.
ALTER PUBLICATION supabase_realtime ADD TABLE public.video_submissions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.scout_verification_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE public.support_tickets;
