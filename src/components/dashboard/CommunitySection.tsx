import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, User, ArrowLeft, SlidersHorizontal, ChevronDown, X, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useLanguage } from "@/i18n/LanguageContext";
import { trackAnalyticsEvent } from "@/components/dashboard/ScoutStats";
import { calcPlayerCompletion, calcScoutCompletion, calcAgentCompletion, calcClubRepCompletion } from "@/lib/profileCompletion";
import { getDisplayNationality } from "@/components/ui/nationality-input";
import PersonalProfile from "@/components/dashboard/PersonalProfile";
import ScoutPersonalProfile from "@/components/dashboard/ScoutPersonalProfile";

type RoleKey = "player" | "scout" | "agent" | "club_rep";

interface CommunityCard {
  user_id: string;
  role: RoleKey;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  // Player-specific
  sport?: string | null;
  position?: string | null;
  current_team?: string | null;
  nationality?: string | null;
  date_of_birth?: string | null;
  // Scout-like
  organization?: string | null;
  title?: string | null;
  country?: string | null;
}

const ROLE_COLOR: Record<RoleKey, string> = {
  player: "bg-red-400",
  scout: "bg-blue-600",
  agent: "bg-orange-500",
  club_rep: "bg-emerald-600",
};

const ROLE_BADGE: Record<RoleKey, string> = {
  player: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  scout: "bg-purple-500/20 text-purple-300 border-purple-500/40",
  agent: "bg-orange-500/20 text-orange-300 border-orange-500/40",
  club_rep: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40",
};

interface Props {
  onNavigateToChat?: (userId: string) => void;
}

