-- Run this in Supabase SQL Editor to apply the "Restricționat" fix.
-- Fixes: "Cum funcționează restricția" promises restricted people won't
-- see when you've read their messages, but MessagesSection.tsx
-- unconditionally marked incoming messages as read=true regardless of
-- whether the sender was restricted. Only the sibling "hide online status"
-- promise was actually implemented. Pre-existing gap, affects both roles
-- equally.

-- ===== 20260811098000_restricted_read_receipts.sql =====
CREATE OR REPLACE FUNCTION public.have_i_restricted(_other_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restricted_accounts
    WHERE restrictor_id = auth.uid() AND restricted_id = _other_user_id
  );
$$;
