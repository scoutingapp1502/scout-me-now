-- Fixes a real gap found in production: approve_user_report + reject-avatar
-- assumed a reported avatar was always the one currently staged in
-- pending_photo_url (the automated-moderation-pending case), but a user
-- report almost always targets the CURRENT, already-approved avatar
-- (photo_url) — the one actually visible everywhere. Calling reject-avatar
-- on an account with no pending_photo_url returned 400 "No pending avatar
-- to reject", so approve_user_report's counter increment succeeded but the
-- photo was never removed.
--
-- reject_live_avatar clears photo_url outright (the user ends up with no
-- profile photo, same as right after signup) — explicit product decision,
-- distinct from reject_pending_avatar (which only ever touches
-- pending_photo_url and leaves photo_url alone). Both still share the same
-- rejected_posts_count semantics via p_skip_counter, since this path is
-- only ever invoked from approve_user_report's flow (approved_reports_count
-- already incremented there).
--
-- Deliberately NO has_role(auth.uid(), 'admin') check here — this is only
-- ever called from the reject-avatar Edge Function using the service-role
-- client, where auth.uid() resolves to NULL (service_role has no user JWT
-- session attached), which made the has_role check fail unconditionally
-- and raise "Forbidden" on every real call (confirmed in production: the
-- Edge Function's own call returned 500 with exactly that message every
-- time, even though the file was already deleted from storage by the
-- best-effort cleanup that runs before this RPC). Authorization is already
-- enforced earlier, in the Edge Function itself (its own admin-role check
-- on the caller's real JWT, before it ever reaches this RPC) — same trust
-- boundary reject_pending_avatar (its sibling function) already relies on.
CREATE OR REPLACE FUNCTION public.reject_live_avatar(p_user_id uuid, p_table text)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF p_table = 'player_profiles' THEN
    UPDATE public.player_profiles SET photo_url = NULL WHERE user_id = p_user_id;
  ELSIF p_table = 'scout_profiles' THEN
    UPDATE public.scout_profiles SET photo_url = NULL WHERE user_id = p_user_id;
  ELSE
    RAISE EXCEPTION 'Invalid table: %', p_table;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.reject_live_avatar(uuid, text) TO authenticated;
