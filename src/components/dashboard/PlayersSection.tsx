import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, User, SlidersHorizontal, X, ChevronDown, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/i18n/LanguageContext";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import PersonalProfile from "@/components/dashboard/PersonalProfile";

interface PlayerCard {
  user_id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  current_team: string | null;
  position: string | null;
  nationality: string | null;
  sport: string | null;
  date_of_birth: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  preferred_foot: string | null;
}

const COLORS = [
  "bg-blue-600",
  "bg-orange-500",
  "bg-gray-400",
  "bg-emerald-600",
  "bg-blue-800",
  "bg-orange-400",
];

const PlayersSection = () => {
  const [players, setPlayers] = useState<PlayerCard[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [filterSport, setFilterSport] = useState<string>("all");
  const [filterPosition, setFilterPosition] = useState<string>("all");
  const [filterNationality, setFilterNationality] = useState<string>("all");
  const [filterFoot, setFilterFoot] = useState<string>("all");
  const [filterDobFrom, setFilterDobFrom] = useState<Date | undefined>();
  const [filterDobTo, setFilterDobTo] = useState<Date | undefined>();
  const [filterHeightMin, setFilterHeightMin] = useState("");
  const [filterHeightMax, setFilterHeightMax] = useState("");
  const [filterWeightMin, setFilterWeightMin] = useState("");
  const [filterWeightMax, setFilterWeightMax] = useState("");
  const { lang, t } = useLanguage();

  useEffect(() => {
    const fetchPlayers = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("player_profiles")
        .select("user_id, first_name, last_name, photo_url, current_team, position, nationality, sport, date_of_birth, height_cm, weight_kg, preferred_foot")
        .order("first_name", { ascending: true })
        .limit(100);

      if (!error && data) setPlayers(data);
      setLoading(false);
    };
    fetchPlayers();
  }, []);

  const uniqueSports = useMemo(() => [...new Set(players.map(p => p.sport).filter(Boolean))].sort(), [players]);
  const uniquePositions = useMemo(() => [...new Set(players.map(p => p.position).filter(Boolean))].sort(), [players]);
  const uniqueNationalities = useMemo(() => [...new Set(players.map(p => p.nationality).filter(Boolean))].sort(), [players]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterSport !== "all") count++;
    if (filterPosition !== "all") count++;
    if (filterNationality !== "all") count++;
    if (filterFoot !== "all") count++;
    if (filterDobFrom) count++;
    if (filterDobTo) count++;
    if (filterHeightMin) count++;
    if (filterHeightMax) count++;
    if (filterWeightMin) count++;
    if (filterWeightMax) count++;
    return count;
  }, [filterSport, filterPosition, filterNationality, filterFoot, filterDobFrom, filterDobTo, filterHeightMin, filterHeightMax, filterWeightMin, filterWeightMax]);

  const filtered = useMemo(() => {
    return players.filter((p) => {
      const name = `${p.first_name} ${p.last_name}`.toLowerCase();
      if (!name.includes(search.toLowerCase())) return false;
      if (filterSport !== "all" && p.sport !== filterSport) return false;
      if (filterPosition !== "all" && p.position !== filterPosition) return false;
      if (filterNationality !== "all" && p.nationality !== filterNationality) return false;
      if (filterFoot !== "all" && p.preferred_foot !== filterFoot) return false;
      if (filterDobFrom && p.date_of_birth && new Date(p.date_of_birth) < filterDobFrom) return false;
      if (filterDobTo && p.date_of_birth && new Date(p.date_of_birth) > filterDobTo) return false;
      if (filterDobFrom && !p.date_of_birth) return false;
      if (filterDobTo && !p.date_of_birth) return false;
      if (filterHeightMin && (!p.height_cm || p.height_cm < Number(filterHeightMin))) return false;
      if (filterHeightMax && (!p.height_cm || p.height_cm > Number(filterHeightMax))) return false;
      if (filterWeightMin && (!p.weight_kg || p.weight_kg < Number(filterWeightMin))) return false;
      if (filterWeightMax && (!p.weight_kg || p.weight_kg > Number(filterWeightMax))) return false;
      return true;
    });
  }, [players, search, filterSport, filterPosition, filterNationality, filterFoot, filterDobFrom, filterDobTo, filterHeightMin, filterHeightMax, filterWeightMin, filterWeightMax]);

  const clearFilters = () => {
    setFilterSport("all");
    setFilterPosition("all");
    setFilterNationality("all");
    setFilterFoot("all");
    setFilterDobFrom(undefined);
    setFilterDobTo(undefined);
    setFilterHeightMin("");
    setFilterHeightMax("");
    setFilterWeightMin("");
    setFilterWeightMax("");
  };

  const tr = lang === "ro" ? {
    searchPlaceholder: "Caută un jucător...",
    filters: "Filtre",
    noPlayers: "Niciun jucător găsit.",
    allSports: "Toate sporturile",
    allPositions: "Toate pozițiile",
    allNationalities: "Toate naționalitățile",
    allFeet: "Orice picior",
    sport: "Sport",
    position: "Poziție",
    nationality: "Naționalitate",
    foot: "Picior preferat",
    right: "Drept",
    left: "Stâng",
    both: "Ambele",
    dobFrom: "Născut după",
    dobTo: "Născut înainte",
    pickDate: "Alege data",
    heightMin: "Înălțime min (cm)",
    heightMax: "Înălțime max (cm)",
    weightMin: "Greutate min (kg)",
    weightMax: "Greutate max (kg)",
    height: "Înălțime",
    weight: "Greutate",
    birthDate: "Data nașterii",
    clearFilters: "Șterge filtrele",
    results: "rezultate",
    playerProfile: "Profil jucător",
  } : {
    searchPlaceholder: "Find a player...",
    filters: "Filters",
    noPlayers: "No players found.",
    allSports: "All sports",
    allPositions: "All positions",
    allNationalities: "All nationalities",
    allFeet: "Any foot",
    sport: "Sport",
    position: "Position",
    nationality: "Nationality",
    foot: "Preferred foot",
    right: "Right",
    left: "Left",
    both: "Both",
    dobFrom: "Born after",
    dobTo: "Born before",
    pickDate: "Pick date",
    heightMin: "Min height (cm)",
    heightMax: "Max height (cm)",
    weightMin: "Min weight (kg)",
    weightMax: "Max weight (kg)",
    height: "Height",
    weight: "Weight",
    birthDate: "Date of birth",
    clearFilters: "Clear filters",
    results: "results",
    playerProfile: "Player profile",
  };

  // Build chip labels for active filters
  const activeChips: { label: string; clear: () => void }[] = [];
  if (filterSport !== "all") activeChips.push({ label: filterSport, clear: () => setFilterSport("all") });
  if (filterPosition !== "all") activeChips.push({ label: filterPosition, clear: () => setFilterPosition("all") });
  if (filterNationality !== "all") activeChips.push({ label: filterNationality, clear: () => setFilterNationality("all") });
  if (filterFoot !== "all") activeChips.push({ label: `${tr.foot}: ${filterFoot}`, clear: () => setFilterFoot("all") });
  if (filterDobFrom) activeChips.push({ label: `${tr.dobFrom}: ${format(filterDobFrom, "dd/MM/yyyy")}`, clear: () => setFilterDobFrom(undefined) });
  if (filterDobTo) activeChips.push({ label: `${tr.dobTo}: ${format(filterDobTo, "dd/MM/yyyy")}`, clear: () => setFilterDobTo(undefined) });
  if (filterHeightMin) activeChips.push({ label: `${tr.height} ≥ ${filterHeightMin}cm`, clear: () => setFilterHeightMin("") });
  if (filterHeightMax) activeChips.push({ label: `${tr.height} ≤ ${filterHeightMax}cm`, clear: () => setFilterHeightMax("") });
  if (filterWeightMin) activeChips.push({ label: `${tr.weight} ≥ ${filterWeightMin}kg`, clear: () => setFilterWeightMin("") });
  if (filterWeightMax) activeChips.push({ label: `${tr.weight} ≤ ${filterWeightMax}kg`, clear: () => setFilterWeightMax("") });

  return (
    <div className="space-y-5">
      {/* Search + Filter toggle row */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
        <div className="relative flex-1 max-w-lg">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={tr.searchPlaceholder}
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
          {tr.filters}
          {activeFilterCount > 0 && (
            <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {activeFilterCount}
            </span>
          )}
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`} />
        </Button>
      </div>

      {/* Filter panel */}
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          showFilters ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5 space-y-4">
          {/* Row 1: Sport, Position, Nationality, Foot */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground font-body uppercase tracking-wider">{tr.sport}</label>
              <Select value={filterSport} onValueChange={setFilterSport}>
                <SelectTrigger className="rounded-lg h-10 bg-background border-border font-body text-sm">
                  <SelectValue placeholder={tr.allSports} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr.allSports}</SelectItem>
                  {uniqueSports.map(s => <SelectItem key={s} value={s!} className="capitalize">{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground font-body uppercase tracking-wider">{tr.position}</label>
              <Select value={filterPosition} onValueChange={setFilterPosition}>
                <SelectTrigger className="rounded-lg h-10 bg-background border-border font-body text-sm">
                  <SelectValue placeholder={tr.allPositions} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr.allPositions}</SelectItem>
                  {uniquePositions.map(p => <SelectItem key={p} value={p!}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground font-body uppercase tracking-wider">{tr.nationality}</label>
              <Select value={filterNationality} onValueChange={setFilterNationality}>
                <SelectTrigger className="rounded-lg h-10 bg-background border-border font-body text-sm">
                  <SelectValue placeholder={tr.allNationalities} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr.allNationalities}</SelectItem>
                  {uniqueNationalities.map(n => <SelectItem key={n} value={n!}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground font-body uppercase tracking-wider">{tr.foot}</label>
              <Select value={filterFoot} onValueChange={setFilterFoot}>
                <SelectTrigger className="rounded-lg h-10 bg-background border-border font-body text-sm">
                  <SelectValue placeholder={tr.allFeet} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr.allFeet}</SelectItem>
                  <SelectItem value="Drept">{tr.right}</SelectItem>
                  <SelectItem value="Stâng">{tr.left}</SelectItem>
                  <SelectItem value="Ambele">{tr.both}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: DOB range, Height range, Weight range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Date of birth range */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground font-body uppercase tracking-wider">{tr.birthDate}</label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-left font-normal rounded-lg h-10 bg-background border-border font-body text-sm",
                        !filterDobFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {filterDobFrom ? format(filterDobFrom, "dd/MM/yyyy") : <span className="truncate">{tr.dobFrom}</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filterDobFrom}
                      onSelect={setFilterDobFrom}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 justify-start text-left font-normal rounded-lg h-10 bg-background border-border font-body text-sm",
                        !filterDobTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                      {filterDobTo ? format(filterDobTo, "dd/MM/yyyy") : <span className="truncate">{tr.dobTo}</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={filterDobTo}
                      onSelect={setFilterDobTo}
                      disabled={(date) => date > new Date()}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Height range */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground font-body uppercase tracking-wider">{tr.height}</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder={tr.heightMin}
                  value={filterHeightMin}
                  onChange={(e) => setFilterHeightMin(e.target.value)}
                  className="flex-1 rounded-lg h-10 bg-background border-border font-body text-sm"
                />
                <Input
                  type="number"
                  placeholder={tr.heightMax}
                  value={filterHeightMax}
                  onChange={(e) => setFilterHeightMax(e.target.value)}
                  className="flex-1 rounded-lg h-10 bg-background border-border font-body text-sm"
                />
              </div>
            </div>

            {/* Weight range */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground font-body uppercase tracking-wider">{tr.weight}</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  placeholder={tr.weightMin}
                  value={filterWeightMin}
                  onChange={(e) => setFilterWeightMin(e.target.value)}
                  className="flex-1 rounded-lg h-10 bg-background border-border font-body text-sm"
                />
                <Input
                  type="number"
                  placeholder={tr.weightMax}
                  value={filterWeightMax}
                  onChange={(e) => setFilterWeightMax(e.target.value)}
                  className="flex-1 rounded-lg h-10 bg-background border-border font-body text-sm"
                />
              </div>
            </div>
          </div>

          {/* Active filters + clear */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2 pt-3 border-t border-border">
              <span className="text-xs text-muted-foreground font-body">
                {filtered.length} {tr.results}
              </span>
              <div className="flex-1" />
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-xs text-destructive hover:text-destructive hover:bg-destructive/10 font-body gap-1 h-7 px-2"
              >
                <X className="h-3 w-3" />
                {tr.clearFilters}
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Active filter chips (visible when filter panel is closed) */}
      {!showFilters && activeChips.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {activeChips.map((chip, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-body font-medium px-3 py-1.5 rounded-full">
              {chip.label}
              <button onClick={chip.clear} className="hover:bg-primary/20 rounded-full p-0.5"><X className="h-3 w-3" /></button>
            </span>
          ))}
          <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-destructive font-body underline">
            {tr.clearFilters}
          </button>
        </div>
      )}

      {/* Players grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <User className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-muted-foreground font-body">{tr.noPlayers}</p>
          {activeFilterCount > 0 && (
            <Button variant="link" onClick={clearFilters} className="text-primary font-body text-sm mt-1">
              {tr.clearFilters}
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((player, idx) => (
            <div
              key={player.user_id}
              onClick={() => setSelectedPlayerId(player.user_id)}
              className="flex items-center bg-card border border-border rounded-lg overflow-hidden hover:border-primary/50 transition-colors cursor-pointer group"
            >
              <div className={`relative w-20 h-24 flex-shrink-0 ${COLORS[idx % COLORS.length]} flex items-end justify-center overflow-hidden`}>
                {player.photo_url ? (
                  <img src={player.photo_url} alt={`${player.first_name} ${player.last_name}`} className="w-full h-full object-cover" />
                ) : (
                  <User className="h-10 w-10 text-white/70 mb-2" />
                )}
              </div>
              <div className="flex-1 px-4 py-3 min-w-0">
                <p className="text-xs text-muted-foreground font-body uppercase tracking-wider truncate">{player.first_name}</p>
                <p className="text-sm font-display text-foreground uppercase tracking-wide truncate">{player.last_name}</p>
              </div>
              <div className="pr-3 flex-shrink-0">
                {player.sport ? (
                  <span className="text-[10px] text-muted-foreground font-body bg-muted px-2 py-1 rounded uppercase">{player.sport}</span>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Player profile dialog */}
      <Dialog open={!!selectedPlayerId} onOpenChange={(open) => !open && setSelectedPlayerId(null)}>
        <DialogContent 
          className="max-w-4xl w-full sm:w-[95vw] h-[100dvh] sm:h-auto sm:max-h-[90vh] overflow-y-auto p-0 gap-0 bg-background border-0 sm:border sm:border-border rounded-none sm:rounded-xl inset-0 sm:inset-auto sm:left-[50%] sm:top-[50%] sm:translate-x-[-50%] sm:translate-y-[-50%]"
          onPointerDownOutside={(e) => e.preventDefault()}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <DialogTitle className="sr-only">{tr.playerProfile}</DialogTitle>
          {selectedPlayerId && <PersonalProfile userId={selectedPlayerId} readOnly />}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlayersSection;