const CommunitySection = ({ onNavigateToChat }: Props) => {
  const { lang } = useLanguage();
  const [items, setItems] = useState<CommunityCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"all" | RoleKey>("all");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<{ id: string; role: RoleKey } | null>(null);

  // Filters
  const [filterSport, setFilterSport] = useState("all");
  const [filterCountry, setFilterCountry] = useState("all");
  const [filterPosition, setFilterPosition] = useState("all");
  const [filterDobFrom, setFilterDobFrom] = useState<Date | undefined>();
  const [filterDobTo, setFilterDobTo] = useState<Date | undefined>();
  const [dobFromOpen, setDobFromOpen] = useState(false);
  const [dobToOpen, setDobToOpen] = useState(false);

  const tr = lang === "ro" ? {
    title: "Comunitate",
    searchPh: "Caută după nume...",
    advFilters: "Filtre avansate",
    all: "Toți",
    players: "Jucători",
    scouts: "Scouteri",
    agents: "Agenți",
    clubs: "Cluburi",
    results: "rezultate găsite",
    none: "Niciun rezultat.",
    sport: "Sport",
    country: "Țară",
    positionOrSpec: "Poziție / Specializare",
    birthDate: "Data nașterii",
    dobFrom: "Născut după",
    dobTo: "Născut înainte",
    pickDate: "Alege data",
    allOpt: "Toate",
    clear: "Șterge filtrele",
    back: "Înapoi la comunitate",
    roleLabel: { player: "Jucător", scout: "Scouter", agent: "Agent", club_rep: "Club" } as Record<RoleKey, string>,
  } : {
    title: "Community",
    searchPh: "Search by name...",
    advFilters: "Advanced filters",
    all: "All",
    players: "Players",
    scouts: "Scouts",
    agents: "Agents",
    clubs: "Clubs",
    results: "results found",
    none: "No results.",
    sport: "Sport",
    country: "Country",
    positionOrSpec: "Position / Specialization",
    birthDate: "Date of birth",
    dobFrom: "Born after",
    dobTo: "Born before",
    pickDate: "Pick date",
    allOpt: "All",
    clear: "Clear filters",
    back: "Back to community",
    roleLabel: { player: "Player", scout: "Scout", agent: "Agent", club_rep: "Club" } as Record<RoleKey, string>,
  };

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);

      const [
        rolesRes,
        playersRes,
        scoutsRes,
        scoutExpRes,
        scoutPostsRes,
        scoutEduRes,
        scoutCertRes,
        agentManualRes,
        agentCollabRes,
      ] = await Promise.all([
        supabase.from("user_roles").select("user_id, role"),
        supabase
          .from("player_profiles")
          .select("user_id, first_name, last_name, photo_url, current_team, position, nationality, sport, date_of_birth, height_cm, weight_kg, preferred_foot, speed, jumping, endurance, acceleration, defense, career_description, video_highlights, instagram_url, tiktok_url, twitter_url"),
        supabase
          .from("scout_profiles")
          .select("user_id, first_name, last_name, photo_url, organization, title, country, bio, cover_photo_url, skills, languages"),
        supabase.from("scout_experiences").select("user_id, location"),
        supabase.from("scout_posts").select("user_id"),
        supabase.from("scout_education").select("user_id"),
        supabase.from("scout_certifications").select("user_id"),
        supabase.from("agent_manual_players").select("agent_user_id"),
        supabase.from("agent_collaboration_requests").select("agent_user_id").eq("status", "accepted"),
      ]);

      const roleMap = new Map<string, RoleKey>();
      (rolesRes.data || []).forEach((r: any) => roleMap.set(r.user_id, r.role as RoleKey));

      const expIds = new Set((scoutExpRes.data || []).map((e: any) => e.user_id));
      const locIds = new Set((scoutExpRes.data || []).filter((e: any) => e.location).map((e: any) => e.user_id));
      const postIds = new Set((scoutPostsRes.data || []).map((p: any) => p.user_id));
      const eduIds = new Set((scoutEduRes.data || []).map((e: any) => e.user_id));
      const certIds = new Set((scoutCertRes.data || []).map((c: any) => c.user_id));
      const manualIds = new Set((agentManualRes.data || []).map((p: any) => p.agent_user_id));
      const collabIds = new Set((agentCollabRes.data || []).map((c: any) => c.agent_user_id));

      const cards: CommunityCard[] = [];

      (playersRes.data || []).forEach((p: any) => {
        if (calcPlayerCompletion(p) < 55) return;
        cards.push({
          user_id: p.user_id,
          role: "player",
          first_name: p.first_name,
          last_name: p.last_name,
          photo_url: p.photo_url,
          sport: p.sport,
          position: p.position,
          current_team: p.current_team,
          nationality: p.nationality,
          date_of_birth: p.date_of_birth,
        });
      });

      (scoutsRes.data || []).forEach((s: any) => {
        const role = roleMap.get(s.user_id);
        if (!role || role === "player") return;
        let visible = false;
        if (role === "scout") {
          visible = calcScoutCompletion(s, expIds.has(s.user_id), postIds.has(s.user_id), eduIds.has(s.user_id), certIds.has(s.user_id)) >= 55;
        } else if (role === "agent") {
          visible = calcAgentCompletion(s, expIds.has(s.user_id), certIds.has(s.user_id), manualIds.has(s.user_id) || collabIds.has(s.user_id), locIds.has(s.user_id)) >= 55;
        } else if (role === "club_rep") {
          visible = calcClubRepCompletion(s, expIds.has(s.user_id), certIds.has(s.user_id), postIds.has(s.user_id)) >= 55;
        }
        if (!visible) return;
        cards.push({
          user_id: s.user_id,
          role,
          first_name: s.first_name,
          last_name: s.last_name,
          photo_url: s.photo_url,
          organization: s.organization,
          title: s.title,
          country: s.country,
        });
      });

      cards.sort((a, b) => `${a.first_name} ${a.last_name}`.localeCompare(`${b.first_name} ${b.last_name}`));
      setItems(cards);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const calcAge = (dob?: string | null): number | null => {
    if (!dob) return null;
    const d = new Date(dob);
    const now = new Date();
    let age = now.getFullYear() - d.getFullYear();
    const m = now.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
    return age;
  };

  const uniqueSports = useMemo(
    () => [...new Set(items.filter(i => i.role === "player").map(i => i.sport).filter(Boolean) as string[])].sort(),
    [items]
  );
  const uniqueCountries = useMemo(
    () => [...new Set(items.map(i => i.country || i.nationality).filter(Boolean) as string[])].sort(),
    [items]
  );
  const uniquePositions = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => {
      if (i.role === "player" && i.position) set.add(i.position);
      else if (i.role !== "player" && i.title) set.add(i.title);
    });
    return [...set].sort();
  }, [items]);

  const counts = useMemo(() => {
    const c = { all: items.length, player: 0, scout: 0, agent: 0, club_rep: 0 } as Record<string, number>;
    items.forEach(i => { c[i.role]++; });
    return c;
  }, [items]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filterSport !== "all") n++;
    if (filterCountry !== "all") n++;
    if (filterPosition !== "all") n++;
    if (filterAgeMin) n++;
    if (filterAgeMax) n++;
    return n;
  }, [filterSport, filterCountry, filterPosition, filterAgeMin, filterAgeMax]);

  const filtered = useMemo(() => {
    return items.filter(i => {
      if (activeTab !== "all" && i.role !== activeTab) return false;
      const name = `${i.first_name} ${i.last_name}`.toLowerCase();
      if (search && !name.includes(search.toLowerCase())) return false;
      if (filterSport !== "all") {
        if (i.role !== "player" || i.sport !== filterSport) return false;
      }
      if (filterCountry !== "all") {
        const c = i.country || i.nationality;
        if (c !== filterCountry) return false;
      }
      if (filterPosition !== "all") {
        const v = i.role === "player" ? i.position : i.title;
        if (v !== filterPosition) return false;
      }
      if (filterAgeMin || filterAgeMax) {
        const age = calcAge(i.date_of_birth);
        if (age == null) return false;
        if (filterAgeMin && age < Number(filterAgeMin)) return false;
        if (filterAgeMax && age > Number(filterAgeMax)) return false;
      }
      return true;
    });
  }, [items, activeTab, search, filterSport, filterCountry, filterPosition, filterAgeMin, filterAgeMax]);

  const clearFilters = () => {
    setFilterSport("all");
    setFilterCountry("all");
    setFilterPosition("all");
    setFilterAgeMin("");
    setFilterAgeMax("");
  };

  if (selected) {
    return (
      <div className="space-y-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSelected(null)}
          className="mb-4 gap-2 text-muted-foreground hover:text-foreground font-body"
        >
          <ArrowLeft className="h-4 w-4" />
          {tr.back}
        </Button>
        {selected.role === "player" ? (
          <PersonalProfile userId={selected.id} readOnly onNavigateToChat={onNavigateToChat} />
        ) : (
          <ScoutPersonalProfile userId={selected.id} readOnly onNavigateToChat={onNavigateToChat} />
        )}
      </div>
    );
  }

  const tabs: { key: "all" | RoleKey; label: string; count: number }[] = [
    { key: "all", label: tr.all, count: counts.all },
    { key: "player", label: tr.players, count: counts.player },
    { key: "scout", label: tr.scouts, count: counts.scout },
    { key: "agent", label: tr.agents, count: counts.agent },
    { key: "club_rep", label: tr.clubs, count: counts.club_rep },
  ];

  return (
    <div className="space-y-5">
      <h1 className="font-display text-3xl text-foreground">{tr.title}</h1>

      {/* Search + Advanced filters toggle */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={tr.searchPh}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 bg-card border-border text-foreground rounded-xl h-11 text-sm font-body"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className={`relative rounded-xl h-11 px-4 font-body text-sm gap-2 transition-all ${
            showFilters || activeFilterCount > 0
              ? "border-primary bg-primary/5 text-primary hover:bg-primary/10"
              : "border-border text-muted-foreground hover:text-foreground"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {tr.advFilters}
          {activeFilterCount > 0 && (
            <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`} />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(t => {
          const isActive = activeTab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-body transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:text-foreground border border-border"
              }`}
            >
              {t.label}
              <span className={`flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold ${
                isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {t.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground font-body uppercase tracking-wider">{tr.sport}</label>
              <Select value={filterSport} onValueChange={setFilterSport}>
                <SelectTrigger className="rounded-lg h-10 bg-background border-border font-body text-sm text-foreground">
                  <SelectValue placeholder={tr.allOpt} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr.allOpt}</SelectItem>
                  {uniqueSports.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground font-body uppercase tracking-wider">{tr.country}</label>
              <Select value={filterCountry} onValueChange={setFilterCountry}>
                <SelectTrigger className="rounded-lg h-10 bg-background border-border font-body text-sm text-foreground">
                  <SelectValue placeholder={tr.allOpt} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr.allOpt}</SelectItem>
                  {uniqueCountries.map(c => <SelectItem key={c} value={c}>{getDisplayNationality(c, lang)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground font-body uppercase tracking-wider">{tr.positionOrSpec}</label>
              <Select value={filterPosition} onValueChange={setFilterPosition}>
                <SelectTrigger className="rounded-lg h-10 bg-background border-border font-body text-sm text-foreground">
                  <SelectValue placeholder={tr.allOpt} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr.allOpt}</SelectItem>
                  {uniquePositions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground font-body uppercase tracking-wider">{tr.ageMin}</label>
              <Input
                type="number"
                value={filterAgeMin}
                onChange={(e) => setFilterAgeMin(e.target.value)}
                className="rounded-lg h-10 bg-background border-border font-body text-sm"
                placeholder="14"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground font-body uppercase tracking-wider">{tr.ageMax}</label>
              <Input
                type="number"
                value={filterAgeMax}
                onChange={(e) => setFilterAgeMax(e.target.value)}
                className="rounded-lg h-10 bg-background border-border font-body text-sm"
                placeholder="40"
              />
            </div>
          </div>
          {activeFilterCount > 0 && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-muted-foreground gap-1.5">
                <X className="h-3.5 w-3.5" />
                {tr.clear}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Results count */}
      <p className="text-xs text-muted-foreground font-body">
        {filtered.length} {tr.results}
      </p>

      {/* Cards grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-56 rounded-2xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 font-body">{tr.none}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(item => {
            const initials = `${item.first_name?.[0] ?? ""}${item.last_name?.[0] ?? ""}`.toUpperCase();
            const subtitle = item.role === "player"
              ? [item.position, item.current_team].filter(Boolean).join(" · ")
              : [item.title, item.organization].filter(Boolean).join(" · ");
            const tag = item.role === "player" ? item.current_team : item.organization;
            return (
              <div
                key={`${item.role}-${item.user_id}`}
                onClick={() => {
                  setSelected({ id: item.user_id, role: item.role });
                  supabase.auth.getUser().then(({ data }) => {
                    if (data.user && data.user.id !== item.user_id) {
                      trackAnalyticsEvent(item.user_id, "profile_view", data.user.id);
                    }
                  });
                }}
                className="bg-card border border-border rounded-2xl overflow-hidden cursor-pointer hover:border-primary/50 transition-colors flex flex-col"
              >
                <div className={`relative w-full aspect-[4/3] ${ROLE_COLOR[item.role]} flex items-center justify-center overflow-hidden`}>
                  {item.photo_url ? (
                    <img src={item.photo_url} alt={`${item.first_name} ${item.last_name}`} className="w-full h-full object-contain" />
                  ) : (
                    <span className="font-display text-4xl text-white">{initials || <User className="h-10 w-10" />}</span>
                  )}
                </div>
                <div className="p-4 space-y-2 flex-1 flex flex-col">
                  <p className="font-display text-base text-foreground truncate">
                    {item.first_name} {item.last_name}
                  </p>
                  {subtitle && (
                    <p className="text-xs text-muted-foreground font-body truncate">{subtitle}</p>
                  )}
                  <div className="flex items-center gap-2 flex-wrap mt-auto pt-2">
                    <span className={`text-[10px] font-body px-2 py-0.5 rounded border ${ROLE_BADGE[item.role]}`}>
                      {tr.roleLabel[item.role]}
                    </span>
                    {tag && (
                      <span className="text-[10px] text-muted-foreground font-body bg-muted px-2 py-0.5 rounded truncate max-w-[120px]">
                        {tag}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CommunitySection;
