import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Eye, Search, Lock } from "lucide-react";

interface ScoutStatsProps {
  userId: string;
  isOwner: boolean;
}

const ScoutStats = ({ userId, isOwner }: ScoutStatsProps) => {
  const [profileViews, setProfileViews] = useState(0);
  const [searchAppearances, setSearchAppearances] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOwner) return;
    fetchStats();
  }, [userId, isOwner]);

  const fetchStats = async () => {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const since = sevenDaysAgo.toISOString();

    const [viewsRes, searchRes] = await Promise.all([
      supabase
        .from("profile_analytics")
        .select("id", { count: "exact", head: true })
        .eq("profile_user_id", userId)
        .eq("event_type", "profile_view")
        .gte("created_at", since),
      supabase
        .from("profile_analytics")
        .select("id", { count: "exact", head: true })
        .eq("profile_user_id", userId)
        .eq("event_type", "search_appearance")
        .gte("created_at", since),
    ]);

    setProfileViews(viewsRes.count || 0);
    setSearchAppearances(searchRes.count || 0);
    setLoading(false);
  };

  if (!isOwner) return null;

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="mb-1">
        <h2 className="font-display text-2xl text-foreground">Statistici</h2>
        <div className="flex items-center gap-1.5 mt-1">
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-muted-foreground text-xs font-body">Confidențial pentru dvs.</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mt-4">
        {/* Profile views */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-muted-foreground" />
            <span className="text-2xl font-bold text-foreground">
              {loading ? "—" : profileViews}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground font-body">
            vizualizări ale profilului
          </p>
          <p className="text-xs text-muted-foreground font-body">
            Descoperiți cine v-a vizitat profilul.
          </p>
        </div>

        {/* Search appearances */}
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <span className="text-2xl font-bold text-foreground">
              {loading ? "—" : searchAppearances}
            </span>
          </div>
          <p className="text-sm font-semibold text-foreground font-body">
            apariții în căutări
          </p>
          <p className="text-xs text-muted-foreground font-body">
            Vizualizați frecvența dvs. de apariție în rezultatele căutărilor.
          </p>
        </div>
      </div>

      <p className="text-xs text-muted-foreground mt-4 font-body">Ultimele 7 zile</p>
    </div>
  );
};

export default ScoutStats;

// Utility function to track analytics events
export const trackAnalyticsEvent = async (
  profileUserId: string,
  eventType: "profile_view" | "post_impression" | "search_appearance",
  viewerUserId?: string
) => {
  try {
    await supabase.from("profile_analytics").insert({
      profile_user_id: profileUserId,
      event_type: eventType,
      viewer_user_id: viewerUserId || null,
    } as any);
  } catch {
    // Silent fail - analytics should not break the app
  }
};
