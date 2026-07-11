alter table public.player_profiles
  add column if not exists wingspan_cm numeric(5,1) default null;
