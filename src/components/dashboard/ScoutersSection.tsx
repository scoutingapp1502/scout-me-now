import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, User, ArrowLeft } from "lucide-react";
import { trackAnalyticsEvent } from "@/components/dashboard/ScoutStats";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import ScoutPersonalProfile from "@/components/dashboard/ScoutPersonalProfile";
import { calcScoutCompletion } from "@/lib/profileCompletion";

interface ScoutCard {
  user_id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  organization: string | null;
  title: string | null;
  country: string | null;
}

const COLORS = [
  "bg-emerald-600",
  "bg-blue-600",
  "bg-orange-500",
  "bg-gray-400",
  "bg-blue-800",
  "bg-orange-400",
];

const ScoutersSection = ({ onNavigateToChat }: { onNavigateToChat?: (userId: string) => void }) => {
  const [scouts, setScouts] = useState<ScoutCard[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedScoutId, setSelectedScoutId] = useState<string | null>(null);
  const { lang } = useLanguage();

  useEffect(() => {
    const fetchScouts = async () => {
      setLoading(true);

      // Fetch agent user_ids to exclude them
      const { data: agentRoles } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "agent");

      const agentUserIds = new Set((agentRoles || []).map((r) => r.user_id));

      const [profilesRes, expRes, postsRes, eduRes, certRes] = await Promise.all([
        supabase
          .from("scout_profiles")
          .select("user_id, first_name, last_name, photo_url, organization, title, country, bio, cover_photo_url, skills, languages")
          .order("first_name", { ascending: true }),
        supabase.from("scout_experiences").select("user_id"),
        supabase.from("scout_posts").select("user_id"),
        supabase.from("scout_education").select("user_id"),
        supabase.from("scout_certifications").select("user_id"),
      ]);

      if (!profilesRes.error && profilesRes.data) {
        const expUserIds = new Set((expRes.data || []).map((e) => e.user_id));
        const postUserIds = new Set((postsRes.data || []).map((p) => p.user_id));
        const eduUserIds = new Set((eduRes.data || []).map((e) => e.user_id));
        const certUserIds = new Set((certRes.data || []).map((c) => c.user_id));

        const visible = profilesRes.data
          .filter((s) => !agentUserIds.has(s.user_id))
          .filter((s) =>
            calcScoutCompletion(s, expUserIds.has(s.user_id), postUserIds.has(s.user_id), eduUserIds.has(s.user_id), certUserIds.has(s.user_id)) >= 55
          );
        setScouts(visible);
      }
      setLoading(false);
    };
    fetchScouts();
  }, []);

  const filtered = scouts.filter((s) => {
    const name = `${s.first_name} ${s.last_name}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  // Track search appearances when user searches
  useEffect(() => {
    if (!search.trim() || filtered.length === 0) return;
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      filtered.forEach((s) => {
        if (s.user_id !== data.user!.id) {
          trackAnalyticsEvent(s.user_id, "search_appearance", data.user!.id);
        }
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [search, filtered.length]);

  if (selectedScoutId) {
    return (
      <div className="space-y-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedScoutId(null)}
          className="mb-4 gap-2 text-muted-foreground hover:text-foreground font-body"
        >
          <ArrowLeft className="h-4 w-4" />
          {lang === "ro" ? "Înapoi la scouteri" : "Back to scouts"}
        </Button>
        <ScoutPersonalProfile userId={selectedScoutId} readOnly onNavigateToChat={onNavigateToChat} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="flex justify-center">
        <div className="relative w-full max-w-md">
          <Input
            placeholder={lang === "ro" ? "Caută un scouter" : "Find a scout"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10 bg-card border-border text-foreground rounded-full h-12 px-5 text-sm"
          />
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Scouts grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 font-body">
          {lang === "ro" ? "Niciun scouter găsit." : "No scouts found."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((scout, idx) => (
            <div
              key={scout.user_id}
              onClick={() => {
                setSelectedScoutId(scout.user_id);
                supabase.auth.getUser().then(({ data }) => {
                  if (data.user && data.user.id !== scout.user_id) {
                    trackAnalyticsEvent(scout.user_id, "profile_view", data.user.id);
                  }
                });
              }}
              className="flex items-center bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors cursor-pointer group"
            >
              {/* Photo area */}
              <div className={`relative w-20 h-24 flex-shrink-0 ${COLORS[idx % COLORS.length]} flex items-end justify-center overflow-hidden`}>
                {scout.photo_url ? (
                  <img
                    src={scout.photo_url}
                    alt={`${scout.first_name} ${scout.last_name}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="h-10 w-10 text-white/70 mb-2" />
                )}
              </div>

              {/* Scout info */}
              <div className="flex-1 px-4 py-3 min-w-0">
                <p className="text-xs text-muted-foreground font-body uppercase tracking-wider truncate">
                  {scout.first_name}
                </p>
                <p className="text-sm font-display text-foreground uppercase tracking-wide truncate">
                  {scout.last_name}
                </p>
              </div>

              {/* Organization / Title badge */}
              <div className="pr-3 flex-shrink-0">
                {scout.organization ? (
                  <span className="text-[10px] text-muted-foreground font-body bg-muted px-2 py-1 rounded">
                    {scout.organization}
                  </span>
                ) : scout.title ? (
                  <span className="text-[10px] text-muted-foreground font-body bg-muted px-2 py-1 rounded">
                    {scout.title}
                  </span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ScoutersSection;
