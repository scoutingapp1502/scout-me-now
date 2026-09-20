import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AccountStatus = "active" | "banned" | "closed";

// Checked once right after login (see Dashboard.tsx) — replaces Supabase
// Auth's ban_duration mechanism, which rejected the login request itself
// before the app's own code ever ran, making it impossible to show the
// user a dedicated explanation page. See
// 20261009090000_account_status_in_app_blocking.sql for the full rationale.
export function useAccountStatus(userId: string | null | undefined) {
  const [status, setStatus] = useState<AccountStatus>("active");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setLoading(false); return; }
    let cancelled = false;

    const fetchStatus = () => {
      (supabase as any)
        .rpc("get_my_account_status")
        .then(({ data, error }: { data: string | null; error: unknown }) => {
          if (cancelled) return;
          if (error) {
            console.error("Failed to load account status:", error);
            // Fail open here, deliberately — this is a UX gate, not a
            // security boundary (RLS/edge functions already enforce the
            // real access control), so a transient fetch failure must not
            // lock a legitimate active user out of the app entirely.
            setStatus("active");
          } else {
            setStatus((data as AccountStatus) ?? "active");
          }
          setLoading(false);
        });
    };

    setLoading(true);
    fetchStatus();

    // An admin acting on this exact user (ban/unban/close) must take effect
    // immediately for a session that's already open, not just on their next
    // manual refresh — a blocked user staying fully functional until they
    // happen to reload defeats the point of blocking them right away.
    // Subscribed on both tables since a given account only ever has a row
    // in one of them, but which one isn't known ahead of time here.
    const channel = supabase
      .channel(`account-status-${userId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "player_profiles", filter: `user_id=eq.${userId}` }, fetchStatus)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "scout_profiles", filter: `user_id=eq.${userId}` }, fetchStatus)
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [userId]);

  return { status, loading };
}
