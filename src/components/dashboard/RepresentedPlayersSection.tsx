import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, User, X, Loader2, Search, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const SPORTS_LIST = [
  "Fotbal", "Baschet", "Tenis", "Handbal", "Volei", "Rugby", "Box",
  "Atletism", "Natație", "Ciclism", "Gimnastică", "Judo", "Karate",
  "Taekwondo", "Lupte", "Scrimă", "Haltere", "Tir", "Canotaj",
  "Kayak-Canoe", "Hochei", "Polo", "Baseball", "Softball", "Cricket",
  "Golf", "Badminton", "Tenis de masă", "Patinaj", "Schi", "Snowboard",
  "MMA", "Kickboxing", "Squash", "Padel", "Futsal",
];

const POSITIONS_BY_SPORT: Record<string, string[]> = {
  Fotbal: ["Portar", "Fundaș central", "Fundaș stânga", "Fundaș dreapta", "Mijlocaș central", "Mijlocaș ofensiv", "Mijlocaș defensiv", "Extremă stânga", "Extremă dreapta", "Atacant", "Vârf"],
  Baschet: ["Point Guard", "Shooting Guard", "Small Forward", "Power Forward", "Center"],
  Tenis: ["Jucător de simplu", "Jucător de dublu"],
  Handbal: ["Portar", "Pivot", "Inter stânga", "Inter dreapta", "Extremă stânga", "Extremă dreapta", "Centru"],
  Volei: ["Ridicător", "Opposite", "Libero", "Outside Hitter", "Middle Blocker"],
  Rugby: ["Pilier", "Talonator", "A doua linie", "Flanker", "Număr 8", "Deschizător", "Centru", "Aripa", "Fundaș"],
  Box: ["Categoria muscă", "Categoria bantam", "Categoria ușoară", "Categoria mijlocie", "Categoria grea", "Categoria super-grea"],
  Hochei: ["Portar", "Fundaș", "Centru", "Aripa stânga", "Aripa dreapta"],
  Futsal: ["Portar", "Fixo", "Ala", "Pivot"],
  Baseball: ["Pitcher", "Catcher", "First Base", "Second Base", "Shortstop", "Third Base", "Outfielder"],
  Polo: ["Portar", "Center Forward", "Driver", "Point"],
};

interface RepresentedPlayer {
  id: string;
  type: "linked" | "manual";
  user_id?: string;
  first_name: string;
  last_name: string;
  photo_url: string | null;
  position: string | null;
  current_team: string | null;
  birth_year?: number | null;
  sport?: string | null;
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
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({
    first_name: "", last_name: "", position: "", birth_year: "", current_team: "", sport: "",
  });

  const availablePositions = manualForm.sport && POSITIONS_BY_SPORT[manualForm.sport]
    ? POSITIONS_BY_SPORT[manualForm.sport]
    : [];

  useEffect(() => {
    fetchRepresentedPlayers();
  }, [userId]);

  const fetchRepresentedPlayers = async () => {
    setLoading(true);
    const { data: collabs } = await supabase
      .from("agent_collaboration_requests")
      .select("id, player_user_id")
      .eq("agent_user_id", userId)
      .eq("status", "accepted");

    let linkedPlayers: RepresentedPlayer[] = [];
    if (collabs && collabs.length > 0) {
      const playerIds = collabs.map((c) => c.player_user_id);
      const { data: profiles } = await supabase
        .from("player_profiles")
        .select("user_id, first_name, last_name, photo_url, position, current_team, sport")
        .in("user_id", playerIds);

      linkedPlayers = (profiles || []).map((p) => {
        const collab = collabs.find((c) => c.player_user_id === p.user_id);
        return {
          id: collab?.id || p.user_id,
          type: "linked" as const,
          user_id: p.user_id,
          first_name: p.first_name,
          last_name: p.last_name,
          photo_url: p.photo_url,
          position: p.position,
          current_team: p.current_team,
          sport: p.sport,
        };
      });
    }

    const { data: manualData } = await supabase
      .from("agent_manual_players")
      .select("*")
      .eq("agent_user_id", userId);

    const manualPlayers: RepresentedPlayer[] = (manualData || []).map((m: any) => ({
      id: m.id,
      type: "manual" as const,
      first_name: m.first_name,
      last_name: m.last_name,
      photo_url: m.photo_url,
      position: m.position,
      current_team: m.current_team,
      birth_year: m.birth_year,
      sport: m.sport,
    }));

    setPlayers([...linkedPlayers, ...manualPlayers]);
    setLoading(false);
  };

