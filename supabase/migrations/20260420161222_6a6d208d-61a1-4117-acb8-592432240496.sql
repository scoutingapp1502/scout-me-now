CREATE TABLE public.athletic_test_registrations (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  first_name text NOT NULL,
  last_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  scheduled_at timestamp with time zone NOT NULL,
  notification_method text NOT NULL DEFAULT 'email',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.athletic_test_registrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own registrations"
  ON public.athletic_test_registrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own registrations"
  ON public.athletic_test_registrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own registrations"
  ON public.athletic_test_registrations FOR DELETE
  USING (auth.uid() = user_id);