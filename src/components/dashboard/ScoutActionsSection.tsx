import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Star, Pencil, StickyNote, Download, FileBarChart, ClipboardList } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useLanguage } from "@/i18n/LanguageContext";
import ScoutPlayerNoteDialog from "./ScoutPlayerNoteDialog";
import ScoutPlayerReportDialog, { exportReportPDF } from "./ScoutPlayerReportDialog";

interface Props {
  scoutUserId: string;
  onNavigateToChat?: (userId: string) => void;
}

/* ─── Notes ─────────────────────────────────────────────────────── */

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
  player?: { first_name: string; last_name: string; photo_url: string | null; sport: string | null; position: string | null } | null;
}

interface ReportRow {
  id: string;
  player_user_id: string;
  position: string | null;
  current_club: string | null;
  league: string | null;
  contract_until: string | null;
  salary_range: string | null;
  transfer_value: string | null;
  agent_name: string | null;
  overall_rating: number | null;
  fit_rating: number | null;
  technical_rating: number | null;
  technical_notes: string | null;
  physical_rating: number | null;
  physical_notes: string | null;
  mental_rating: number | null;
  mental_notes: string | null;
  financial_notes: string | null;
  pros_list: string[] | null;
  cons_list: string[] | null;
  conclusion_text: string | null;
  recommendation: string | null;
  updated_at: string;
  player?: { first_name: string; last_name: string; photo_url: string | null; sport: string | null; position: string | null } | null;
}

const PRIORITY_LABEL_RO: Record<string, string> = { low: "Scăzută", medium: "Medie", high: "Înaltă" };
const PRIORITY_LABEL_EN: Record<string, string> = { low: "Low", medium: "Medium", high: "High" };

const REC_LABEL_RO: Record<string, string> = { buy: "Cumpără", shortlist: "Listă scurtă", follow: "Urmărire", forget: "Renunță" };
const REC_LABEL_EN: Record<string, string> = { buy: "Buy", shortlist: "Shortlist", follow: "Follow", forget: "Forget" };
const REC_COLOR: Record<string, string> = {
  buy:       "bg-green-500/15 text-green-400 border-green-500/30",
  shortlist: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  follow:    "bg-blue-500/15 text-blue-400 border-blue-500/30",
  forget:    "bg-zinc-500/15 text-zinc-400 border-zinc-500/30",
};

function StarRow({ value, max = 10 }: { value: number | null; max?: number }) {
  if (!value) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star key={i} className={`h-3 w-3 ${i < value ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/20"}`} />
      ))}
      <span className="ml-1 text-xs text-muted-foreground">{value}/{max}</span>
    </div>
  );
}

/* ─── Main component ─────────────────────────────────────────────── */

