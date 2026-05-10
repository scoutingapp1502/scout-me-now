-- Add unique constraints on user_id for upsert support
ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_unique UNIQUE (user_id);
ALTER TABLE public.player_profiles ADD CONSTRAINT player_profiles_user_id_unique UNIQUE (user_id);
ALTER TABLE public.scout_profiles ADD CONSTRAINT scout_profiles_user_id_unique UNIQUE (user_id);