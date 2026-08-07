-- "Add people" to an existing group was only ever allowed for the group's
-- creator (group_members_insert required created_by = auth.uid()), which
-- made sense for the bootstrap insert during group creation but is too
-- restrictive for ordinary members adding someone later. Let any current
-- member add people too, still subject to the target's own
-- can_add_to_group() preference.
DROP POLICY IF EXISTS "group_members_insert" ON public.group_members;
CREATE POLICY "group_members_insert" ON public.group_members FOR INSERT
  WITH CHECK (
    (
      EXISTS (SELECT 1 FROM public.group_conversations WHERE id = group_id AND created_by = auth.uid())
      OR public.is_group_member(group_id)
    )
    AND (user_id = auth.uid() OR public.can_add_to_group(user_id))
  );

-- Shareable invite links: a group member generates a token, and anyone who
-- opens the link (and is logged in) can join without needing an existing
-- follow/message relationship with a member — that's the whole point of an
-- invite link. The token is only ever set by an existing member (RLS on the
-- UPDATE below is unchanged / already gated by is_group_member).
ALTER TABLE public.group_conversations
  ADD COLUMN IF NOT EXISTS invite_token uuid UNIQUE;

CREATE OR REPLACE FUNCTION public.join_group_via_invite(_token uuid)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _group_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT id INTO _group_id FROM public.group_conversations WHERE invite_token = _token;
  IF _group_id IS NULL THEN
    RETURN NULL;
  END IF;

  INSERT INTO public.group_members (group_id, user_id)
  VALUES (_group_id, auth.uid())
  ON CONFLICT (group_id, user_id) DO NOTHING;

  RETURN _group_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_group_via_invite(uuid) TO authenticated;
