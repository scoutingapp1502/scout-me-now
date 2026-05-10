
-- Role enum
CREATE TYPE public.app_role AS ENUM ('player', 'scout');

-- User roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Profiles table (shared basic info)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Player profiles
CREATE TABLE public.player_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  date_of_birth DATE,
  height_cm INTEGER,
  weight_kg INTEGER,
  nationality TEXT,
  photo_url TEXT,
  position TEXT,
  preferred_foot TEXT,
  current_team TEXT,
  goals INTEGER DEFAULT 0,
  assists INTEGER DEFAULT 0,
  matches_played INTEGER DEFAULT 0,
  video_highlights TEXT[] DEFAULT '{}',
  palmares TEXT,
  cv_url TEXT,
  instagram_url TEXT,
  tiktok_url TEXT,
  twitter_url TEXT,
  agent_name TEXT,
  agent_email TEXT,
  agent_phone TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.player_profiles ENABLE ROW LEVEL SECURITY;

-- Scout profiles
CREATE TABLE public.scout_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  organization TEXT,
  country TEXT,
  bio TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.scout_profiles ENABLE ROW LEVEL SECURITY;

-- Favorites
CREATE TABLE public.favorite_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scout_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  player_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scout_user_id, player_user_id)
);
ALTER TABLE public.favorite_players ENABLE ROW LEVEL SECURITY;

-- Contact requests
CREATE TABLE public.contact_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  requested_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.contact_requests ENABLE ROW LEVEL SECURITY;

-- Helper functions (security definer to avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_player_profiles_updated_at BEFORE UPDATE ON public.player_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_scout_profiles_updated_at BEFORE UPDATE ON public.scout_profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS Policies

-- user_roles: users can read their own role
CREATE POLICY "Users can read own role" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "System inserts roles" ON public.user_roles FOR INSERT WITH CHECK (auth.uid() = user_id);

-- profiles: everyone authenticated can read, users update own
CREATE POLICY "Anyone can read profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- player_profiles: scouts can read all, players read own, players update own
CREATE POLICY "Authenticated can read player profiles" ON public.player_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Anon can read player profiles" ON public.player_profiles FOR SELECT TO anon USING (true);
CREATE POLICY "Players can insert own profile" ON public.player_profiles FOR INSERT WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'player'));
CREATE POLICY "Players can update own profile" ON public.player_profiles FOR UPDATE USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'player'));

-- scout_profiles: authenticated can read, scouts update own
CREATE POLICY "Authenticated can read scout profiles" ON public.scout_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Scouts can insert own profile" ON public.scout_profiles FOR INSERT WITH CHECK (auth.uid() = user_id AND public.has_role(auth.uid(), 'scout'));
CREATE POLICY "Scouts can update own profile" ON public.scout_profiles FOR UPDATE USING (auth.uid() = user_id AND public.has_role(auth.uid(), 'scout'));

-- favorite_players: only scouts
CREATE POLICY "Scouts can manage favorites" ON public.favorite_players FOR ALL USING (auth.uid() = scout_user_id AND public.has_role(auth.uid(), 'scout'));

-- contact_requests: requester or requested can see
CREATE POLICY "Users can see own contact requests" ON public.contact_requests FOR SELECT USING (auth.uid() = requester_user_id OR auth.uid() = requested_user_id);
CREATE POLICY "Scouts can send contact requests" ON public.contact_requests FOR INSERT WITH CHECK (auth.uid() = requester_user_id AND public.has_role(auth.uid(), 'scout'));

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('cvs', 'cvs', false);

-- Storage policies
CREATE POLICY "Anyone can view avatars" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload own avatar" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can update own avatar" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own avatar" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can view own CV" ON storage.objects FOR SELECT USING (bucket_id = 'cvs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can upload own CV" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'cvs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users can delete own CV" ON storage.objects FOR DELETE USING (bucket_id = 'cvs' AND auth.uid()::text = (storage.foldername(name))[1]);
