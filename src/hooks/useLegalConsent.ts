import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { TERMS_VERSION, PRIVACY_VERSION } from "@/lib/legalVersions";

const REQUIRED = [
  { consent_type: "terms_of_service", version: TERMS_VERSION },
  { consent_type: "privacy_policy", version: PRIVACY_VERSION },
];

export function useLegalConsent(userId: string | null) {
  const [missing, setMissing] = useState<typeof REQUIRED>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!userId) { setMissing([]); setLoading(false); return; }
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("user_consents")
      .select("consent_type, version")
      .eq("user_id", userId);
    if (error) {
      // Fail open: a missing table/migration must not lock everyone out.
      console.error("user_consents lookup failed:", error);
      setMissing([]);
      setLoading(false);
      return;
    }
    const rows: { consent_type: string; version: string }[] = data || [];
    setMissing(REQUIRED.filter((r) => !rows.some((x) => x.consent_type === r.consent_type && x.version === r.version)));
    setLoading(false);
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);

  const accept = async () => {
    if (!userId || missing.length === 0) return { error: null };
    const { error } = await (supabase as any)
      .from("user_consents")
      .insert(missing.map((m) => ({ user_id: userId, ...m })));
    if (!error) setMissing([]);
    return { error };
  };

  return { needsConsent: !loading && missing.length > 0, loading, accept };
}
