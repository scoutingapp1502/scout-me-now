import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, User, SlidersHorizontal, X, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/i18n/LanguageContext";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
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
  const { lang, t } = useLanguage();

  useEffect(() => {
    const fetchPlayers = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("player_profiles")
        .select("user_id, first_name, last_name, photo_url, current_team, position, nationality, sport")
        .order("first_name", { ascending: true })
        .limit(100);

      if (!error && data) setPlayers(data);
      setLoading(false);
    };
    fetchPlayers();
  }, []);

  // Extract unique values for filter dropdowns
  const uniqueSports = useMemo(() => [...new Set(players.map(p => p.sport).filter(Boolean))].sort(), [players]);
  const uniquePositions = useMemo(() => [...new Set(players.map(p => p.position).filter(Boolean))].sort(), [players]);
  const uniqueNationalities = useMemo(() => [...new Set(players.map(p => p.nationality).filter(Boolean))].sort(), [players]);

  const activeFilterCount = [filterSport, filterPosition, filterNationality].filter(f => f !== "all").length;

  const filtered = useMemo(() => {
    return players.filter((p) => {
      const name = `${p.first_name} ${p.last_name}`.toLowerCase();
      if (!name.includes(search.toLowerCase())) return false;
      if (filterSport !== "all" && p.sport !== filterSport) return false;
      if (filterPosition !== "all" && p.position !== filterPosition) return false;
      if (filterNationality !== "all" && p.nationality !== filterNationality) return false;
      return true;
    });
  }, [players, search, filterSport, filterPosition, filterNationality]);

  const clearFilters = () => {
    setFilterSport("all");
    setFilterPosition("all");
    setFilterNationality("all");
  };

  const tr = lang === "ro" ? {
    searchPlaceholder: "Caută un jucător...",
    filters: "Filtre",
    noPlayers: "Niciun jucător găsit.",
    allSports: "Toate sporturile",
    allPositions: "Toate pozițiile",
    allNationalities: "Toate naționalitățile",
    sport: "Sport",
    position: "Poziție",
    nationality: "Naționalitate",
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
    sport: "Sport",
    position: "Position",
    nationality: "Nationality",
    clearFilters: "Clear filters",
    results: "results",
    playerProfile: "Player profile",
  };

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
          showFilters ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="bg-card border border-border rounded-xl p-4 sm:p-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Sport filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground font-body uppercase tracking-wider">
                {tr.sport}
              </label>
              <Select value={filterSport} onValueChange={setFilterSport}>
                <SelectTrigger className="rounded-lg h-10 bg-background border-border font-body text-sm">
                  <SelectValue placeholder={tr.allSports} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr.allSports}</SelectItem>
                  {uniqueSports.map(s => (
                    <SelectItem key={s} value={s!} className="capitalize">{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Position filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground font-body uppercase tracking-wider">
                {tr.position}
              </label>
              <Select value={filterPosition} onValueChange={setFilterPosition}>
                <SelectTrigger className="rounded-lg h-10 bg-background border-border font-body text-sm">
                  <SelectValue placeholder={tr.allPositions} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr.allPositions}</SelectItem>
                  {uniquePositions.map(p => (
                    <SelectItem key={p} value={p!}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Nationality filter */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground font-body uppercase tracking-wider">
                {tr.nationality}
              </label>
              <Select value={filterNationality} onValueChange={setFilterNationality}>
                <SelectTrigger className="rounded-lg h-10 bg-background border-border font-body text-sm">
                  <SelectValue placeholder={tr.allNationalities} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{tr.allNationalities}</SelectItem>
                  {uniqueNationalities.map(n => (
                    <SelectItem key={n} value={n!}>{n}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Active filters + clear */}
          {activeFilterCount > 0 && (
            <div className="flex items-center gap-2 mt-4 pt-3 border-t border-border">
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
      {!showFilters && activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {filterSport !== "all" && (
            <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-body font-medium px-3 py-1.5 rounded-full">
              {filterSport}
              <button onClick={() => setFilterSport("all")} className="hover:bg-primary/20 rounded-full p-0.5"><X className="h-3 w-3" /></button>
            </span>
          )}
          {filterPosition !== "all" && (
            <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-body font-medium px-3 py-1.5 rounded-full">
              {filterPosition}
              <button onClick={() => setFilterPosition("all")} className="hover:bg-primary/20 rounded-full p-0.5"><X className="h-3 w-3" /></button>
            </span>
          )}
          {filterNationality !== "all" && (
            <span className="inline-flex items-center gap-1.5 bg-primary/10 text-primary text-xs font-body font-medium px-3 py-1.5 rounded-full">
              {filterNationality}
              <button onClick={() => setFilterNationality("all")} className="hover:bg-primary/20 rounded-full p-0.5"><X className="h-3 w-3" /></button>
            </span>
          )}
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
              {/* Photo area with accent color */}
              <div className={`relative w-20 h-24 flex-shrink-0 ${COLORS[idx % COLORS.length]} flex items-end justify-center overflow-hidden`}>
                {player.photo_url ? (
                  <img
                    src={player.photo_url}
                    alt={`${player.first_name} ${player.last_name}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="h-10 w-10 text-white/70 mb-2" />
                )}
              </div>

              {/* Player info */}
              <div className="flex-1 px-4 py-3 min-w-0">
                <p className="text-xs text-muted-foreground font-body uppercase tracking-wider truncate">
                  {player.first_name}
                </p>
                <p className="text-sm font-display text-foreground uppercase tracking-wide truncate">
                  {player.last_name}
                </p>
              </div>

              {/* Sport badge */}
              <div className="pr-3 flex-shrink-0">
                {player.sport ? (
                  <span className="text-[10px] text-muted-foreground font-body bg-muted px-2 py-1 rounded uppercase">
                    {player.sport}
                  </span>
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
          <DialogTitle className="sr-only">
            {tr.playerProfile}
          </DialogTitle>
          {selectedPlayerId && (
            <PersonalProfile userId={selectedPlayerId} readOnly />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PlayersSection;
