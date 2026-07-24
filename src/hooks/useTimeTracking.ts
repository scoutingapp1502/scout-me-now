import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const DAILY_LIMIT_KEY = "sportrise_daily_limit";
const LIMIT_NOTIFIED_KEY = "sportrise_daily_limit_notified_date";

function getDailyLimitMinutes(): number | null {
  const stored = localStorage.getItem(DAILY_LIMIT_KEY);
  if (stored === null || stored === "null") return null;
  const n = Number(stored);
  return Number.isFinite(n) ? n : null;
}

function maybeNotifyLimitReached(totalSeconds: number, lang: "ro" | "en" = "ro") {
  const limitMinutes = getDailyLimitMinutes();
  if (limitMinutes === null) return;
  if (totalSeconds < limitMinutes * 60) return;

  const today = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem(LIMIT_NOTIFIED_KEY) === today) return;
  localStorage.setItem(LIMIT_NOTIFIED_KEY, today);

  toast(
    lang === "ro"
      ? `Ai atins limita zilnică de ${limitMinutes} minute pe SportRise.`
      : `You've reached your ${limitMinutes}-minute daily limit on SportRise.`
  );
}

export function useTimeTracking(userId: string | null) {
  const startRef = useRef<number | null>(null);

  const flush = async (uid: string) => {
    if (startRef.current === null) return;
    const elapsed = Math.floor((Date.now() - startRef.current) / 1000);
    startRef.current = null;
    if (elapsed < 2) return;
    const today = new Date().toISOString().slice(0, 10);
    try {
      const { data: totalSeconds } = await (supabase as any).rpc("increment_session_duration", {
        p_user_id: uid,
        p_date: today,
        p_seconds: elapsed,
      });
      if (typeof totalSeconds === "number") {
        maybeNotifyLimitReached(totalSeconds, document.documentElement.lang === "en" ? "en" : "ro");
      }
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
