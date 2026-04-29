import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Star, MessageCircle, Pencil, StickyNote, Download } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/i18n/LanguageContext";
import ScoutPlayerNoteDialog from "./ScoutPlayerNoteDialog";

interface PlayerNotesSectionProps {
  scoutUserId: string;
  onNavigateToChat?: (userId: string) => void;
}

interface NoteRow {
  id: string;
  player_user_id: string;
  label: string | null;
  personal_rating: number;
  observed_qualities: string[];
  custom_qualities: string[];
  match_watched: string | null;
  match_date: string | null;
  observations: string | null;
  priority: string | null;
  updated_at: string;
  player?: {
    first_name: string;
    last_name: string;
    photo_url: string | null;
    sport: string | null;
    position: string | null;
  } | null;
}

const PRIORITY_LABEL_RO: Record<string, string> = { low: "Scăzută", medium: "Medie", high: "Înaltă" };
const PRIORITY_LABEL_EN: Record<string, string> = { low: "Low", medium: "Medium", high: "High" };
const PRIORITY_COLOR: Record<string, string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  high: "bg-destructive/15 text-destructive border-destructive/30",
};

export default function PlayerNotesSection({ scoutUserId, onNavigateToChat }: PlayerNotesSectionProps) {
  const { lang } = useLanguage();
  const ro = lang === "ro";

  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [search, setSearch] = useState("");
  const [filterLabel, setFilterLabel] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterRating, setFilterRating] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("updated_desc");
  const [editingPlayer, setEditingPlayer] = useState<NoteRow | null>(null);

  const fetchNotes = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("scout_player_notes")
      .select("*")
      .eq("scout_user_id", scoutUserId)
      .order("updated_at", { ascending: false });

    if (error || !data) { setNotes([]); setLoading(false); return; }

    const ids = data.map((n: NoteRow) => n.player_user_id);
    if (ids.length === 0) { setNotes([]); setLoading(false); return; }

    const { data: players } = await supabase
      .from("player_profiles")
      .select("user_id, first_name, last_name, photo_url, sport, position")
      .in("user_id", ids);

    const map = new Map((players || []).map((p: any) => [p.user_id, p]));
    setNotes(data.map((n: NoteRow) => ({ ...n, player: map.get(n.player_user_id) || null })));
    setLoading(false);
  };

  useEffect(() => { fetchNotes(); }, [scoutUserId]);

  const allLabels = useMemo(() => {
    const s = new Set<string>();
    notes.forEach(n => { if (n.label) s.add(n.label); });
    return Array.from(s).sort();
  }, [notes]);

  const filtered = useMemo(() => {
    let list = notes.filter(n => {
      if (filterLabel !== "all" && n.label !== filterLabel) return false;
      if (filterPriority !== "all" && n.priority !== filterPriority) return false;
      if (filterRating !== "all" && n.personal_rating < parseInt(filterRating)) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = `${n.player?.first_name || ""} ${n.player?.last_name || ""}`.toLowerCase();
        const obs = (n.observations || "").toLowerCase();
        const match = (n.match_watched || "").toLowerCase();
        if (!name.includes(q) && !obs.includes(q) && !match.includes(q)) return false;
      }
      return true;
    });
    if (sortBy === "rating_desc") list = [...list].sort((a, b) => b.personal_rating - a.personal_rating);
    else if (sortBy === "name_asc") list = [...list].sort((a, b) => {
      const an = `${a.player?.first_name || ""} ${a.player?.last_name || ""}`;
      const bn = `${b.player?.first_name || ""} ${b.player?.last_name || ""}`;
      return an.localeCompare(bn);
    });
    return list;
  }, [notes, search, filterLabel, filterPriority, filterRating, sortBy]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const priorityLabel = ro ? PRIORITY_LABEL_RO : PRIORITY_LABEL_EN;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display text-foreground flex items-center gap-3">
          <StickyNote className="h-8 w-8 text-primary" />
          {ro ? "Note jucători" : "Player notes"}
        </h1>
        <p className="text-sm text-muted-foreground font-body mt-1">
          {ro
            ? "Toate notițele tale private despre jucători, într-un singur loc."
            : "All your private player notes in one place."}
        </p>
      </div>

      {/* Filtre */}
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={ro ? "Caută după nume, observații sau meci…" : "Search by name, notes or match…"}
            className="pl-9"
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Select value={filterLabel} onValueChange={setFilterLabel}>
            <SelectTrigger><SelectValue placeholder={ro ? "Etichetă" : "Label"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ro ? "Toate etichetele" : "All labels"}</SelectItem>
              {allLabels.map(l => <SelectItem key={l} value={l}>{l}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger><SelectValue placeholder={ro ? "Prioritate" : "Priority"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ro ? "Toate prioritățile" : "All priorities"}</SelectItem>
              <SelectItem value="high">{priorityLabel.high}</SelectItem>
              <SelectItem value="medium">{priorityLabel.medium}</SelectItem>
              <SelectItem value="low">{priorityLabel.low}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterRating} onValueChange={setFilterRating}>
            <SelectTrigger><SelectValue placeholder={ro ? "Rating min." : "Min rating"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ro ? "Orice rating" : "Any rating"}</SelectItem>
              {[1, 2, 3, 4, 5].map(n => (
                <SelectItem key={n} value={String(n)}>{"★".repeat(n)}+</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="updated_desc">{ro ? "Cele mai recente" : "Most recent"}</SelectItem>
              <SelectItem value="rating_desc">{ro ? "Rating descrescător" : "Highest rating"}</SelectItem>
              <SelectItem value="name_asc">{ro ? "Nume A-Z" : "Name A-Z"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground font-body">
          {filtered.length} {ro ? "notițe" : "notes"}
        </div>
      </div>

      {/* Listă */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground font-body">
          {notes.length === 0
            ? (ro ? "Nu ai încă nicio notiță. Deschide profilul unui jucător pentru a adăuga una." : "No notes yet. Open a player's profile to add one.")
            : (ro ? "Niciun rezultat pentru filtrele selectate." : "No results for the selected filters.")}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(n => {
            const fullName = `${n.player?.first_name || ""} ${n.player?.last_name || ""}`.trim() || (ro ? "Jucător" : "Player");
            const initials = fullName.split(" ").map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
            const subtitle = [n.player?.sport, n.player?.position].filter(Boolean).join(" · ");
            return (
              <div key={n.id} className="bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 shrink-0 rounded-full bg-muted overflow-hidden flex items-center justify-center text-sm font-semibold text-muted-foreground border border-border">
                    {n.player?.photo_url
                      ? <img src={n.player.photo_url} alt={fullName} className="w-full h-full object-cover" />
                      : initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-heading font-semibold text-foreground truncate">{fullName}</div>
                        {subtitle && <div className="text-xs text-muted-foreground font-body capitalize truncate">{subtitle}</div>}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} className={`h-3.5 w-3.5 ${s <= n.personal_rating ? "text-primary fill-primary" : "text-muted-foreground/30"}`} />
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {n.label && <Badge variant="outline" className="text-xs">{n.label}</Badge>}
                      {n.priority && (
                        <Badge variant="outline" className={`text-xs ${PRIORITY_COLOR[n.priority] || ""}`}>
                          {priorityLabel[n.priority] || n.priority}
                        </Badge>
                      )}
                      {[...n.observed_qualities, ...(n.custom_qualities || [])].slice(0, 3).map(q => (
                        <Badge key={q} variant="secondary" className="text-xs">{q}</Badge>
                      ))}
                    </div>

                    {n.observations && (
                      <p className="text-sm text-foreground/80 font-body mt-2 line-clamp-2">{n.observations}</p>
                    )}

                    {(n.match_watched || n.match_date) && (
                      <div className="text-xs text-muted-foreground font-body mt-2">
                        {n.match_watched}{n.match_watched && n.match_date ? " · " : ""}{n.match_date}
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-border">
                      <span className="text-[11px] text-muted-foreground font-body">
                        {ro ? "Actualizat" : "Updated"}: {new Date(n.updated_at).toLocaleDateString(ro ? "ro-RO" : "en-US")}
                      </span>
                      <div className="flex gap-1.5">
                        {onNavigateToChat && (
                          <Button size="sm" variant="outline" onClick={() => onNavigateToChat(n.player_user_id)}>
                            <MessageCircle className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => setEditingPlayer(n)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />
                          {ro ? "Editează" : "Edit"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingPlayer && (
        <ScoutPlayerNoteDialog
          open={!!editingPlayer}
          onOpenChange={(v) => { if (!v) { setEditingPlayer(null); fetchNotes(); } }}
          scoutUserId={scoutUserId}
          playerUserId={editingPlayer.player_user_id}
          playerName={`${editingPlayer.player?.first_name || ""} ${editingPlayer.player?.last_name || ""}`.trim()}
          playerSubtitle={[editingPlayer.player?.sport, editingPlayer.player?.position].filter(Boolean).join(" · ")}
          playerPhotoUrl={editingPlayer.player?.photo_url || null}
        />
      )}
    </div>
  );
}
