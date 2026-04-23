ALTER TABLE public.follows
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'accepted',
ADD COLUMN IF NOT EXISTS responded_at TIMESTAMP WITH TIME ZONE;

UPDATE public.follows
SET status = 'accepted',
    responded_at = COALESCE(responded_at, created_at)
WHERE status IS DISTINCT FROM 'accepted'
   OR responded_at IS NULL;

CREATE OR REPLACE FUNCTION public.request_follow(_following_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _caller uuid := auth.uid();
  _existing public.follows%ROWTYPE;
  _new_id uuid;
BEGIN
  IF _caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF _caller = _following_id THEN
    RAISE EXCEPTION 'You cannot follow yourself';
  END IF;

  SELECT * INTO _existing
  FROM public.follows
  WHERE follower_id = _caller
    AND following_id = _following_id
  LIMIT 1;

  IF _existing.id IS NULL THEN
    INSERT INTO public.follows (follower_id, following_id, status, responded_at)
    VALUES (_caller, _following_id, 'pending', NULL)
    RETURNING id INTO _new_id;

    RETURN _new_id;
  END IF;

  IF _existing.status = 'accepted' THEN
    RAISE EXCEPTION 'Already following';
  END IF;

  IF _existing.status = 'pending' THEN
    RAISE EXCEPTION 'Follow request already pending';
  END IF;

  UPDATE public.follows
  SET status = 'pending',
      created_at = now(),
      responded_at = NULL
  WHERE id = _existing.id
  RETURNING id INTO _new_id;

  RETURN _new_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.accept_follow_request(_follow_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _follow public.follows%ROWTYPE;
BEGIN
  SELECT * INTO _follow
  FROM public.follows
  WHERE id = _follow_id;

  IF _follow.id IS NULL THEN
    RAISE EXCEPTION 'Follow request not found';
  END IF;

  IF _follow.following_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the recipient can accept this follow request';
  END IF;

  UPDATE public.follows
  SET status = 'accepted',
      responded_at = now()
  WHERE id = _follow_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_follow_request(_follow_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _follow public.follows%ROWTYPE;
BEGIN
  SELECT * INTO _follow
  FROM public.follows
  WHERE id = _follow_id;

  IF _follow.id IS NULL THEN
    RAISE EXCEPTION 'Follow request not found';
  END IF;

  IF _follow.following_id <> auth.uid() THEN
    RAISE EXCEPTION 'Only the recipient can reject this follow request';
  END IF;

  UPDATE public.follows
  SET status = 'rejected',
      responded_at = now()
  WHERE id = _follow_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.can_message_user(_other_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.follows
    WHERE follower_id = auth.uid()
      AND following_id = _other_user_id
      AND status = 'accepted'
  )
$function$;

CREATE OR REPLACE FUNCTION public.get_or_create_conversation(other_user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  conv_id UUID;
  current_user_id UUID := auth.uid();
  u1 UUID;
  u2 UUID;
BEGIN
  IF NOT public.can_message_user(other_user_id) THEN
    RAISE EXCEPTION 'FOLLOW_REQUIRED';
  END IF;

  IF current_user_id < other_user_id THEN
    u1 := current_user_id;
    u2 := other_user_id;
  ELSE
    u1 := other_user_id;
    u2 := current_user_id;
  END IF;

  SELECT id INTO conv_id FROM public.conversations
  WHERE user1_id = u1 AND user2_id = u2;

  IF conv_id IS NULL THEN
    INSERT INTO public.conversations (user1_id, user2_id)
    VALUES (u1, u2)
    RETURNING id INTO conv_id;
  END IF;

  RETURN conv_id;
END;
$function$;

DROP POLICY IF EXISTS "Anyone authenticated can view follows" ON public.follows;
DROP POLICY IF EXISTS "Users can follow others" ON public.follows;
DROP POLICY IF EXISTS "Users can unfollow" ON public.follows;

CREATE POLICY "Users can view accepted follows"
ON public.follows
FOR SELECT
TO authenticated
USING (status = 'accepted');

CREATE POLICY "Users can view sent follow requests"
ON public.follows
FOR SELECT
TO authenticated
USING (auth.uid() = follower_id);

CREATE POLICY "Users can view received follow requests"
ON public.follows
FOR SELECT
TO authenticated
USING (auth.uid() = following_id);

CREATE POLICY "Users can create follow requests"
ON public.follows
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = follower_id AND status = 'pending');

CREATE POLICY "Followers can delete their own follow rows"
ON public.follows
FOR DELETE
TO authenticated
USING (auth.uid() = follower_id);

CREATE POLICY "Recipients can delete incoming follow rows"
ON public.follows
FOR DELETE
TO authenticated
USING (auth.uid() = following_id);

CREATE POLICY "Recipients can update incoming follow requests"
ON public.follows
FOR UPDATE
TO authenticated
USING (auth.uid() = following_id)
WITH CHECK (auth.uid() = following_id);

DROP POLICY IF EXISTS "Users can create conversations" ON public.conversations;
CREATE POLICY "Users can create conversations with approved follows"
ON public.conversations
FOR INSERT
TO authenticated
WITH CHECK (
  (
    auth.uid() = user1_id AND public.can_message_user(user2_id)
  ) OR (
    auth.uid() = user2_id AND public.can_message_user(user1_id)
  )
);

DROP POLICY IF EXISTS "Users can send messages in their conversations" ON public.messages;
CREATE POLICY "Users can send messages in approved conversations"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = sender_id
  AND EXISTS (
    SELECT 1
    FROM public.conversations c
    WHERE c.id = messages.conversation_id
      AND (
        (c.user1_id = auth.uid() AND public.can_message_user(c.user2_id))
        OR
        (c.user2_id = auth.uid() AND public.can_message_user(c.user1_id))
      )
  )
);