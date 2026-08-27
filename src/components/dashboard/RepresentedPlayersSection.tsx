import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Users, User, X, Loader2, Plus, Star, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import SportInput, { SPORTS_LIST } from "@/components/ui/sport-input";
import { useLanguage } from "@/i18n/LanguageContext";

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
  const { t } = useLanguage();
  const tr = t.dashboard.representedPlayers;
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
  const [manualPositionEntry, setManualPositionEntry] = useState(false);

  const availablePositions = manualForm.sport && POSITIONS_BY_SPORT[manualForm.sport]
    ? POSITIONS_BY_SPORT[manualForm.sport]
    : [];

  useEffect(() => {
    fetchRepresentedPlayers();
  }, [userId]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(() => {
      handleSearch();
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

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
    const { error } = await supabase.rpc("send_collaboration_request", {
      _agent_user_id: userId,
      _player_user_id: playerUserId,
      _initiated_by: "agent",
    });
    if (error) {
      const msg = error.message || "";
      const cooldownMatch = msg.match(/COOLDOWN_ACTIVE:(\d+)/);
      if (cooldownMatch) {
        const days = cooldownMatch[1];
        toast({
          title: tr.cooldownTitle,
          description: tr.cooldownDescTemplate.replace("{n}", days),
          variant: "destructive",
        });
      } else {
        toast({ title: t.dashboard.tests.uploadErrorTitle, description: tr.requestFailedDesc, variant: "destructive" });
      }
      setAdding(false);
      return;
    }
    closeDialog();
    toast({ title: tr.requestSentTitle, description: tr.requestSentDesc });
  };

  const handleAddManualPlayer = async () => {
    if (!manualForm.first_name.trim() || !manualForm.last_name.trim()) {
      toast({ title: t.dashboard.tests.uploadErrorTitle, description: tr.nameRequiredDesc, variant: "destructive" });
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
      toast({ title: t.dashboard.tests.uploadErrorTitle, description: error.message, variant: "destructive" });
      setAdding(false);
      return;
    }
    await fetchRepresentedPlayers();
    closeDialog();
    toast({ title: tr.playerAddedManually });
  };

  const handleRemovePlayer = async (player: RepresentedPlayer) => {
    const { error } = player.type === "linked" && player.user_id
      ? await supabase.from("agent_collaboration_requests").delete().eq("agent_user_id", userId).eq("player_user_id", player.user_id)
      : await supabase.from("agent_manual_players").delete().eq("id", player.id);
    if (error) {
      toast({ title: t.dashboard.tests.uploadErrorTitle, description: tr.playerRemoveFailedDesc, variant: "destructive" });
      return;
    }
    setPlayers((prev) => prev.filter((p) => p.id !== player.id));
    toast({ title: tr.playerRemoved });
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
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="h-5 w-5 text-orange-500" />
          <h2 className="font-display text-2xl text-gray-900">{tr.title}</h2>
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                onClick={(e) => e.stopPropagation()}
                className="p-1.5 -m-1.5 text-gray-500 hover:text-orange-500 transition-colors rounded-full"
              >
                <Info className="h-4 w-4" />
              </button>
            </PopoverTrigger>
            <PopoverContent side="bottom" align="start" className="w-72 text-sm">
              <p className="font-semibold mb-2">{tr.whatIsThisTitle}</p>
              <p className="text-gray-500">
                {tr.whatIsThisDesc}
              </p>
            </PopoverContent>
          </Popover>
        </div>
        {!readOnly && (
          <button
            onClick={() => setShowAddDialog(true)}
            className="text-gray-500 hover:text-orange-500 transition-colors p-1.5 rounded-lg hover:bg-gray-100"
            title={tr.addPlayerAria}
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
        </div>
      ) : players.length === 0 ? (
        <p className="text-gray-500 italic text-sm font-body">{tr.noPlayersYet}</p>
      ) : (
        <div className="space-y-3">
          {players.map((player) => (
            <div key={player.id} className="flex items-center gap-3 group">
              <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                {player.photo_url ? (
                  <img src={player.photo_url} alt={`${player.first_name} ${player.last_name}`} className="w-full h-full object-cover" />
                ) : (
                  <User className="h-5 w-5 text-gray-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-body font-semibold text-gray-900 text-sm truncate flex items-center gap-1.5">
                  <span className="truncate">{player.first_name} {player.last_name}</span>
                  {player.type === "linked" && (
                    <button
                      type="button"
                      onClick={() => toast({ title: tr.hasAccountToastTitle, description: tr.hasAccountToastDesc })}
                      className="text-orange-500 hover:scale-110 transition-transform flex-shrink-0"
                      title={tr.hasAccountTooltip}
                    >
                      <Star className="h-3.5 w-3.5 fill-orange-500" />
                    </button>
                  )}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {[player.sport, player.position, player.current_team, player.birth_year ? `${player.birth_year}` : null].filter(Boolean).join(" • ")}
                </p>
              </div>
              {!readOnly && (
                <button
                  onClick={() => handleRemovePlayer(player)}
                  className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-destructive transition-all p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Dialog open={showAddDialog} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="bg-white border-gray-200 max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-gray-900">{tr.addPlayerDialogTitle}</DialogTitle>
          </DialogHeader>

          {!showManualForm ? (
            <div className="space-y-4">
               <div className="relative">
                  <Input
                    placeholder={tr.searchPlaceholder}
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="bg-gray-100 border-gray-300 text-gray-900"
                  />
                  {searching && <Loader2 className="h-4 w-4 animate-spin absolute right-3 top-1/2 -translate-y-1/2 text-gray-500" />}
                </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {searchResults.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                    onClick={() => !adding && p.user_id && handleAddLinkedPlayer(p.user_id)}
                  >
                    <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {p.photo_url ? <img src={p.photo_url} alt="" className="w-full h-full object-cover" /> : <User className="h-4 w-4 text-gray-500" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-body text-gray-900 truncate">{p.first_name} {p.last_name}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {[p.sport, p.position, p.current_team].filter(Boolean).join(" • ")}
                      </p>
                    </div>
                  </div>
                ))}
                {searchResults.length === 0 && searchTerm && !searching && (
                  <p className="text-sm text-gray-500 text-center py-4">{tr.noResults}</p>
                )}
              </div>
              <div className="border-t border-gray-200 pt-3">
                <Button variant="outline" className="w-full" onClick={() => setShowManualForm(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {tr.addManuallyBtn}
                </Button>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">{tr.firstNameLabel}</label>
                  <Input
                    placeholder={t.dashboard.profile.firstName}
                    value={manualForm.first_name}
                    onChange={(e) => setManualForm((f) => ({ ...f, first_name: e.target.value }))}
                    className="bg-gray-100 border-gray-300 text-gray-900"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">{tr.lastNameLabel}</label>
                  <Input
                    placeholder={t.dashboard.profile.lastName}
                    value={manualForm.last_name}
                    onChange={(e) => setManualForm((f) => ({ ...f, last_name: e.target.value }))}
                    className="bg-gray-100 border-gray-300 text-gray-900"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">{tr.sportLabel}</label>
                <SportInput
                  value={manualForm.sport}
                  onChange={(val) => { setManualForm((f) => ({ ...f, sport: val, position: "" })); setManualPositionEntry(false); }}
                  placeholder={tr.searchSportPlaceholder}
                  className="bg-gray-100 border-gray-300 text-gray-900"
                />
              </div>

              <div>
                <label className="text-xs text-gray-500 mb-1 block">{tr.positionLabel}</label>
                {availablePositions.length > 0 && !manualPositionEntry ? (
                  <Select
                    value={manualForm.position}
                    onValueChange={(val) => {
                      if (val === "__manual__") {
                        setManualPositionEntry(true);
                        setManualForm((f) => ({ ...f, position: "" }));
                      } else {
                        setManualForm((f) => ({ ...f, position: val }));
                      }
                    }}
                  >
                    <SelectTrigger className="bg-gray-100 border-gray-300 text-gray-900">
                      <SelectValue placeholder={tr.selectPositionPlaceholder} />
                    </SelectTrigger>
                    <SelectContent className="max-h-60">
                      {availablePositions.map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                      <SelectItem value="__manual__">{tr.otherManualEntry}</SelectItem>
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="space-y-1.5">
                    <Input
                      placeholder={tr.positionManualPlaceholder}
                      value={manualForm.position}
                      onChange={(e) => setManualForm((f) => ({ ...f, position: e.target.value }))}
                      className="bg-gray-100 border-gray-300 text-gray-900"
                    />
                    {availablePositions.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setManualPositionEntry(false); setManualForm((f) => ({ ...f, position: "" })); }}
                        className="text-xs text-orange-500 hover:underline"
                      >
                        {tr.chooseFromListBtn}
                      </button>
                    )}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">{tr.birthYearLabel}</label>
                  <Input
                    placeholder={tr.birthYearPlaceholder}
                    type="number"
                    value={manualForm.birth_year}
                    onChange={(e) => setManualForm((f) => ({ ...f, birth_year: e.target.value }))}
                    className="bg-gray-100 border-gray-300 text-gray-900"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-1 block">{tr.teamLabel}</label>
                  <Input
                    placeholder={tr.teamPlaceholder}
                    value={manualForm.current_team}
                    onChange={(e) => setManualForm((f) => ({ ...f, current_team: e.target.value }))}
                    className="bg-gray-100 border-gray-300 text-gray-900"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setShowManualForm(false)} disabled={adding}>
                  {t.dashboard.recommendations.backBtn}
                </Button>
                <Button className="flex-1" onClick={handleAddManualPlayer} disabled={adding}>
                  {adding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  {t.dashboard.profile.addBtn}
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
