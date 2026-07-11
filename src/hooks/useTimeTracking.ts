import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useTimeTracking(userId: string | null) {
  const startRef = useRef<number | null>(null);

  const flush = async (uid: string) => {
    if (startRef.current === null) return;
    const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
    startRef.current = null;
    if (elapsed < 2) return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      await (supabase as any).rpc("increment_session_duration", {
        p_user_id: uid,
        p_date: today,
        p_seconds: elapsed,
      });
    } catch (err) {
      console.error("Failed to record session duration:", err);
    }
  };

  useEffect(() => {
    if (!userId) return;
    const uid = userId;

    startRef.current = Date.now();

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        startRef.current = Date.now();
      } else {
        flush(uid);
      }
    };

    document.addEventListener("visibilitychange", onVisibility);

    // Flush & restart every 60s so data is saved even if tab stays open
    const interval = setInterval(() => {
      if (document.visibilityState === "visible" && startRef.current !== null) {
        flush(uid).then(() => { startRef.current = Date.now(); });
      }
    }, 60000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(interval);
      flush(uid);
    };
  }, [userId]);
}
