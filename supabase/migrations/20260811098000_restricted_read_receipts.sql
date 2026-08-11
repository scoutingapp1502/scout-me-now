-- "Cum funcționează restricția" promises: restricted people "won't see...
-- when you've read their messages." am_i_restricted_by() (20260713092000)
-- already covers the sibling promise (hiding online status) and is wired
-- up in MessagesSection.tsx — but the read-receipt half was never
-- implemented: opening a conversation unconditionally marks all unread
-- incoming messages as read=true, with no check for whether the current
-- user has restricted the sender. Restricting someone should suppress
-- their read receipt on messages they send you.
--
-- Symmetric helper to am_i_restricted_by(_other_user_id) — that one
-- answers "did THEY restrict ME", this one answers "did I restrict THEM".
CREATE OR REPLACE FUNCTION public.have_i_restricted(_other_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restricted_accounts
    WHERE restrictor_id = auth.uid() AND restricted_id = _other_user_id
  );
$$;