  const handleSearch = async () => {
    if (!searchTerm.trim()) return;
    setSearching(true);
    const term = searchTerm.toLowerCase();
    const { data } = await supabase
      .from("player_profiles")
      .select("user_id, first_name, last_name, photo_url, position, current_team, sport");

    const existingLinked = new Set(players.filter((p) => p.type === "linked").map((p) => p.user_id));
    const filtered = (data || []).filter(
      (p) => !existingLinked.has(p.user_id) && `${p.first_name} ${p.last_name}`.toLowerCase().includes(term)
    );
    setSearchResults(filtered.slice(0, 10).map((p) => ({
      id: p.user_id,
      type: "linked" as const,
      user_id: p.user_id,
      first_name: p.first_name,
      last_name: p.last_name,
      photo_url: p.photo_url,
      position: p.position,
      current_team: p.current_team,
      sport: p.sport,
    })));
    setSearching(false);
  };

  const handleAddLinkedPlayer = async (playerUserId: string) => {
    setAdding(true);
    const { error } = await supabase.from("agent_collaboration_requests").insert({
      agent_user_id: userId, player_user_id: playerUserId, status: "accepted",
    });
    if (error) {
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
    closeDialog();
    toast({ title: "Jucător adăugat!" });
  };

  const handleAddManualPlayer = async () => {
    if (!manualForm.first_name.trim() || !manualForm.last_name.trim()) {
      toast({ title: "Eroare", description: "Numele și prenumele sunt obligatorii.", variant: "destructive" });
      return;
    }
    setAdding(true);
    const { error } = await supabase.from("agent_manual_players").insert({
      agent_user_id: userId,
      first_name: manualForm.first_name.trim(),
      last_name: manualForm.last_name.trim(),
      position: manualForm.position || null,
      birth_year: manualForm.birth_year ? parseInt(manualForm.birth_year) : null,
      current_team: manualForm.current_team.trim() || null,
      sport: manualForm.sport || null,
    });
    if (error) {
      toast({ title: "Eroare", description: error.message, variant: "destructive" });
      setAdding(false);
      return;
    }
    await fetchRepresentedPlayers();
    closeDialog();
    toast({ title: "Jucător adăugat manual!" });
  };

  const handleRemovePlayer = async (player: RepresentedPlayer) => {
    if (player.type === "linked" && player.user_id) {
      await supabase.from("agent_collaboration_requests").delete().eq("agent_user_id", userId).eq("player_user_id", player.user_id);
    } else {
      await supabase.from("agent_manual_players").delete().eq("id", player.id);
    }
    setPlayers((prev) => prev.filter((p) => p.id !== player.id));
    toast({ title: "Jucător eliminat." });
  };

  const closeDialog = () => {
    setShowAddDialog(false);
    setSearchTerm("");
    setSearchResults([]);
    setShowManualForm(false);
    setManualForm({ first_name: "", last_name: "", position: "", birth_year: "", current_team: "", sport: "" });
    setAdding(false);
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
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : players.length === 0 ? (
        <p className="text-muted-foreground italic text-sm font-body">Niciun jucător reprezentat.</p>
      ) : (
        <div className="space-y-3">
          {players.map((player) => (
            <div key={player.id} className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                {player.photo_url ? (
                  <img src={player.photo_url} alt={`${player.first_name} ${player.last_name}`} className="w-full h-full object-cover" />
                ) : (
                  <User className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-body font-semibold text-foreground text-sm truncate">
                  {player.first_name} {player.last_name}
                  {player.type === "manual" && <span className="ml-1.5 text-xs font-normal text-muted-foreground">(manual)</span>}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {[player.sport, player.position, player.current_team, player.birth_year ? `${player.birth_year}` : null].filter(Boolean).join(" • ")}
                </p>
              </div>
              {!readOnly && (
                <button
                  onClick={() => handleRemovePlayer(player)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={showAddDialog} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="bg-card border-border max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-foreground">Adaugă jucător</DialogTitle>
          </DialogHeader>

          {!showManualForm ? (
            <div className="space-y-4">
              <div className="flex gap-2">
                <Input
                  placeholder="Caută un jucător existent..."
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
                    key={p.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                    onClick={() => !adding && p.user_id && handleAddLinkedPlayer(p.user_id)}
                  >
                    <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                      {p.photo_url ? <img src={p.photo_url} alt="" className="w-full h-full object-cover" /> : <User className="h-4 w-4 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-body text-foreground truncate">{p.first_name} {p.last_name}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {[p.sport, p.position, p.current_team].filter(Boolean).join(" • ")}
                      </p>
                    </div>
                  </div>
                ))}
                {searchResults.length === 0 && searchTerm && !searching && (
                  <p className="text-sm text-muted-foreground text-center py-4">Niciun rezultat.</p>
                )}
              </div>
              <div className="border-t border-border pt-3">
                <Button variant="outline" className="w-full" onClick={() => setShowManualForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adaugă manual un jucător
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Prenume *</label>
                  <Input
                    placeholder="Prenume"
                    value={manualForm.first_name}
                    onChange={(e) => setManualForm((f) => ({ ...f, first_name: e.target.value }))}
                    className="bg-muted border-border text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Nume *</label>
                  <Input
                    placeholder="Nume"
                    value={manualForm.last_name}
                    onChange={(e) => setManualForm((f) => ({ ...f, last_name: e.target.value }))}
                    className="bg-muted border-border text-foreground"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Sport</label>
                <Select
                  value={manualForm.sport}
                  onValueChange={(val) => setManualForm((f) => ({ ...f, sport: val, position: "" }))}
                >
                  <SelectTrigger className="bg-muted border-border text-foreground">
                    <SelectValue placeholder="Selectează sportul" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {SPORTS_LIST.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Poziție</label>
                {availablePositions.length > 0 ? (
                  <Select
                    value={manualForm.position}
                    onValueChange={(val) => setManualForm((f) => ({ ...f, position: val }))}
                  >
                    <SelectTrigger className="bg-muted border-border text-foreground">
                      <SelectValue placeholder="Selectează poziția" />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {availablePositions.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    placeholder="Ex: Atacant, Fundaș..."
                    value={manualForm.position}
                    onChange={(e) => setManualForm((f) => ({ ...f, position: e.target.value }))}
                    className="bg-muted border-border text-foreground"
                  />
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Anul nașterii</label>
                  <Input
                    placeholder="Ex: 2001"
                    type="number"
                    value={manualForm.birth_year}
                    onChange={(e) => setManualForm((f) => ({ ...f, birth_year: e.target.value }))}
                    className="bg-muted border-border text-foreground"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Echipă</label>
                  <Input
                    placeholder="Ex: FC Steaua"
                    value={manualForm.current_team}
                    onChange={(e) => setManualForm((f) => ({ ...f, current_team: e.target.value }))}
                    className="bg-muted border-border text-foreground"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowManualForm(false)} disabled={adding}>
                  Înapoi
                </Button>
                <Button className="flex-1" onClick={handleAddManualPlayer} disabled={adding}>
                  {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Adaugă
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default RepresentedPlayersSection;
