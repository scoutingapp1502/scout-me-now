
-- Fix scout_profiles: allow agents to insert and update
DROP POLICY "Scouts can insert own profile" ON public.scout_profiles;
CREATE POLICY "Scouts and agents can insert own profile" ON public.scout_profiles
  FOR INSERT TO public
  WITH CHECK (auth.uid() = user_id AND (has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'agent'::app_role)));

DROP POLICY "Scouts can update own profile" ON public.scout_profiles;
CREATE POLICY "Scouts and agents can update own profile" ON public.scout_profiles
  FOR UPDATE TO public
  USING (auth.uid() = user_id AND (has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'agent'::app_role)));

-- Fix scout_posts: allow agents
DROP POLICY "Scouts can insert own posts" ON public.scout_posts;
CREATE POLICY "Scouts and agents can insert own posts" ON public.scout_posts
  FOR INSERT TO public
  WITH CHECK (auth.uid() = user_id AND (has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'agent'::app_role)));

DROP POLICY "Scouts can update own posts" ON public.scout_posts;
CREATE POLICY "Scouts and agents can update own posts" ON public.scout_posts
  FOR UPDATE TO public
  USING (auth.uid() = user_id AND (has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'agent'::app_role)));

DROP POLICY "Scouts can delete own posts" ON public.scout_posts;
CREATE POLICY "Scouts and agents can delete own posts" ON public.scout_posts
  FOR DELETE TO public
  USING (auth.uid() = user_id AND (has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'agent'::app_role)));

-- Fix favorite_players: allow agents
DROP POLICY "Scouts can manage favorites" ON public.favorite_players;
CREATE POLICY "Scouts and agents can manage favorites" ON public.favorite_players
  FOR ALL TO public
  USING (auth.uid() = scout_user_id AND (has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'agent'::app_role)));

-- Fix contact_requests: allow agents to send
DROP POLICY "Scouts can send contact requests" ON public.contact_requests;
CREATE POLICY "Scouts and agents can send contact requests" ON public.contact_requests
  FOR INSERT TO public
  WITH CHECK (auth.uid() = requester_user_id AND (has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'agent'::app_role)));
