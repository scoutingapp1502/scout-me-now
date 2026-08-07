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

type RoleKey = "player" | "cauta_jucator";

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
  height_cm?: number | null;
  preferred_foot?: string | null;
  // Scout/Agent/Club-specific
  organization?: string | null;
  title?: string | null;
  country?: string | null;
  sports?: string[] | null;
  languages?: string[] | null;
}

const ROLE_COLOR: Record<RoleKey, string> = {
  player: "bg-red-400",
  cauta_jucator: "bg-teal-600",
};

const ROLE_BADGE: Record<RoleKey, string> = {
  player: "bg-blue-500/20 text-blue-300 border-blue-500/40",
  cauta_jucator: "bg-teal-500/20 text-teal-300 border-teal-500/40",
};

interface Props {
  onNavigateToChat?: (userId: string) => void;
}

const CommunitySection = ({ onNavigateToChat }: Props) => {
  const { lang } = useLanguage();
  const [items, setItems] = useState<CommunityCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<RoleKey>("player");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<{ id: string; role: RoleKey } | null>(null);

  // Filters - generic (all tab)
  const [filterSport, setFilterSport] = useState("all");

  const [filterPosition, setFilterPosition] = useState("all");
  // Player filters
  const [filterPlayerNationality, setFilterPlayerNationality] = useState("all");
  const [filterDobFrom, setFilterDobFrom] = useState<Date | undefined>();
  const [filterDobTo, setFilterDobTo] = useState<Date | undefined>();
  const [filterHeight, setFilterHeight] = useState("");
  const [filterPreferredFoot, setFilterPreferredFoot] = useState("all");
  // Scout / Agent / Club filters
  const [filterSportSpec, setFilterSportSpec] = useState("all");
  const [filterOrganization, setFilterOrganization] = useState("all");
  const [filterActivityCountry, setFilterActivityCountry] = useState("all");
  const [filterLanguage, setFilterLanguage] = useState("all");

  const [dobFromOpen, setDobFromOpen] = useState(false);
  const [dobToOpen, setDobToOpen] = useState(false);

  const tr = lang === "ro" ? {
    title: "Comunitate",
    searchPh: "Caută după nume...",
    advFilters: "Filtre avansate",
    all: "Toți",
    players: "Jucători",
    cautaJucatori: "Descoperitori",
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
    nationality: "Naționalitate",
    minHeight: "Înălțime minimă (cm)",
    preferredFootLabel: "Picior / Mână preferată",
    sportSpec: "Specializare sport",
    organization: "Organizație / Club",
    activityCountry: "Țară de activitate",
    language: "Limbă vorbită",
    roleLabel: { player: "Jucător", cauta_jucator: "Descoperitor" } as Record<RoleKey, string>,
  } : {
    title: "Community",
    searchPh: "Search by name...",
    advFilters: "Advanced filters",
    all: "All",
    players: "Players",
    cautaJucatori: "Discoverers",
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
    nationality: "Nationality",
    minHeight: "Min. height (cm)",
    preferredFootLabel: "Preferred foot / hand",
    sportSpec: "Sport specialization",
    organization: "Organization / Club",
    activityCountry: "Activity country",
    language: "Language spoken",
    roleLabel: { player: "Player", cauta_jucator: "Discoverer" } as Record<RoleKey, string>,
  };

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);

      const [
        rolesRes,
        playersRes,
        playerCareerRes,
        scoutsRes,
        scoutExpRes,
        scoutPostsRes,
        scoutEduRes,
        scoutCertRes,
      ] = await Promise.all([
        supabase.from("user_roles").select("user_id, role"),
        supabase
          .from("player_profiles")
          .select("user_id, first_name, last_name, photo_url, current_team, position, nationality, sport, date_of_birth, height_cm, weight_kg, preferred_foot, speed, jumping, endurance, acceleration, defense, career_description, video_highlights, instagram_url, tiktok_url, twitter_url")
          .limit(1000),
        supabase.from("player_career_entries").select("user_id"),
        supabase
          .from("scout_profiles")
          .select("user_id, first_name, last_name, photo_url, organization, title, country, bio, cover_photo_url, skills, languages, sports")
          .limit(1000),
        supabase.from("scout_experiences").select("user_id, location"),
        supabase.from("scout_posts").select("user_id"),
        supabase.from("scout_education").select("user_id"),
        supabase.from("scout_certifications").select("user_id"),
      ]);

      const roleMap = new Map<string, RoleKey>();
      (rolesRes.data || []).forEach((r: any) => roleMap.set(r.user_id, r.role as RoleKey));

      const cautaJucatorIds = (scoutsRes.data || [])
        .map((s: any) => s.user_id)
        .filter((id: string) => roleMap.get(id) === "cauta_jucator");
      let approvedIds = new Set<string>();
      if (cautaJucatorIds.length > 0) {
        const { data: approvedData } = await (supabase as any).rpc("get_approved_verification_ids", { _user_ids: cautaJucatorIds });
        approvedIds = new Set((approvedData || []).map((r: any) => r.user_id));
      }

      const careerIds = new Set((playerCareerRes.data || []).map((e: any) => e.user_id));
      const expIds = new Set((scoutExpRes.data || []).map((e: any) => e.user_id));
      const postIds = new Set((scoutPostsRes.data || []).map((p: any) => p.user_id));
      const eduIds = new Set((scoutEduRes.data || []).map((e: any) => e.user_id));
      const certIds = new Set((scoutCertRes.data || []).map((c: any) => c.user_id));

      const cards: CommunityCard[] = [];

      (playersRes.data || []).forEach((p: any) => {
        if (calcPlayerCompletion(p, careerIds.has(p.user_id)) < 55) return;
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
          height_cm: p.height_cm,
          preferred_foot: p.preferred_foot,
        });
      });

      (scoutsRes.data || []).forEach((s: any) => {
        const role = roleMap.get(s.user_id);
        if (role !== "cauta_jucator") return;
        const visible = calcScoutCompletion(s, expIds.has(s.user_id), postIds.has(s.user_id), eduIds.has(s.user_id), certIds.has(s.user_id)) >= 55
          && approvedIds.has(s.user_id);
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
          sports: s.sports,
          languages: s.languages,
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
      if (i.role === "player" && i.position) {
        if (filterSport === "all" || i.sport === filterSport) set.add(i.position);
      }
    });
    return [...set].sort();
  }, [items, filterSport]);
  const uniquePlayerNationalities = useMemo(
    () => [...new Set(items.filter(i => i.role === "player" && i.nationality).map(i => i.nationality) as string[])].sort(),
    [items]
  );
  const uniqueOrganizations = useMemo(
    () => [...new Set(items.filter(i => i.role !== "player" && i.organization).map(i => i.organization) as string[])].sort(),
    [items]
  );
  const uniqueActivityCountries = useMemo(
    () => [...new Set(items.filter(i => i.role !== "player" && i.country).map(i => i.country) as string[])].sort(),
    [items]
  );
  const uniqueSportSpecs = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.role !== "player") i.sports?.forEach(s => set.add(s)); });
    return [...set].sort();
  }, [items]);
  const uniqueLanguages = useMemo(() => {
    const set = new Set<string>();
    items.forEach(i => { if (i.role === "cauta_jucator") i.languages?.forEach(l => set.add(l)); });
    return [...set].sort();
  }, [items]);

  const counts = useMemo(() => {
    const c = { all: items.length, player: 0, cauta_jucator: 0 } as Record<string, number>;
    items.forEach(i => { c[i.role]++; });
    return c;
  }, [items]);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (filterSport !== "all") n++;
    if (filterPosition !== "all") n++;
    if (filterPlayerNationality !== "all") n++;
    if (filterDobFrom) n++;
    if (filterDobTo) n++;
    if (filterHeight) n++;
    if (filterPreferredFoot !== "all") n++;
    if (filterSportSpec !== "all") n++;
    if (filterOrganization !== "all") n++;
    if (filterActivityCountry !== "all") n++;
    if (filterLanguage !== "all") n++;
    return n;
  }, [filterSport, filterPosition, filterPlayerNationality, filterDobFrom, filterDobTo, filterHeight, filterPreferredFoot, filterSportSpec, filterOrganization, filterActivityCountry, filterLanguage]);

  const filtered = useMemo(() => {
    return items.filter(i => {
      if (i.role !== activeTab) return false;
      const name = `${i.first_name} ${i.last_name}`.toLowerCase();
      if (search && !name.includes(search.toLowerCase())) return false;

      if (i.role === "player") {
        if (filterSport !== "all" && i.sport !== filterSport) return false;
        if (filterPosition !== "all" && i.position !== filterPosition) return false;
        if (filterPlayerNationality !== "all" && i.nationality !== filterPlayerNationality) return false;
        if (filterDobFrom || filterDobTo) {
          if (!i.date_of_birth) return false;
          const dob = new Date(i.date_of_birth);
          if (filterDobFrom && dob < filterDobFrom) return false;
          if (filterDobTo && dob > filterDobTo) return false;
        }
        if (filterHeight) {
          const minH = parseInt(filterHeight);
          if (!i.height_cm || i.height_cm < minH) return false;
        }
        if (filterPreferredFoot !== "all" && i.preferred_foot !== filterPreferredFoot) return false;
      } else if (i.role === "cauta_jucator") {
        if (filterSportSpec !== "all" && !i.sports?.includes(filterSportSpec)) return false;
        if (filterOrganization !== "all" && i.organization !== filterOrganization) return false;
        if (filterActivityCountry !== "all" && i.country !== filterActivityCountry) return false;
        if (filterLanguage !== "all" && !i.languages?.includes(filterLanguage)) return false;
      }

      return true;
    });
  }, [items, activeTab, search, filterSport, filterPosition, filterPlayerNationality, filterDobFrom, filterDobTo, filterHeight, filterPreferredFoot, filterSportSpec, filterOrganization, filterActivityCountry, filterLanguage]);

  const clearFilters = () => {
    setFilterSport("all");

    setFilterPosition("all");
    setFilterPlayerNationality("all");
    setFilterDobFrom(undefined);
    setFilterDobTo(undefined);
    setFilterHeight("");
    setFilterPreferredFoot("all");
    setFilterSportSpec("all");
    setFilterOrganization("all");
    setFilterActivityCountry("all");
    setFilterLanguage("all");
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

  const tabs: { key: RoleKey; label: string; count: number }[] = [
    { key: "player", label: tr.players, count: counts.player },
    { key: "cauta_jucator", label: tr.cautaJucatori, count: counts.cauta_jucator },
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
              onClick={() => { setActiveTab(t.key); clearFilters(); }}
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

            {/* ── PLAYER tab ───────────────────────────────────────── */}
            {activeTab === "player" && (<>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground font-body uppercase tracking-wider">{tr.sport}</label>
                <Select value={filterSport} onValueChange={(v) => { setFilterSport(v); setFilterPosition("all"); }}>
                  <SelectTrigger className="rounded-lg h-10 bg-background border-border font-body text-sm text-foreground"><SelectValue placeholder={tr.allOpt} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr.allOpt}</SelectItem>
                    {uniqueSports.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground font-body uppercase tracking-wider">{tr.positionOrSpec}</label>
                <Select value={filterPosition} onValueChange={setFilterPosition}>
                  <SelectTrigger className="rounded-lg h-10 bg-background border-border font-body text-sm text-foreground"><SelectValue placeholder={tr.allOpt} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr.allOpt}</SelectItem>
                    {uniquePositions.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground font-body uppercase tracking-wider">{tr.nationality}</label>
                <Select value={filterPlayerNationality} onValueChange={setFilterPlayerNationality}>
                  <SelectTrigger className="rounded-lg h-10 bg-background border-border font-body text-sm text-foreground"><SelectValue placeholder={tr.allOpt} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr.allOpt}</SelectItem>
                    {uniquePlayerNationalities.map(n => <SelectItem key={n} value={n}>{getDisplayNationality(n, lang)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground font-body uppercase tracking-wider">{tr.minHeight}</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ex: 170"
                  value={filterHeight}
                  onKeyDown={(e) => { if (!/[0-9]/.test(e.key) && !["Backspace","Delete","ArrowLeft","ArrowRight","Tab"].includes(e.key)) e.preventDefault(); }}
                  onChange={(e) => setFilterHeight(e.target.value.replace(/\D/g, ""))}
                  className="rounded-lg h-10 bg-background border-border font-body text-sm text-foreground"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground font-body uppercase tracking-wider">{tr.preferredFootLabel}</label>
                <Select value={filterPreferredFoot} onValueChange={setFilterPreferredFoot}>
                  <SelectTrigger className="rounded-lg h-10 bg-background border-border font-body text-sm text-foreground"><SelectValue placeholder={tr.allOpt} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr.allOpt}</SelectItem>
                    {filterSport === "basketball"
                      ? (<><SelectItem value="Dreapta">Dreapta</SelectItem><SelectItem value="Stânga">Stânga</SelectItem><SelectItem value="Ambele">Ambele</SelectItem></>)
                      : (<><SelectItem value="Drept">Drept</SelectItem><SelectItem value="Stâng">Stâng</SelectItem><SelectItem value="Ambele">Ambele</SelectItem></>)
                    }
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-muted-foreground font-body uppercase tracking-wider">{tr.birthDate}</label>
                <div className="flex gap-2">
                  <Popover open={dobFromOpen} onOpenChange={setDobFromOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal rounded-lg h-10 bg-background border-border font-body text-sm", !filterDobFrom && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filterDobFrom ? format(filterDobFrom, "dd/MM/yyyy") : tr.dobFrom}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={filterDobFrom} onSelect={(d) => { setFilterDobFrom(d); setDobFromOpen(false); }} captionLayout="dropdown-buttons" fromYear={1950} toYear={new Date().getFullYear()} initialFocus className="pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                  <Popover open={dobToOpen} onOpenChange={setDobToOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal rounded-lg h-10 bg-background border-border font-body text-sm", !filterDobTo && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {filterDobTo ? format(filterDobTo, "dd/MM/yyyy") : tr.dobTo}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={filterDobTo} onSelect={(d) => { setFilterDobTo(d); setDobToOpen(false); }} captionLayout="dropdown-buttons" fromYear={1950} toYear={new Date().getFullYear()} initialFocus className="pointer-events-auto" />
                    </PopoverContent>
                  </Popover>
                </div>
              </div>
            </>)}

            {/* ── CAUTA_JUCATOR tab ───────────────────────────────────── */}
            {activeTab === "cauta_jucator" && (<>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground font-body uppercase tracking-wider">{tr.sportSpec}</label>
                <Select value={filterSportSpec} onValueChange={setFilterSportSpec}>
                  <SelectTrigger className="rounded-lg h-10 bg-background border-border font-body text-sm text-foreground"><SelectValue placeholder={tr.allOpt} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr.allOpt}</SelectItem>
                    {uniqueSportSpecs.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground font-body uppercase tracking-wider">{tr.organization}</label>
                <Select value={filterOrganization} onValueChange={setFilterOrganization}>
                  <SelectTrigger className="rounded-lg h-10 bg-background border-border font-body text-sm text-foreground"><SelectValue placeholder={tr.allOpt} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr.allOpt}</SelectItem>
                    {uniqueOrganizations.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground font-body uppercase tracking-wider">{tr.activityCountry}</label>
                <Select value={filterActivityCountry} onValueChange={setFilterActivityCountry}>
                  <SelectTrigger className="rounded-lg h-10 bg-background border-border font-body text-sm text-foreground"><SelectValue placeholder={tr.allOpt} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr.allOpt}</SelectItem>
                    {uniqueActivityCountries.map(c => <SelectItem key={c} value={c}>{getDisplayNationality(c, lang)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground font-body uppercase tracking-wider">{tr.language}</label>
                <Select value={filterLanguage} onValueChange={setFilterLanguage}>
                  <SelectTrigger className="rounded-lg h-10 bg-background border-border font-body text-sm text-foreground"><SelectValue placeholder={tr.allOpt} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr.allOpt}</SelectItem>
                    {uniqueLanguages.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>)}

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
                  }).catch((err) => console.error("Failed to track profile view:", err));
                }}
                className="bg-card border border-border rounded-2xl overflow-hidden cursor-pointer hover:border-primary/50 transition-colors flex flex-col"
              >
                <div className={`relative w-full h-48 ${ROLE_COLOR[item.role]} flex items-center justify-center overflow-hidden`}>
                  {item.photo_url ? (
                    <img src={item.photo_url} alt={`${item.first_name} ${item.last_name}`} className="w-full h-full object-cover" />
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
