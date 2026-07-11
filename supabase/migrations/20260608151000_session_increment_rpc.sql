create or replace function public.increment_session_duration(
  p_user_id uuid,
  p_date date,
  p_seconds integer
) returns void language plpgsql security definer as $$
begin
  insert into public.app_sessions (user_id, date, duration_seconds)
  values (p_user_id, p_date, p_seconds)
  on conflict (user_id, date)
  do update set duration_seconds = app_sessions.duration_seconds + excluded.duration_seconds;
end;
$$;
