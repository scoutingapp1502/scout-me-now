import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, User, ArrowLeft, SlidersHorizontal, ChevronDown, X, CalendarIcon, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { useLanguage } from "@/i18n/LanguageContext";
import { trackAnalyticsEvent } from "@/components/dashboard/ScoutStats";
import { getDisplayNationality } from "@/components/ui/nationality-input";
import { translatePosition, translateFootHandValue } from "@/lib/positionTranslations";
import PersonalProfile from "@/components/dashboard/PersonalProfile";
import ScoutPersonalProfile from "@/components/dashboard/ScoutPersonalProfile";
import { useClubLogos } from "@/hooks/useClubLogos";

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

const PAGE_SIZE = 24;

const ROLE_COLOR: Record<RoleKey, string> = {
  player: "bg-red-400",
  cauta_jucator: "bg-teal-600",
};

const ROLE_BADGE: Record<RoleKey, string> = {
  player: "bg-gradient-to-r from-indigo-600 to-purple-600 text-white border-transparent",
  cauta_jucator: "bg-teal-50 text-teal-700 border-teal-200",
};

interface Props {
  onNavigateToChat?: (userId: string) => void;
}

const CommunitySection = ({ onNavigateToChat }: Props) => {
  const { lang, t } = useLanguage();
  const { getLogoForTeam } = useClubLogos();
  const [items, setItems] = useState<CommunityCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [counts, setCounts] = useState({ player: 0, cauta_jucator: 0 });
  const [filterOptions, setFilterOptions] = useState<{
    sports: string[]; positions: string[]; nationalities: string[];
    organizations: string[]; activityCountries: string[]; sportSpecs: string[]; languages: string[];
  }>({ sports: [], positions: [], nationalities: [], organizations: [], activityCountries: [], sportSpecs: [], languages: [] });
  const [activeTab, setActiveTab] = useState<RoleKey>("player");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<{ id: string; role: RoleKey } | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);

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

  // Debounce search input so it doesn't refetch on every keystroke.
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

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

  const fetchPage = useCallback(async (offset: number) => {
    const { data, error } = await (supabase as any).rpc("get_community_cards", {
      p_role: activeTab,
      p_search: debouncedSearch || null,
      p_sport: activeTab === "player" ? filterSport : null,
      p_position: activeTab === "player" ? filterPosition : null,
      p_nationality: activeTab === "player" ? filterPlayerNationality : null,
      p_dob_from: activeTab === "player" && filterDobFrom ? filterDobFrom.toISOString().slice(0, 10) : null,
      p_dob_to: activeTab === "player" && filterDobTo ? filterDobTo.toISOString().slice(0, 10) : null,
      p_min_height: activeTab === "player" && filterHeight ? parseInt(filterHeight, 10) : null,
      p_preferred_foot: activeTab === "player" ? filterPreferredFoot : null,
      p_sport_spec: activeTab === "cauta_jucator" ? filterSportSpec : null,
      p_organization: activeTab === "cauta_jucator" ? filterOrganization : null,
      p_activity_country: activeTab === "cauta_jucator" ? filterActivityCountry : null,
      p_language: activeTab === "cauta_jucator" ? filterLanguage : null,
      p_limit: PAGE_SIZE,
      p_offset: offset,
    });
    if (error) { console.error("Failed to load community page:", error); return []; }
    return (data || []) as CommunityCard[];
  }, [activeTab, debouncedSearch, filterSport, filterPosition, filterPlayerNationality, filterDobFrom, filterDobTo, filterHeight, filterPreferredFoot, filterSportSpec, filterOrganization, filterActivityCountry, filterLanguage]);

  // Reset + fetch first page whenever the tab, search or any filter changes.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setHasMore(true);
    fetchPage(0).then((page) => {
      if (cancelled) return;
      setItems(page);
      setHasMore(page.length === PAGE_SIZE);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [fetchPage]);

  // Tab counts — fetched once on mount, refreshed when switching tabs (cheap
  // COUNT-only query, not tied to the page-fetch effect above).
  useEffect(() => {
    (supabase as any).rpc("get_community_counts").then(({ data, error }: any) => {
      if (error) { console.error("Failed to load community counts:", error); return; }
      const row = data?.[0];
      if (row) setCounts({ player: Number(row.player_count) || 0, cauta_jucator: Number(row.cauta_jucator_count) || 0 });
    });
  }, [activeTab]);

  // Filter dropdown options — depend only on the active tab, not on the
  // filters/search currently applied (so changing one filter doesn't shrink
  // the others' available options out from under the user).
  useEffect(() => {
    (supabase as any).rpc("get_community_filter_options", { p_role: activeTab }).then(({ data, error }: any) => {
      if (error) { console.error("Failed to load filter options:", error); return; }
      const row = data?.[0] || {};
      setFilterOptions({
        sports: row.sports || [],
        positions: row.positions || [],
        nationalities: row.nationalities || [],
        organizations: row.organizations || [],
        activityCountries: row.activity_countries || [],
        sportSpecs: row.sport_specs || [],
        languages: row.languages || [],
      });
    });
  }, [activeTab]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    const page = await fetchPage(items.length);
    setItems((prev) => [...prev, ...page]);
    setHasMore(page.length === PAGE_SIZE);
    setLoadingMore(false);
  }, [fetchPage, items.length, loadingMore, hasMore, loading]);

  // Infinite scroll: the page/<main> element scrolls (not a local
  // container), so observe a sentinel div at the bottom of the grid instead
  // of attaching an onScroll handler.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMore();
    }, { rootMargin: "400px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMore]);

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
          className="mb-4 gap-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 font-body"
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
    <div className="space-y-5 relative isolate">
      <h1 className="font-display text-3xl text-gray-900">{tr.title}</h1>

      {/* Decorative geometric shapes */}
      <div className="relative h-0 overflow-visible">
        <div
          className="absolute -z-10 pointer-events-none"
          style={{
            top: "-20px",
            right: "40px",
            width: "150px",
            height: "150px",
            background: "linear-gradient(135deg, #f97316, #fb923c)",
            clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
            opacity: 0.9,
          }}
        />
        <div
          className="absolute -z-10 pointer-events-none"
          style={{
            top: "40px",
            left: "-30px",
            width: "110px",
            height: "110px",
            background: "linear-gradient(135deg, #7c3aed, #a855f7)",
            clipPath: "polygon(0 0, 100% 0, 0 100%)",
            opacity: 0.9,
          }}
        />
      </div>

      {/* Search + Advanced filters toggle */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          <Input
            placeholder={tr.searchPh}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 pr-4 bg-gray-100 border-0 text-gray-900 rounded-full h-11 text-sm font-body focus-visible:ring-2 focus-visible:ring-gray-900"
          />
        </div>
        <Button
          variant="outline"
          onClick={() => setShowFilters(!showFilters)}
          className={`relative rounded-xl h-11 px-4 font-body text-sm gap-2 transition-all ${
            showFilters || activeFilterCount > 0
              ? "border-orange-500 bg-orange-50 text-orange-600 hover:bg-orange-100"
              : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900"
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          {tr.advFilters}
          {activeFilterCount > 0 && (
            <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-white text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`} />
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {tabs.map(tItem => {
          const isActive = activeTab === tItem.key;
          return (
            <button
              key={tItem.key}
              onClick={() => { setActiveTab(tItem.key); clearFilters(); }}
              className={`flex items-center gap-2 px-5 py-2 rounded-full text-sm font-body transition-colors ${
                isActive
                  ? "bg-orange-500 text-white"
                  : "bg-white text-gray-500 hover:text-gray-900 border border-gray-200"
              }`}
            >
              {tItem.label}
              <span className={`flex items-center justify-center min-w-[22px] h-[22px] px-1.5 rounded-full text-[11px] font-bold ${
                isActive ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
              }`}>
                {tItem.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">

            {/* ── PLAYER tab ───────────────────────────────────────── */}
            {activeTab === "player" && (<>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 font-body uppercase tracking-wider">{tr.sport}</label>
                <Select value={filterSport} onValueChange={(v) => { setFilterSport(v); setFilterPosition("all"); }}>
                  <SelectTrigger className="rounded-lg h-10 bg-white border-gray-200 font-body text-sm text-gray-900"><SelectValue placeholder={tr.allOpt} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr.allOpt}</SelectItem>
                    {filterOptions.sports.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 font-body uppercase tracking-wider">{tr.positionOrSpec}</label>
                <Select value={filterPosition} onValueChange={setFilterPosition}>
                  <SelectTrigger className="rounded-lg h-10 bg-white border-gray-200 font-body text-sm text-gray-900"><SelectValue placeholder={tr.allOpt} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr.allOpt}</SelectItem>
                    {filterOptions.positions.map(p => <SelectItem key={p} value={p}>{translatePosition(p, lang)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 font-body uppercase tracking-wider">{tr.nationality}</label>
                <Select value={filterPlayerNationality} onValueChange={setFilterPlayerNationality}>
                  <SelectTrigger className="rounded-lg h-10 bg-white border-gray-200 font-body text-sm text-gray-900"><SelectValue placeholder={tr.allOpt} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr.allOpt}</SelectItem>
                    {filterOptions.nationalities.map(n => <SelectItem key={n} value={n}>{getDisplayNationality(n, lang)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 font-body uppercase tracking-wider">{tr.minHeight}</label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Ex: 170"
                  value={filterHeight}
                  onKeyDown={(e) => { if (!/[0-9]/.test(e.key) && !["Backspace","Delete","ArrowLeft","ArrowRight","Tab"].includes(e.key)) e.preventDefault(); }}
                  onChange={(e) => setFilterHeight(e.target.value.replace(/\D/g, ""))}
                  className="rounded-lg h-10 bg-white border-gray-200 font-body text-sm text-gray-900"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 font-body uppercase tracking-wider">{tr.preferredFootLabel}</label>
                <Select value={filterPreferredFoot} onValueChange={setFilterPreferredFoot}>
                  <SelectTrigger className="rounded-lg h-10 bg-white border-gray-200 font-body text-sm text-gray-900"><SelectValue placeholder={tr.allOpt} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr.allOpt}</SelectItem>
                    {filterSport === "basketball"
                      ? (<><SelectItem value="Dreapta">{translateFootHandValue("Dreapta", true, t)}</SelectItem><SelectItem value="Stânga">{translateFootHandValue("Stânga", true, t)}</SelectItem><SelectItem value="Ambele">{translateFootHandValue("Ambele", true, t)}</SelectItem></>)
                      : (<><SelectItem value="Drept">{translateFootHandValue("Drept", false, t)}</SelectItem><SelectItem value="Stâng">{translateFootHandValue("Stâng", false, t)}</SelectItem><SelectItem value="Ambele">{translateFootHandValue("Ambele", false, t)}</SelectItem></>)
                    }
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-xs font-semibold text-gray-500 font-body uppercase tracking-wider">{tr.birthDate}</label>
                <div className="flex gap-2">
                  <Popover open={dobFromOpen} onOpenChange={setDobFromOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal rounded-lg h-10 bg-white border-gray-200 font-body text-sm", !filterDobFrom && "text-gray-500")}>
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
                      <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal rounded-lg h-10 bg-white border-gray-200 font-body text-sm", !filterDobTo && "text-gray-500")}>
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
                <label className="text-xs font-semibold text-gray-500 font-body uppercase tracking-wider">{tr.sportSpec}</label>
                <Select value={filterSportSpec} onValueChange={setFilterSportSpec}>
                  <SelectTrigger className="rounded-lg h-10 bg-white border-gray-200 font-body text-sm text-gray-900"><SelectValue placeholder={tr.allOpt} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr.allOpt}</SelectItem>
                    {filterOptions.sportSpecs.map(s => <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 font-body uppercase tracking-wider">{tr.organization}</label>
                <Select value={filterOrganization} onValueChange={setFilterOrganization}>
                  <SelectTrigger className="rounded-lg h-10 bg-white border-gray-200 font-body text-sm text-gray-900"><SelectValue placeholder={tr.allOpt} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr.allOpt}</SelectItem>
                    {filterOptions.organizations.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 font-body uppercase tracking-wider">{tr.activityCountry}</label>
                <Select value={filterActivityCountry} onValueChange={setFilterActivityCountry}>
                  <SelectTrigger className="rounded-lg h-10 bg-white border-gray-200 font-body text-sm text-gray-900"><SelectValue placeholder={tr.allOpt} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr.allOpt}</SelectItem>
                    {filterOptions.activityCountries.map(c => <SelectItem key={c} value={c}>{getDisplayNationality(c, lang)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-gray-500 font-body uppercase tracking-wider">{tr.language}</label>
                <Select value={filterLanguage} onValueChange={setFilterLanguage}>
                  <SelectTrigger className="rounded-lg h-10 bg-white border-gray-200 font-body text-sm text-gray-900"><SelectValue placeholder={tr.allOpt} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{tr.allOpt}</SelectItem>
                    {filterOptions.languages.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </>)}

          </div>
          {activeFilterCount > 0 && (
            <div className="flex justify-end">
              <Button variant="ghost" size="sm" onClick={clearFilters} className="text-gray-500 hover:bg-gray-100 hover:text-gray-900 gap-1.5">
                <X className="h-3.5 w-3.5" />
                {tr.clear}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Results count */}
      <p className="text-xs text-gray-500 font-body">
        {items.length} {tr.results}
      </p>

      {/* Cards grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-[107px] rounded-md bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <p className="text-center text-gray-500 py-12 font-body">{tr.none}</p>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {items.map(item => {
              const initials = `${item.first_name?.[0] ?? ""}${item.last_name?.[0] ?? ""}`.toUpperCase();
              const subtitle = item.role === "player"
                ? [translatePosition(item.position, lang), item.current_team].filter(Boolean).join(" · ")
                : [item.title, item.organization].filter(Boolean).join(" · ");
              const clubLogo = item.role === "player" ? getLogoForTeam(item.current_team, item.sport) : null;
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
                  className="bg-white border border-gray-200 rounded-md overflow-hidden cursor-pointer hover:border-orange-300 hover:shadow-sm transition-all flex items-stretch h-[107px]"
                >
                  <div
                    className={`relative w-24 shrink-0 ${ROLE_COLOR[item.role]} flex items-center justify-center overflow-hidden`}
                    style={{ clipPath: "polygon(0 0, 100% 0, 72% 100%, 0% 100%)" }}
                  >
                    {item.photo_url ? (
                      <img src={item.photo_url} alt={`${item.first_name} ${item.last_name}`} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-display text-2xl text-white/90">{initials || <User className="h-8 w-8" />}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 flex items-center justify-between gap-2 px-4">
                    <div className="min-w-0">
                      <p className="text-[11px] font-body text-gray-500 uppercase tracking-wide truncate">
                        {item.first_name?.toUpperCase()}
                      </p>
                      <p className="font-display text-sm sm:text-base text-gray-900 uppercase truncate leading-tight">
                        {item.last_name?.toUpperCase()}
                      </p>
                      {subtitle && (
                        <p className="text-[11px] text-gray-400 font-body truncate mt-0.5">{subtitle}</p>
                      )}
                      {item.role === "player" && (
                        <span className="inline-block mt-0.5 text-[9px] font-body px-1.5 py-0.5 rounded bg-gradient-to-r from-indigo-600 to-purple-600 text-white whitespace-nowrap">
                          {tr.roleLabel.player}
                        </span>
                      )}
                    </div>
                    {clubLogo && (
                      <img src={clubLogo} alt={item.current_team || ""} className="shrink-0 w-11 h-11 object-contain" />
                    )}
                    {item.role !== "player" && (
                      <span className={`shrink-0 text-[9px] font-body px-1.5 py-0.5 rounded border whitespace-nowrap ${ROLE_BADGE[item.role]}`}>
                        {tr.roleLabel[item.role]}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Infinite scroll sentinel + loading indicator */}
          <div ref={sentinelRef} className="h-1" />
          {loadingMore && (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
            </div>
          )}
        </>
      )}

      {/* Decorative geometric shapes below the results */}
      <div className="relative h-0 overflow-visible">
        <div
          className="absolute -z-10 pointer-events-none"
          style={{
            top: "40px",
            right: "80px",
            width: "140px",
            height: "140px",
            background: "#a3e635",
            clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
            opacity: 0.9,
          }}
        />
        <div
          className="absolute -z-10 pointer-events-none"
          style={{
            top: "100px",
            left: "60px",
            width: "120px",
            height: "120px",
            background: "linear-gradient(135deg, #f97316, #fb923c)",
            clipPath: "polygon(0 100%, 100% 100%, 0 0)",
            opacity: 0.9,
          }}
        />
        <div
          className="absolute -z-10 pointer-events-none"
          style={{
            top: "260px",
            right: "220px",
            width: "110px",
            height: "110px",
            background: "linear-gradient(135deg, #7c3aed, #a855f7)",
            clipPath: "polygon(0 0, 100% 0, 0 100%)",
            opacity: 0.9,
          }}
        />
      </div>
    </div>
  );
};

export default CommunitySection;
