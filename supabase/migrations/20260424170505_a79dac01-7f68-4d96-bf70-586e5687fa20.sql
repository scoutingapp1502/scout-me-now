CREATE OR REPLACE FUNCTION public.can_message_user(_other_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.follows
    WHERE status = 'accepted'
      AND (
        (follower_id = auth.uid() AND following_id = _other_user_id)
        OR
        (follower_id = _other_user_id AND following_id = auth.uid())
      )
  )
$function$;