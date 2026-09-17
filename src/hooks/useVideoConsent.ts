import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useVideoConsent(userId: string | null | undefined) {
  const [hasConsented, setHasConsented] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchConsent = useCallback(async () => {
    if (!userId) { setLoading(false); return; }
    setLoading(true);
    const { data } = await (supabase as any)
      .from("player_profiles")
      .select("video_consent_given_at")
      .eq("user_id", userId)
      .maybeSingle();
    setHasConsented(!!data?.video_consent_given_at);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchConsent();
  }, [fetchConsent]);

  const grantConsent = async () => {
    if (!userId) return { error: new Error("Missing userId") };
    const { error } = await (supabase as any)
      .from("player_profiles")
      .update({ video_consent_given_at: new Date().toISOString() })
      .eq("user_id", userId);
    if (!error) setHasConsented(true);
    return { error };
  };

  return { hasConsented, loading, grantConsent };
}
