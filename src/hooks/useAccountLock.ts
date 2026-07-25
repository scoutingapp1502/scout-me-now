import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// A "cauta_jucator" (Search Player) account sees the full dashboard menu
// immediately, but every action that touches another user (follow,
// message, "Acțiuni", commenting, liking, community actions) stays
// disabled until an admin approves their document verification. Own-profile
// editing is never gated. This hook is a no-op (isLocked always false) for
// every other role, by construction, so wiring it into shared components
// cannot regress scout/agent/club_rep/player behavior.
export function useAccountLock(userId: string | null | undefined, userRole: string | null | undefined) {
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userRole !== "cauta_jucator" || !userId) {
      setIsLocked(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (supabase as any)
      .from("scout_verification_requests")
      .select("status")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }: { data: { status: string } | null }) => {
        if (cancelled) return;
        setIsLocked(data?.status !== "approved");
        setLoading(false);
      })
      .catch((err: unknown) => {
        console.error("Failed to load verification status:", err);
        if (cancelled) return;
        // Fail closed: if we can't confirm approval, treat as locked.
        setIsLocked(true);
        setLoading(false);
      });
    return () => { cancelled = true; };
  }, [userId, userRole]);

  return { isLocked, loading };
}
