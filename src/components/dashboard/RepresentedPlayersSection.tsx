import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, User, X, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface RepresentedPlayer {
  user_id: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  position: string | null;
  current_team: string | null;
  sport: string | null;
}

interface RepresentedPlayersSectionProps {
  userId: string;
  readOnly?: boolean;
}

const RepresentedPlayersSection = ({ userId, readOnly = false }: RepresentedPlayersSectionProps) => {
  const { toast } = useToast();
  const [players, setPlayers] = useState<RepresentedPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<RepresentedPlayer[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    fetchRepresentedPlayers();
  }, [userId]);

  const fetchRepresentedPlayers = async () => {
    setLoading(true);
    // Get accepted collaboration requests for this agent
    const { data: collabs } = await supabase
      .from("agent_collaboration_requests")
      .select("player_user_id")
      .eq("agent_user_id", userId)
      .eq("status", "accepted");

    if (!collabs || collabs.length === 0) {
      setPlayers([]);
      setLoading(false);
      return;
    }

    const playerIds = collabs.map((c) => c.player_user_id);
    const { data: profiles } = await supabase
      .from("player_profiles")
      .select("user_id, first_name, last_name, photo_url, position, current_team, sport")
      .in("user_id", playerIds);

    setPlayers(profiles || []);
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    const term = searchTerm.toLowerCase();
    const { data } = await supabase
      .from("player_profiles")
      .select("user_id, first_name, last_name, photo_url, position, current_team, sport");

    const existing = new Set(players.map((p) => p.user_id));
    const filtered = (data || []).filter(
      (p) =>
        !existing.has(p.user_id) &&
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(term)
    );
    setSearchResults(filtered.slice(0, 10));
    setSearching(false);
  };

  const handleAddPlayer = async (playerUserId: string) => {
    setAdding(true);
    // Create an accepted collaboration request directly (agent-initiated)
    const { error } = await supabase.from("agent_collaboration_requests").insert({
      agent_user_id: userId,
      player_user_id: playerUserId,
      status: "accepted",
    });
    if (error) {
      // Might already exist, try updating
      const { error: updateErr } = await supabase
        .from("agent_collaboration_requests")
        .update({ status: "accepted" })
        .eq("agent_user_id", userId)
        .eq("player_user_id", playerUserId);
      if (updateErr) {
        toast({ title: "Eroare", description: updateErr.message, variant: "destructive" });
        setAdding(false);
        return;
      }
    }
    await fetchRepresentedPlayers();
    setShowAddDialog(false);
    setSearchTerm("");
    setSearchResults([]);
    setAdding(false);
    toast({ title: "Jucător adăugat!" });
  };

  const handleRemovePlayer = async (playerUserId: string) => {
    await supabase
      .from("agent_collaboration_requests")
      .delete()
      .eq("agent_user_id", userId)
      .eq("player_user_id", playerUserId);
    setPlayers((prev) => prev.filter((p) => p.user_id !== playerUserId));
    toast({ title: "Jucător eliminat." });
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-primary" />
          <h2 className="font-display text-2xl text-foreground">Jucători reprezentați</h2>
        </div>
        {!readOnly && (
          <button
            onClick={() => setShowAddDialog(true)}
            className="text-muted-foreground hover:text-primary transition-colors p-1.5 rounded-lg hover:bg-accent/50"
            title="Adaugă jucător"
          >
            <Users className="h-4 w-4" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : players.length === 0 ? (
        <p className="text-muted-foreground italic text-sm font-body">
          Niciun jucător reprezentat.
        </p>
      ) : (
        <div className="space-y-3">
          {players.map((player) => (
            <div
              key={player.user_id}
              className="flex items-center gap-3 group"
            >
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                {player.photo_url ? (
                  <img
                    src={player.photo_url}
                    alt={`${player.first_name} ${player.last_name}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-body font-semibold text-foreground text-sm truncate">
                  {player.first_name} {player.last_name}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {[player.position, player.current_team].filter(Boolean).join(" • ") || player.sport || ""}
                </p>
              </div>
              {!readOnly && (
                <button
                  onClick={() => handleRemovePlayer(player.user_id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add player dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-foreground">Adaugă jucător</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Caută un jucător..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                className="bg-muted border-border text-foreground"
              />
              <Button onClick={handleSearch} disabled={searching} size="sm" variant="outline">
                {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {searchResults.map((p) => (
                <div
                  key={p.user_id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                  onClick={() => !adding && handleAddPlayer(p.user_id)}
                >
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                    {p.photo_url ? (
                      <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-body text-foreground truncate">
                      {p.first_name} {p.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {[p.position, p.current_team].filter(Boolean).join(" • ")}
                    </p>
                  </div>
                </div>
              ))}
              {searchResults.length === 0 && searchTerm && !searching && (
                <p className="text-sm text-muted-foreground text-center py-4">Niciun rezultat.</p>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RepresentedPlayersSection;
