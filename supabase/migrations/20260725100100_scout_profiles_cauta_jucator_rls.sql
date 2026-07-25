-- cauta_jucator mirrors scout/agent for all the RLS policies that gate
-- "own profile / own scouting activity" writes, so it can save its own
-- profile (always allowed, even before verification, per product decision)
-- and use the same scouting features (favorites, contact requests, posts)
-- once approved.
DROP POLICY IF EXISTS "Scouts and agents can insert own profile" ON public.scout_profiles;
CREATE POLICY "Scouts and agents can insert own profile" ON public.scout_profiles
  FOR INSERT TO public
  WITH CHECK (auth.uid() = user_id AND (
    has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'cauta_jucator'::app_role)
  ));

DROP POLICY IF EXISTS "Scouts and agents can update own profile" ON public.scout_profiles;
CREATE POLICY "Scouts and agents can update own profile" ON public.scout_profiles
  FOR UPDATE TO public
  USING (auth.uid() = user_id AND (
    has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'cauta_jucator'::app_role)
  ));

DROP POLICY IF EXISTS "Scouts and agents can insert own posts" ON public.scout_posts;
CREATE POLICY "Scouts and agents can insert own posts" ON public.scout_posts
  FOR INSERT TO public
  WITH CHECK (auth.uid() = user_id AND (
    has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'cauta_jucator'::app_role)
  ));

DROP POLICY IF EXISTS "Scouts and agents can update own posts" ON public.scout_posts;
CREATE POLICY "Scouts and agents can update own posts" ON public.scout_posts
  FOR UPDATE TO public
  USING (auth.uid() = user_id AND (
    has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'cauta_jucator'::app_role)
  ));

DROP POLICY IF EXISTS "Scouts and agents can delete own posts" ON public.scout_posts;
CREATE POLICY "Scouts and agents can delete own posts" ON public.scout_posts
  FOR DELETE TO public
  USING (auth.uid() = user_id AND (
    has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'cauta_jucator'::app_role)
  ));

DROP POLICY IF EXISTS "Scouts and agents can manage favorites" ON public.favorite_players;
CREATE POLICY "Scouts and agents can manage favorites" ON public.favorite_players
  FOR ALL TO public
  USING (auth.uid() = scout_user_id AND (
    has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'cauta_jucator'::app_role)
  ));

DROP POLICY IF EXISTS "Scouts and agents can send contact requests" ON public.contact_requests;
CREATE POLICY "Scouts and agents can send contact requests" ON public.contact_requests
  FOR INSERT TO public
  WITH CHECK (auth.uid() = requester_user_id AND (
    has_role(auth.uid(), 'scout'::app_role) OR has_role(auth.uid(), 'agent'::app_role) OR has_role(auth.uid(), 'cauta_jucator'::app_role)
  ));
