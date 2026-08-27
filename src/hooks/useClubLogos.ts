import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ClubLogo {
  id: string;
  club_name: string;
  logo_url: string;
  sport: string;
}

const DIACRITICS_REGEX = new RegExp("[\\u0300-\\u036f]", "g");

export function normalizeClubName(name: string) {
  return name
    .normalize("NFD")
    .replace(DIACRITICS_REGEX, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

export function useClubLogos() {
  const [logos, setLogos] = useState<ClubLogo[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("club_logos")
      .select("id, club_name, logo_url, sport")
      .order("club_name");
    setLogos(data || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const saveLogo = async (clubName: string, logoUrl: string, adminUserId: string, sport: string) => {
    const { error } = await (supabase as any)
      .from("club_logos")
      .upsert({ club_name: clubName, logo_url: logoUrl, updated_by: adminUserId, sport }, { onConflict: "sport,club_name" });
    if (!error) await fetchAll();
    return { error };
  };

  const updateLogo = async (id: string, fields: { club_name?: string; logo_url?: string }, adminUserId: string) => {
    const { error } = await (supabase as any)
      .from("club_logos")
      .update({ ...fields, updated_by: adminUserId })
      .eq("id", id);
    if (!error) await fetchAll();
    return { error };
  };

  const removeLogo = async (clubName: string, sport: string) => {
    const { error } = await (supabase as any)
      .from("club_logos")
      .delete()
      .eq("club_name", clubName)
      .eq("sport", sport);
    if (!error) await fetchAll();
    return { error };
  };

  const getLogoForTeam = useCallback((teamName?: string | null, sport?: string | null) => {
    if (!teamName) return null;
    const normalized = normalizeClubName(teamName);
    const match = logos.find((l) => normalizeClubName(l.club_name) === normalized && (!sport || l.sport === sport));
    return match?.logo_url || null;
  }, [logos]);

  return { logos, loading, saveLogo, updateLogo, removeLogo, getLogoForTeam, refetch: fetchAll };
}
