import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, User, ArrowLeft } from "lucide-react";
import { trackAnalyticsEvent } from "@/components/dashboard/ScoutStats";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import ScoutPersonalProfile from "@/components/dashboard/ScoutPersonalProfile";
import { calcClubRepCompletion } from "@/lib/profileCompletion";

interface ClubRepCard {
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

const ClubRepsSection = ({ onNavigateToChat }: { onNavigateToChat?: (userId: string) => void }) => {
  const [reps, setReps] = useState<ClubRepCard[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { lang } = useLanguage();

  useEffect(() => {
    const fetchReps = async () => {
      setLoading(true);

      const { data: roleData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "club_rep" as any);

      const repUserIds = new Set((roleData || []).map((r) => r.user_id));

      if (repUserIds.size === 0) {
        setReps([]);
        setLoading(false);
        return;
      }

      const [profilesRes, expRes, postsRes, certRes] = await Promise.all([
        supabase
          .from("scout_profiles")
          .select("user_id, first_name, last_name, photo_url, organization, title, country, bio, cover_photo_url, skills, languages")
          .in("user_id", Array.from(repUserIds))
          .order("first_name", { ascending: true }),
        supabase.from("scout_experiences").select("user_id"),
        supabase.from("scout_posts").select("user_id"),
        supabase.from("scout_certifications").select("user_id"),
      ]);

      if (!profilesRes.error && profilesRes.data) {
        const expUserIds = new Set((expRes.data || []).map((e) => e.user_id));
        const postUserIds = new Set((postsRes.data || []).map((p) => p.user_id));
        const certUserIds = new Set((certRes.data || []).map((c) => c.user_id));

        const visible = profilesRes.data.filter((s) =>
          calcClubRepCompletion(s, expUserIds.has(s.user_id), certUserIds.has(s.user_id), postUserIds.has(s.user_id)) >= 55
        );
        setReps(visible);
      }
      setLoading(false);
    };
    fetchReps();
  }, []);

  const filtered = reps.filter((a) => {
    const name = `${a.first_name} ${a.last_name} ${a.organization ?? ""}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  useEffect(() => {
    if (!search.trim() || filtered.length === 0) return;
    const timer = setTimeout(async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) return;
      filtered.forEach((a) => {
        if (a.user_id !== data.user!.id) {
          trackAnalyticsEvent(a.user_id, "search_appearance", data.user!.id);
        }
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [search, filtered.length]);

  if (selectedId) {
    return (
      <div className="space-y-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedId(null)}
          className="mb-4 gap-2 text-muted-foreground hover:text-foreground font-body"
        >
          <ArrowLeft className="h-4 w-4" />
          {lang === "ro" ? "Înapoi la reprezentanți" : "Back to representatives"}
        </Button>
        <ScoutPersonalProfile userId={selectedId} readOnly onNavigateToChat={onNavigateToChat} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className="relative w-full max-w-md">
          <Input
            placeholder={lang === "ro" ? "Caută un reprezentant" : "Find a representative"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10 bg-card border-border text-foreground rounded-full h-12 px-5 text-sm"
          />
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 font-body">
          {lang === "ro" ? "Niciun reprezentant găsit." : "No representatives found."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((rep, idx) => (
            <div
              key={rep.user_id}
              onClick={() => {
                setSelectedId(rep.user_id);
                supabase.auth.getUser().then(({ data }) => {
                  if (data.user && data.user.id !== rep.user_id) {
                    trackAnalyticsEvent(rep.user_id, "profile_view", data.user.id);
                  }
                });
              }}
              className="flex items-center bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors cursor-pointer group"
            >
              <div className={`relative w-20 h-24 flex-shrink-0 ${COLORS[idx % COLORS.length]} flex items-end justify-center overflow-hidden`}>
                {rep.photo_url ? (
                  <img
                    src={rep.photo_url}
                    alt={`${rep.first_name} ${rep.last_name}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="h-10 w-10 text-white/70 mb-2" />
                )}
              </div>
              <div className="flex-1 px-4 py-3 min-w-0">
                <p className="text-xs text-muted-foreground font-body uppercase tracking-wider truncate">
                  {rep.first_name}
                </p>
                <p className="text-sm font-display text-foreground uppercase tracking-wide truncate">
                  {rep.last_name}
                </p>
              </div>
              <div className="pr-3 flex-shrink-0">
                {rep.organization ? (
                  <span className="text-[10px] text-muted-foreground font-body bg-muted px-2 py-1 rounded">
                    {rep.organization}
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

export default ClubRepsSection;
