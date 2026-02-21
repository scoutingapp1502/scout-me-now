import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Search, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/i18n/LanguageContext";

interface PlayerCard {
  user_id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  current_team: string | null;
  position: string | null;
  nationality: string | null;
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
  const { lang } = useLanguage();

  useEffect(() => {
    const fetchPlayers = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("player_profiles")
        .select("user_id, first_name, last_name, photo_url, current_team, position, nationality")
        .order("first_name", { ascending: true })
        .limit(10);

      if (!error && data) setPlayers(data);
      setLoading(false);
    };
    fetchPlayers();
  }, []);

  const filtered = players.filter((p) => {
    const name = `${p.first_name} ${p.last_name}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="flex justify-center">
        <div className="relative w-full max-w-md">
          <Input
            placeholder={lang === "ro" ? "Caută un jucător" : "Find a player"}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pr-10 bg-card border-border text-foreground rounded-full h-12 px-5 text-sm"
          />
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        </div>
      </div>

      {/* Players grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-24 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-12 font-body">
          {lang === "ro" ? "Niciun jucător găsit." : "No players found."}
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((player, idx) => (
            <div
              key={player.user_id}
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

              {/* Team / Position badge */}
              <div className="pr-3 flex-shrink-0">
                {player.current_team ? (
                  <span className="text-[10px] text-muted-foreground font-body bg-muted px-2 py-1 rounded">
                    {player.current_team}
                  </span>
                ) : player.position ? (
                  <span className="text-[10px] text-muted-foreground font-body bg-muted px-2 py-1 rounded">
                    {player.position}
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

export default PlayersSection;