export default function ScoutActionsSection({ scoutUserId }: Props) {
  const { lang } = useLanguage();
  const ro = lang === "ro";
  const [tab, setTab] = useState<"notes" | "reports">("notes");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display text-foreground flex items-center gap-3">
          <ClipboardList className="h-8 w-8 text-primary" />
          {ro ? "Acțiuni scouter" : "Scout actions"}
        </h1>
        <p className="text-sm text-muted-foreground font-body mt-1">
          {ro ? "Toate notițele și rapoartele tale despre jucători." : "All your notes and reports about players."}
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-border pb-0">
        <button
          onClick={() => setTab("notes")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-body border-b-2 transition-colors -mb-px ${tab === "notes" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <StickyNote className="h-4 w-4" />
          {ro ? "Notițe" : "Notes"}
        </button>
        <button
          onClick={() => setTab("reports")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-body border-b-2 transition-colors -mb-px ${tab === "reports" ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}
        >
          <FileBarChart className="h-4 w-4" />
          {ro ? "Rapoarte" : "Reports"}
        </button>
      </div>

      {tab === "notes" && <NotesTab scoutUserId={scoutUserId} />}
      {tab === "reports" && <ReportsTab scoutUserId={scoutUserId} />}
    </div>
  );
}

/* ─── Notes tab ──────────────────────────────────────────────────── */

function NotesTab({ scoutUserId }: { scoutUserId: string }) {
  const { lang } = useLanguage();
  const ro = lang === "ro";
  const priorityLabel = ro ? PRIORITY_LABEL_RO : PRIORITY_LABEL_EN;

  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [search, setSearch] = useState("");
  const [filterLabel, setFilterLabel] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterRating, setFilterRating] = useState("all");
  const [sortBy, setSortBy] = useState("updated_desc");
  const [editingPlayer, setEditingPlayer] = useState<NoteRow | null>(null);

  const fetchNotes = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("scout_player_notes").select("*").eq("scout_user_id", scoutUserId).order("updated_at", { ascending: false });
    if (!data?.length) { setNotes([]); setLoading(false); return; }
    const { data: players } = await supabase.from("player_profiles")
      .select("user_id, first_name, last_name, photo_url, sport, position")
      .in("user_id", data.map((n: NoteRow) => n.player_user_id));
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
        if (!name.includes(q) && !(n.observations || "").toLowerCase().includes(q) && !(n.match_watched || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
    if (sortBy === "rating_desc") list = [...list].sort((a, b) => b.personal_rating - a.personal_rating);
    else if (sortBy === "name_asc") list = [...list].sort((a, b) =>
      `${a.player?.first_name} ${a.player?.last_name}`.localeCompare(`${b.player?.first_name} ${b.player?.last_name}`)
    );
    return list;
  }, [notes, search, filterLabel, filterPriority, filterRating, sortBy]);

  const handleExportSinglePDF = (n: NoteRow) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const fullName = `${n.player?.first_name || ""} ${n.player?.last_name || ""}`.trim() || "-";
    doc.setFontSize(18); doc.text(ro ? "Notita jucator" : "Player note", 14, 18);
    doc.setFontSize(13); doc.setTextColor(60); doc.text(fullName, 14, 28);
    doc.setFontSize(10); doc.setTextColor(120);
    doc.text(`${ro ? "Actualizat" : "Updated"}: ${new Date(n.updated_at).toLocaleString(ro ? "ro-RO" : "en-US")}`, pageWidth - 14, 18, { align: "right" });
    const qualities = [...(n.observed_qualities || []), ...(n.custom_qualities || [])].join(", ") || "-";
    autoTable(doc, {
      startY: 42, theme: "grid", styles: { fontSize: 10, cellPadding: 3, overflow: "linebreak" },
      columnStyles: { 0: { cellWidth: 45, fontStyle: "bold", fillColor: [240, 245, 240] }, 1: { cellWidth: "auto" } },
      body: [
        [ro ? "Eticheta" : "Label", n.label || "-"],
        ["Rating", n.personal_rating ? `${n.personal_rating}/5` : "-"],
        [ro ? "Prioritate" : "Priority", n.priority ? (priorityLabel[n.priority] || n.priority) : "-"],
        [ro ? "Calitati" : "Qualities", qualities],
        [ro ? "Meci" : "Match", [n.match_watched, n.match_date].filter(Boolean).join(" - ") || "-"],
        [ro ? "Observatii" : "Observations", n.observations || "-"],
      ],
    });
    doc.save(`nota-${fullName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={ro ? "Caută după nume, observații sau meci…" : "Search by name, notes or match…"} className="pl-9" />
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
              <SelectItem value="all">{ro ? "Toate" : "All"}</SelectItem>
              <SelectItem value="high">{priorityLabel.high}</SelectItem>
              <SelectItem value="medium">{priorityLabel.medium}</SelectItem>
              <SelectItem value="low">{priorityLabel.low}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterRating} onValueChange={setFilterRating}>
            <SelectTrigger><SelectValue placeholder={ro ? "Rating min." : "Min rating"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ro ? "Orice" : "Any"}</SelectItem>
              {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={String(n)}>{"★".repeat(n)}+</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="updated_desc">{ro ? "Cele mai recente" : "Most recent"}</SelectItem>
              <SelectItem value="rating_desc">{ro ? "Rating desc." : "Highest rating"}</SelectItem>
              <SelectItem value="name_asc">{ro ? "Nume A-Z" : "Name A-Z"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground font-body">{filtered.length} {ro ? "notițe" : "notes"}</div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground font-body">
          {notes.length === 0
            ? (ro ? "Nu ai încă nicio notiță. Deschide profilul unui jucător pentru a adăuga una." : "No notes yet.")
            : (ro ? "Niciun rezultat pentru filtrele selectate." : "No results.")}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(n => {
            const fullName = `${n.player?.first_name || ""} ${n.player?.last_name || ""}`.trim() || (ro ? "Jucător" : "Player");
            const initials = fullName.split(" ").map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
            return (
              <div key={n.id} className="bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 shrink-0 rounded-full bg-muted overflow-hidden flex items-center justify-center text-sm font-semibold text-muted-foreground border border-border">
                    {n.player?.photo_url ? <img src={n.player.photo_url} alt={fullName} className="w-full h-full object-cover" /> : initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-heading font-semibold text-foreground truncate">{fullName}</div>
                        {[n.player?.sport, n.player?.position].filter(Boolean).join(" · ") && (
                          <div className="text-xs text-muted-foreground font-body capitalize truncate">{[n.player?.sport, n.player?.position].filter(Boolean).join(" · ")}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {[1, 2, 3, 4, 5].map(s => <Star key={s} className={`h-3.5 w-3.5 ${s <= n.personal_rating ? "text-primary fill-primary" : "text-muted-foreground/30"}`} />)}
                      </div>
                    </div>
                    {n.label && <div className="mt-2"><Badge variant="outline" className="text-xs">{n.label}</Badge></div>}
                    {(n.match_watched || n.match_date) && (
                      <div className="text-xs text-muted-foreground font-body mt-2">{n.match_watched}{n.match_watched && n.match_date ? " · " : ""}{n.match_date}</div>
                    )}
                    <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-border">
                      <span className="text-[11px] text-muted-foreground font-body">{ro ? "Actualizat" : "Updated"}: {new Date(n.updated_at).toLocaleDateString(ro ? "ro-RO" : "en-US")}</span>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => handleExportSinglePDF(n)} title="Export PDF"><Download className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingPlayer(n)}><Pencil className="h-3.5 w-3.5 mr-1" />{ro ? "Editează" : "Edit"}</Button>
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
          onOpenChange={v => { if (!v) { setEditingPlayer(null); fetchNotes(); } }}
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

/* ─── Reports tab ────────────────────────────────────────────────── */

function ReportsTab({ scoutUserId }: { scoutUserId: string }) {
  const { lang } = useLanguage();
  const ro = lang === "ro";
  const recLabel = ro ? REC_LABEL_RO : REC_LABEL_EN;

  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [search, setSearch] = useState("");
  const [filterRec, setFilterRec] = useState("all");
  const [sortBy, setSortBy] = useState("updated_desc");
  const [editingReport, setEditingReport] = useState<ReportRow | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("scout_player_reports").select("*").eq("scout_user_id", scoutUserId).order("updated_at", { ascending: false });
    if (!data?.length) { setReports([]); setLoading(false); return; }
    const { data: players } = await supabase.from("player_profiles")
      .select("user_id, first_name, last_name, photo_url, sport, position")
      .in("user_id", data.map((r: ReportRow) => r.player_user_id));
    const map = new Map((players || []).map((p: any) => [p.user_id, p]));
    setReports(data.map((r: ReportRow) => ({ ...r, player: map.get(r.player_user_id) || null })));
    setLoading(false);
  };

  useEffect(() => { fetchReports(); }, [scoutUserId]);

  const filtered = useMemo(() => {
    let list = reports.filter(r => {
      if (filterRec !== "all" && r.recommendation !== filterRec) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = `${r.player?.first_name || ""} ${r.player?.last_name || ""}`.toLowerCase();
        if (!name.includes(q) && !(r.conclusion_text || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
    if (sortBy === "rating_desc") list = [...list].sort((a, b) => (b.overall_rating || 0) - (a.overall_rating || 0));
    else if (sortBy === "name_asc") list = [...list].sort((a, b) =>
      `${a.player?.first_name} ${a.player?.last_name}`.localeCompare(`${b.player?.first_name} ${b.player?.last_name}`)
    );
    return list;
  }, [reports, search, filterRec, sortBy]);

  const handleExportPDF = (r: ReportRow) => {
    const fullName = `${r.player?.first_name || ""} ${r.player?.last_name || ""}`.trim() || "-";
    exportReportPDF({
      playerName:      fullName,
      position:        r.position        || "",
      currentClub:     r.current_club    || "",
      league:          r.league          || "",
      contractUntil:   r.contract_until  || "",
      salaryRange:     r.salary_range    || "",
      transferValue:   r.transfer_value  || "",
      agentName:       r.agent_name      || "",
      overallRating:   r.overall_rating  || 0,
      fitRating:       r.fit_rating      || 0,
      technicalRating: r.technical_rating || 0,
      technicalNotes:  r.technical_notes  || "",
      physicalRating:  r.physical_rating  || 0,
      physicalNotes:   r.physical_notes   || "",
      mentalRating:    r.mental_rating    || 0,
      mentalNotes:     r.mental_notes     || "",
      financialNotes:  r.financial_notes  || "",
      pros:            r.pros_list        || [],
      cons:            r.cons_list        || [],
      conclusionText:  r.conclusion_text  || "",
      recommendation:  r.recommendation,
    }, ro);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={ro ? "Caută după nume sau concluzie…" : "Search by name or summary…"} className="pl-9" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Select value={filterRec} onValueChange={setFilterRec}>
            <SelectTrigger><SelectValue placeholder={ro ? "Recomandare" : "Recommendation"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ro ? "Toate" : "All"}</SelectItem>
              <SelectItem value="buy">{recLabel.buy}</SelectItem>
              <SelectItem value="shortlist">{recLabel.shortlist}</SelectItem>
              <SelectItem value="follow">{recLabel.follow}</SelectItem>
              <SelectItem value="forget">{recLabel.forget}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="updated_desc">{ro ? "Cele mai recente" : "Most recent"}</SelectItem>
              <SelectItem value="rating_desc">{ro ? "Nota desc." : "Highest rating"}</SelectItem>
              <SelectItem value="name_asc">{ro ? "Nume A-Z" : "Name A-Z"}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="text-xs text-muted-foreground font-body">{filtered.length} {ro ? "rapoarte" : "reports"}</div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground font-body">
          {reports.length === 0
            ? (ro ? "Nu ai încă niciun raport. Deschide profilul unui jucător pentru a adăuga unul." : "No reports yet.")
            : (ro ? "Niciun rezultat pentru filtrele selectate." : "No results.")}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(r => {
            const fullName = `${r.player?.first_name || ""} ${r.player?.last_name || ""}`.trim() || (ro ? "Jucător" : "Player");
            const initials = fullName.split(" ").map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
            return (
              <div key={r.id} className="bg-card border border-border rounded-lg p-4 hover:border-primary/40 transition-colors">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 shrink-0 rounded-full bg-muted overflow-hidden flex items-center justify-center text-sm font-semibold text-muted-foreground border border-border">
                    {r.player?.photo_url ? <img src={r.player.photo_url} alt={fullName} className="w-full h-full object-cover" /> : initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-heading font-semibold text-foreground truncate">{fullName}</div>
                        {[r.player?.sport, r.player?.position].filter(Boolean).join(" · ") && (
                          <div className="text-xs text-muted-foreground font-body capitalize truncate">{[r.player?.sport, r.player?.position].filter(Boolean).join(" · ")}</div>
                        )}
                      </div>
                      {r.overall_rating && (
                        <span className="shrink-0 text-sm font-semibold text-yellow-400">{r.overall_rating}/10</span>
                      )}
                    </div>

                    <div className="mt-2 grid grid-cols-3 gap-x-4 gap-y-1">
                      {r.technical_rating && <div className="text-xs text-muted-foreground font-body">{ro ? "Tehnic" : "Tech"}: <span className="text-foreground">{r.technical_rating}/10</span></div>}
                      {r.physical_rating && <div className="text-xs text-muted-foreground font-body">{ro ? "Fizic" : "Phys"}: <span className="text-foreground">{r.physical_rating}/10</span></div>}
                      {r.mental_rating && <div className="text-xs text-muted-foreground font-body">{ro ? "Mental" : "Mental"}: <span className="text-foreground">{r.mental_rating}/10</span></div>}
                    </div>

                    {r.recommendation && (
                      <div className="mt-2">
                        <Badge variant="outline" className={`text-xs ${REC_COLOR[r.recommendation] || ""}`}>{recLabel[r.recommendation] || r.recommendation}</Badge>
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-border">
                      <span className="text-[11px] text-muted-foreground font-body">{ro ? "Actualizat" : "Updated"}: {new Date(r.updated_at).toLocaleDateString(ro ? "ro-RO" : "en-US")}</span>
                      <div className="flex gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => handleExportPDF(r)} title="Export PDF"><Download className="h-3.5 w-3.5" /></Button>
                        <Button size="sm" variant="outline" onClick={() => setEditingReport(r)}><Pencil className="h-3.5 w-3.5 mr-1" />{ro ? "Editează" : "Edit"}</Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingReport && (
        <ScoutPlayerReportDialog
          open={!!editingReport}
          onOpenChange={v => { if (!v) { setEditingReport(null); fetchReports(); } }}
          scoutUserId={scoutUserId}
          playerUserId={editingReport.player_user_id}
          playerName={`${editingReport.player?.first_name || ""} ${editingReport.player?.last_name || ""}`.trim()}
          playerPhotoUrl={editingReport.player?.photo_url || null}
        />
      )}
    </div>
  );
}
