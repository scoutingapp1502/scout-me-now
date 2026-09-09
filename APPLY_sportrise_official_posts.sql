-- Official "SportRise" posts: explanatory/announcement content published
-- from the admin panel, shown in every user's Activity feed as a normal
-- post (like/comment via the existing generic post_likes/post_comments
-- tables, which already key off a bare post_id with no FK to a specific
-- table — the same cross-table pattern already used for posts/scout_posts).
-- Unlike a player/scout post, there's no owning user_id — the "author" is
-- the platform itself, so RLS only needs to gate writes to admins.
CREATE TABLE IF NOT EXISTS public.sportrise_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content text NOT NULL,
  image_url text,
  video_url text,
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  is_archived boolean NOT NULL DEFAULT false,
  comments_disabled boolean NOT NULL DEFAULT false,
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_sportrise_posts_created_at ON public.sportrise_posts (created_at DESC);

ALTER TABLE public.sportrise_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone authenticated can read sportrise posts" ON public.sportrise_posts;
CREATE POLICY "Anyone authenticated can read sportrise posts"
  ON public.sportrise_posts FOR SELECT TO authenticated
  USING (deleted_at IS NULL AND is_archived = false);

DROP POLICY IF EXISTS "Admins can insert sportrise posts" ON public.sportrise_posts;
CREATE POLICY "Admins can insert sportrise posts"
  ON public.sportrise_posts FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) AND auth.uid() = created_by);

DROP POLICY IF EXISTS "Admins can update sportrise posts" ON public.sportrise_posts;
CREATE POLICY "Admins can update sportrise posts"
  ON public.sportrise_posts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins can delete sportrise posts" ON public.sportrise_posts;
CREATE POLICY "Admins can delete sportrise posts"
  ON public.sportrise_posts FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- can_comment_on_post() only recognized posts/scout_posts — extend it so
-- SportRise posts can be commented on too, with no follow/visibility gate
-- (it's official platform content, visible and commentable by everyone),
-- just the comments_disabled flag and the existing block check don't apply
-- (no single "owner" to be blocked against).
CREATE OR REPLACE FUNCTION public.can_comment_on_post(_post_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _owner uuid;
  _visibility text;
  _comments_disabled boolean;
BEGIN
  SELECT user_id, comments_disabled INTO _owner, _comments_disabled FROM public.posts WHERE id = _post_id;
  IF _owner IS NULL THEN
    SELECT user_id, comments_disabled INTO _owner, _comments_disabled FROM public.scout_posts WHERE id = _post_id;
  END IF;
  IF _owner IS NULL THEN
    SELECT comments_disabled INTO _comments_disabled FROM public.sportrise_posts WHERE id = _post_id;
    IF FOUND THEN
      RETURN NOT COALESCE(_comments_disabled, false);
    END IF;
    RETURN false;
  END IF;
  IF _comments_disabled THEN RETURN false; END IF;
  IF _owner = auth.uid() THEN RETURN true; END IF;
  IF public.is_blocked_between(auth.uid(), _owner) THEN RETURN false; END IF;

  SELECT posts_comments_visibility INTO _visibility
  FROM public.user_privacy_settings WHERE user_id = _owner;
  _visibility := COALESCE(_visibility, 'everyone');

  IF _visibility = 'everyone' THEN RETURN true; END IF;
  IF _visibility = 'no_one' THEN RETURN false; END IF;

  IF _visibility = 'following' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = _owner AND following_id = auth.uid() AND status = 'accepted'
    );
  END IF;

  IF _visibility = 'followers' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.follows
      WHERE follower_id = auth.uid() AND following_id = _owner AND status = 'accepted'
    );
  END IF;

  IF _visibility = 'following_and_followers' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.follows
      WHERE (follower_id = _owner AND following_id = auth.uid() AND status = 'accepted')
         OR (follower_id = auth.uid() AND following_id = _owner AND status = 'accepted')
    );
  END IF;

  RETURN true;
END;
$$;
