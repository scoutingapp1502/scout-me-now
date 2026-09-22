import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// A player account aged 13-15 (see is_restricted_minor() in
// 20261017090000_minor_safety_messaging_and_activity.sql) keeps full access
// to the normal Activity feed and can still report content, but cannot like
// or comment on anything, anywhere — enforced here for the UI (disabled
// buttons) and, independently, by RLS on post_likes/comment_likes/
// post_comments as the real backstop (a modified client can't bypass it,
// this hook only controls what the button looks like).
export function useRestrictedMinor(userId: string | null | undefined) {
  const [isRestrictedMinor, setIsRestrictedMinor] = useState(false);

  useEffect(() => {
    if (!userId) {
      setIsRestrictedMinor(false);
      return;
    }
    let cancelled = false;
    (supabase as any)
      .rpc("is_restricted_minor", { _user_id: userId })
      .then(({ data }: { data: boolean | null }) => {
        if (!cancelled) setIsRestrictedMinor(!!data);
      })
      .catch((err: unknown) => {
        console.error("Failed to check restricted-minor status:", err);
      });
    return () => { cancelled = true; };
  }, [userId]);

  return { isRestrictedMinor };
}
