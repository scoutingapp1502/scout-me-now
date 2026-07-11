import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, User, ArrowLeft } from "lucide-react";
import { trackAnalyticsEvent } from "@/components/dashboard/ScoutStats";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import ScoutPersonalProfile from "@/components/dashboard/ScoutPersonalProfile";
import { calcAgentCompletion } from "@/lib/profileCompletion";

interface AgentCard {
  user_id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  organization: string | null;
  title: string | null;
  country: string | null;
  bio: string | null;
  cover_photo_url: string | null;
  languages: string[] | null;
}

const COLORS = [
  "bg-emerald-600",
  "bg-blue-600",
  "bg-orange-500",
  "bg-gray-400",
  "bg-blue-800",
  "bg-orange-400",
];

const AgentsSection = ({ onNavigateToChat }: { onNavigateToChat?: (userId: string) => void }) => {
  const [agents, setAgents] = useState<AgentCard[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const { lang } = useLanguage();

  useEffect(() => {
    const fetchAgents = async () => {
      setLoading(true);

      // Fetch agent role user_ids
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "agent");

      const agentUserIds = new Set((roleData || []).map((r) => r.user_id));

      if (agentUserIds.size === 0) {
        setAgents([]);
        setLoading(false);
        return;
      }

      const [profilesRes, expRes, certRes, manualPlayersRes, collabRes] = await Promise.all([
        supabase
          .from("scout_profiles")
          .select("user_id, first_name, last_name, photo_url, organization, title, country, bio, cover_photo_url, skills, languages")
          .in("user_id", Array.from(agentUserIds))
          .order("first_name", { ascending: true }),
        supabase.from("scout_experiences").select("user_id, location"),
        supabase.from("scout_certifications").select("user_id"),
        supabase.from("agent_manual_players").select("agent_user_id"),
        supabase.from("agent_collaboration_requests").select("agent_user_id").eq("status", "accepted"),
      ]);

      if (!profilesRes.error && profilesRes.data) {
        const expUserIds = new Set((expRes.data || []).map((e) => e.user_id));
        const locationUserIds = new Set((expRes.data || []).filter((e) => e.location).map((e) => e.user_id));
        const certUserIds = new Set((certRes.data || []).map((c) => c.user_id));
        const manualPlayersUserIds = new Set((manualPlayersRes.data || []).map((p) => p.agent_user_id));
        const collabUserIds = new Set((collabRes.data || []).map((c) => c.agent_user_id));

        const visible = profilesRes.data.filter((s) =>
          calcAgentCompletion(
            s,
            expUserIds.has(s.user_id),
            certUserIds.has(s.user_id),
            manualPlayersUserIds.has(s.user_id) || collabUserIds.has(s.user_id),
            locationUserIds.has(s.user_id),
          ) >= 55
        );
        setAgents(visible);
      }
      setLoading(false);
    };
    fetchAgents();
  }, []);

  const filtered = agents.filter((a) => {
    const name = `${a.first_name} ${a.last_name}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  // Track search appearances
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

  if (selectedAgentId) {
    return (
      <div className="space-y-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelectedAgentId(null)}
          className="mb-4 gap-2 text-muted-foreground hover:text-foreground font-body"
        >
          <ArrowLeft className="h-4 w-4" />
          {lang === "ro" ? "Înapoi la agenți" : "Back to agents"}
        </Button>
        <ScoutPersonalProfile userId={selectedAgentId} readOnly onNavigateToChat={onNavigateToChat} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-center">
        <div className="relative w-full max-w-md">
          <Input
            placeholder={lang === "ro" ? "Caută un agent" : "Find an agent"}
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
          {lang === "ro" ? "Niciun agent găsit." : "No agents found."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((agent, idx) => (
            <div
              key={agent.user_id}
              onClick={() => {
                setSelectedAgentId(agent.user_id);
                supabase.auth.getUser().then(({ data }) => {
                  if (data.user && data.user.id !== agent.user_id) {
                    trackAnalyticsEvent(agent.user_id, "profile_view", data.user.id);
                  }
                });
              }}
              className="flex items-center bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors cursor-pointer group"
            >
              <div className={`relative w-20 h-24 flex-shrink-0 ${COLORS[idx % COLORS.length]} flex items-end justify-center overflow-hidden`}>
                {agent.photo_url ? (
                  <img
                    src={agent.photo_url}
                    alt={`${agent.first_name} ${agent.last_name}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="h-10 w-10 text-white/70 mb-2" />
                )}
              </div>
              <div className="flex-1 px-4 py-3 min-w-0">
                <p className="text-xs text-muted-foreground font-body uppercase tracking-wider truncate">
                  {agent.first_name}
                </p>
                <p className="text-sm font-display text-foreground uppercase tracking-wide truncate">
                  {agent.last_name}
                </p>
              </div>
              <div className="pr-3 flex-shrink-0">
                {agent.organization ? (
                  <span className="text-[10px] text-muted-foreground font-body bg-muted px-2 py-1 rounded">
                    {agent.organization}
                  </span>
                ) : agent.title ? (
                  <span className="text-[10px] text-muted-foreground font-body bg-muted px-2 py-1 rounded">
                    {agent.title}
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

export default AgentsSection;
