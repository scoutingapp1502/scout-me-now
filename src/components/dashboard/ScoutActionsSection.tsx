import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Search, Star, Pencil, StickyNote, Download, Upload, Check, FileBarChart, ClipboardList, ChevronDown, X } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useLanguage } from "@/i18n/LanguageContext";
import ScoutPlayerNoteDialog from "./ScoutPlayerNoteDialog";
import ScoutPlayerReportDialog, { exportReportPDF, getReportPDFBlob } from "./ScoutPlayerReportDialog";
import { useAccountLock } from "@/hooks/useAccountLock";
import { useToast } from "@/hooks/use-toast";

interface Props {
  scoutUserId: string;
  userRole?: string | null;
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

/* ─── Multi-select filter (Popover + checkboxes) ─────────────────── */

function MultiSelectFilter({ label, options, selected, onChange }: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (value: string) => {
    onChange(selected.includes(value) ? selected.filter(v => v !== value) : [...selected, value]);
  };
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="w-full justify-between font-normal text-sm font-body h-10 px-3">
          <span className="truncate">{selected.length > 0 ? `${label} (${selected.length})` : label}</span>
          <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2 max-h-64 overflow-y-auto" align="start">
        {options.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-2">—</p>
        ) : (
          <div className="space-y-0.5">
            {options.map(opt => (
              <label key={opt.value} className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-colors text-sm font-body hover:bg-muted">
                <Checkbox checked={selected.includes(opt.value)} onCheckedChange={() => toggle(opt.value)} />
                <span className="truncate">{opt.label}</span>
              </label>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

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

export default function ScoutActionsSection({ scoutUserId, userRole }: Props) {
  const { lang } = useLanguage();
  const ro = lang === "ro";
  const [tab, setTab] = useState<"notes" | "reports">("notes");
  const { isLocked } = useAccountLock(scoutUserId, userRole);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-display text-foreground flex items-center gap-3">
          <ClipboardList className="h-8 w-8 text-primary" />
          {ro ? "Acțiuni" : "Actions"}
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

      {tab === "notes" && <NotesTab scoutUserId={scoutUserId} isLocked={isLocked} />}
      {tab === "reports" && <ReportsTab scoutUserId={scoutUserId} isLocked={isLocked} />}
    </div>
  );
}

/* ─── Notes tab ──────────────────────────────────────────────────── */

function NotesTab({ scoutUserId, isLocked }: { scoutUserId: string; isLocked: boolean }) {
  const { lang } = useLanguage();
  const ro = lang === "ro";
  const priorityLabel = ro ? PRIORITY_LABEL_RO : PRIORITY_LABEL_EN;

  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [search, setSearch] = useState("");
  const [filterLabels, setFilterLabels] = useState<string[]>([]);
  const [filterPriorities, setFilterPriorities] = useState<string[]>([]);
  const [filterRatings, setFilterRatings] = useState<string[]>([]);
  const [filterQualities, setFilterQualities] = useState<string[]>([]);
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

  const allQualities = useMemo(() => {
    const s = new Set<string>();
    notes.forEach(n => {
      (n.observed_qualities || []).forEach(q => s.add(q));
      (n.custom_qualities || []).forEach(q => s.add(q));
    });
    return Array.from(s).sort();
  }, [notes]);

  const filtered = useMemo(() => {
    return notes.filter(n => {
      if (filterLabels.length > 0 && !(n.label && filterLabels.includes(n.label))) return false;
      if (filterPriorities.length > 0 && !(n.priority && filterPriorities.includes(n.priority))) return false;
      if (filterRatings.length > 0 && !filterRatings.includes(String(n.personal_rating))) return false;
      if (filterQualities.length > 0) {
        const noteQualities = [...(n.observed_qualities || []), ...(n.custom_qualities || [])];
        if (!filterQualities.some(q => noteQualities.includes(q))) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = `${n.player?.first_name || ""} ${n.player?.last_name || ""}`.toLowerCase();
        if (!name.includes(q) && !(n.observations || "").toLowerCase().includes(q) && !(n.match_watched || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [notes, search, filterLabels, filterPriorities, filterRatings, filterQualities]);

  const activeFilterCount = filterLabels.length + filterPriorities.length + filterRatings.length + filterQualities.length;
  const clearFilters = () => {
    setFilterLabels([]);
    setFilterPriorities([]);
    setFilterRatings([]);
    setFilterQualities([]);
  };

  const d = (s: string) => {
    const map: Record<number, string> = {
      0x103:'a', 0x102:'A', 0xe2:'a', 0xc2:'A',
      0xee:'i',  0xce:'I',
      0x219:'s', 0x218:'S', 0x15f:'s', 0x15e:'S',
      0x21b:'t', 0x21a:'T', 0x163:'t', 0x162:'T',
    };
    return s.split('').map(c => map[c.charCodeAt(0)] ?? c).join('');
  };

  const handleExportSinglePDF = (n: NoteRow) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const fullName = d(`${n.player?.first_name || ""} ${n.player?.last_name || ""}`.trim() || "-");
    doc.setFontSize(18); doc.text(ro ? "Notita jucator" : "Player note", 14, 18);
    doc.setFontSize(13); doc.setTextColor(60); doc.text(fullName, 14, 28);
    doc.setFontSize(10); doc.setTextColor(120);
    doc.text(`${ro ? "Actualizat" : "Updated"}: ${new Date(n.updated_at).toLocaleString(ro ? "ro-RO" : "en-US")}`, pageWidth - 14, 18, { align: "right" });
    const uniqueQualities = [...new Set([...(n.observed_qualities || []), ...(n.custom_qualities || [])])];
    const qualities = d(uniqueQualities.join("\n") || "-");
    autoTable(doc, {
      startY: 42, theme: "grid", styles: { fontSize: 10, cellPadding: 3, overflow: "linebreak" },
      columnStyles: { 0: { cellWidth: 45, fontStyle: "bold", fillColor: [240, 245, 240] }, 1: { cellWidth: "auto" } },
      body: [
        [ro ? "Eticheta" : "Label", d(n.label || "-")],
        ["Rating", n.personal_rating ? `${n.personal_rating}/5` : "-"],
        [ro ? "Prioritate" : "Priority", d(n.priority ? (priorityLabel[n.priority] || n.priority) : "-")],
        [ro ? "Calitati" : "Qualities", qualities],
        [ro ? "Meci vizionat" : "Match watched", d(n.match_watched || "-")],
        [ro ? "Data vizionarii" : "Date watched", d(n.match_date || "-")],
        [ro ? "Observatii" : "Observations", d(n.observations || "-")],
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
          <MultiSelectFilter
            label={ro ? "Toate etichetele" : "All labels"}
            options={allLabels.map(l => ({ value: l, label: l }))}
            selected={filterLabels}
            onChange={setFilterLabels}
          />
          <MultiSelectFilter
            label={ro ? "Prioritate urmărire" : "Follow-up priority"}
            options={[
              { value: "high", label: priorityLabel.high },
              { value: "medium", label: priorityLabel.medium },
              { value: "low", label: priorityLabel.low },
            ]}
            selected={filterPriorities}
            onChange={setFilterPriorities}
          />
          <MultiSelectFilter
            label={ro ? "Rating personal" : "Personal rating"}
            options={[1, 2, 3, 4, 5].map(n => ({ value: String(n), label: `${"★".repeat(n)}` }))}
            selected={filterRatings}
            onChange={setFilterRatings}
          />
          <MultiSelectFilter
            label={ro ? "Calități observate" : "Observed qualities"}
            options={allQualities.map(q => ({ value: q, label: q }))}
            selected={filterQualities}
            onChange={setFilterQualities}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground font-body">{filtered.length} {ro ? "notițe" : "notes"}</div>
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-body transition-colors"
            >
              <X className="h-3 w-3" />
              {ro ? "Șterge filtrele" : "Clear filters"}
            </button>
          )}
        </div>
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
                        <Button size="sm" variant="outline" disabled={isLocked} onClick={() => setEditingPlayer(n)}><Pencil className="h-3.5 w-3.5 mr-1" />{ro ? "Editează" : "Edit"}</Button>
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

function ReportsTab({ scoutUserId, isLocked }: { scoutUserId: string; isLocked: boolean }) {
  const { lang } = useLanguage();
  const ro = lang === "ro";
  const recLabel = ro ? REC_LABEL_RO : REC_LABEL_EN;
  const ratingOptions = useMemo(() => Array.from({ length: 10 }, (_, i) => { const n = i + 1; return { value: String(n), label: `${n}/10` }; }), []);
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [search, setSearch] = useState("");
  const [addingToProfileId, setAddingToProfileId] = useState<string | null>(null);
  const [uploadedReportIds, setUploadedReportIds] = useState<Set<string>>(new Set());
  const [filterRec, setFilterRec] = useState<string[]>([]);
  const [filterFit, setFilterFit] = useState<string[]>([]);
  const [filterTechnical, setFilterTechnical] = useState<string[]>([]);
  const [filterPhysical, setFilterPhysical] = useState<string[]>([]);
  const [filterMental, setFilterMental] = useState<string[]>([]);
  const [editingReport, setEditingReport] = useState<ReportRow | null>(null);

  const fetchReports = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("scout_player_reports").select("*").eq("scout_user_id", scoutUserId).order("updated_at", { ascending: false });
    if (!data?.length) { setReports([]); setUploadedReportIds(new Set()); setLoading(false); return; }
    const { data: players } = await supabase.from("player_profiles")
      .select("user_id, first_name, last_name, photo_url, sport, position")
      .in("user_id", data.map((r: ReportRow) => r.player_user_id));
    const map = new Map((players || []).map((p: any) => [p.user_id, p]));
    setReports(data.map((r: ReportRow) => ({ ...r, player: map.get(r.player_user_id) || null })));

    const { data: uploaded } = await (supabase as any)
      .from("scout_uploaded_reports")
      .select("source_report_id")
      .eq("scout_user_id", scoutUserId)
      .in("source_report_id", data.map((r: ReportRow) => r.id));
    setUploadedReportIds(new Set((uploaded || []).map((u: any) => u.source_report_id)));
    setLoading(false);
  };

  useEffect(() => { fetchReports(); }, [scoutUserId]);

  const filtered = useMemo(() => {
    return reports.filter(r => {
      if (filterRec.length > 0 && !(r.recommendation && filterRec.includes(r.recommendation))) return false;
      if (filterFit.length > 0 && !filterFit.includes(String(r.fit_rating))) return false;
      if (filterTechnical.length > 0 && !filterTechnical.includes(String(r.technical_rating))) return false;
      if (filterPhysical.length > 0 && !filterPhysical.includes(String(r.physical_rating))) return false;
      if (filterMental.length > 0 && !filterMental.includes(String(r.mental_rating))) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const name = `${r.player?.first_name || ""} ${r.player?.last_name || ""}`.toLowerCase();
        if (!name.includes(q) && !(r.conclusion_text || "").toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [reports, search, filterRec, filterFit, filterTechnical, filterPhysical, filterMental]);

  const activeFilterCount = filterRec.length + filterFit.length + filterTechnical.length + filterPhysical.length + filterMental.length;
  const clearFilters = () => {
    setFilterRec([]);
    setFilterFit([]);
    setFilterTechnical([]);
    setFilterPhysical([]);
    setFilterMental([]);
  };

  const reportPDFData = (r: ReportRow) => ({
    playerName:      `${r.player?.first_name || ""} ${r.player?.last_name || ""}`.trim() || "-",
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
  });

  const handleExportPDF = (r: ReportRow) => {
    exportReportPDF(reportPDFData(r), ro);
  };

  const handleAddToProfile = async (r: ReportRow) => {
    if (uploadedReportIds.has(r.id)) return;
    setAddingToProfileId(r.id);
    try {
      const pdfData = reportPDFData(r);
      const blob = getReportPDFBlob(pdfData, ro);
      const fileName = `raport_${pdfData.playerName.replace(/\s+/g, "_")}_${Date.now()}.pdf`;
      const path = `${scoutUserId}/${fileName}`;
      const { error: uploadError } = await supabase.storage
        .from("scout-reports")
        .upload(path, blob, { contentType: "application/pdf", upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from("scout-reports").getPublicUrl(path);
      const { error: dbError } = await (supabase as any)
        .from("scout_uploaded_reports")
        .insert({
          scout_user_id: scoutUserId,
          title: ro ? `Raport — ${pdfData.playerName}` : `Report — ${pdfData.playerName}`,
          file_url: urlData.publicUrl,
          file_name: fileName,
          source_report_id: r.id,
        });
      if (dbError) throw dbError;
      setUploadedReportIds(prev => new Set(prev).add(r.id));
      toast({ title: ro ? "Raport adăugat în profilul tău!" : "Report added to your profile!" });
    } catch (err: any) {
      toast({ title: ro ? "Eroare" : "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingToProfileId(null);
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="bg-card border border-border rounded-lg p-4 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder={ro ? "Caută după nume sau concluzie…" : "Search by name or summary…"} className="pl-9" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <MultiSelectFilter
            label={ro ? "Recomandare finală" : "Final recommendation"}
            options={[
              { value: "buy", label: recLabel.buy },
              { value: "shortlist", label: recLabel.shortlist },
              { value: "follow", label: recLabel.follow },
              { value: "forget", label: recLabel.forget },
            ]}
            selected={filterRec}
            onChange={setFilterRec}
          />
          <MultiSelectFilter
            label={ro ? "Potrivire cu cerințele echipei" : "Fit for team requirements"}
            options={ratingOptions}
            selected={filterFit}
            onChange={setFilterFit}
          />
          <MultiSelectFilter
            label={ro ? "Notă tehnică" : "Technical rating"}
            options={ratingOptions}
            selected={filterTechnical}
            onChange={setFilterTechnical}
          />
          <MultiSelectFilter
            label={ro ? "Notă fizică" : "Physical rating"}
            options={ratingOptions}
            selected={filterPhysical}
            onChange={setFilterPhysical}
          />
          <MultiSelectFilter
            label={ro ? "Notă mentală" : "Mental rating"}
            options={ratingOptions}
            selected={filterMental}
            onChange={setFilterMental}
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground font-body">{filtered.length} {ro ? "rapoarte" : "reports"}</div>
          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground font-body transition-colors"
            >
              <X className="h-3 w-3" />
              {ro ? "Șterge filtrele" : "Clear filters"}
            </button>
          )}
        </div>
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
                        <div className="shrink-0 text-right">
                          <div className="text-sm font-semibold text-yellow-400 leading-tight">{r.overall_rating}/10</div>
                          <div className="text-[10px] text-muted-foreground font-body leading-tight">{ro ? "Notă generală" : "Overall"}</div>
                        </div>
                      )}
                    </div>

                    <div className="mt-2.5 flex flex-wrap gap-1.5">
                      {[
                        { label: ro ? "Potrivire" : "Fit", value: r.fit_rating },
                        { label: ro ? "Tehnic" : "Technical", value: r.technical_rating },
                        { label: ro ? "Fizic" : "Physical", value: r.physical_rating },
                        { label: ro ? "Mental" : "Mental", value: r.mental_rating },
                      ].filter(stat => stat.value).map(stat => (
                        <div key={stat.label} className="flex-1 min-w-[4.5rem] rounded-md bg-muted/50 px-2 py-1.5 text-center">
                          <div className="text-[10px] leading-tight text-muted-foreground font-body truncate">{stat.label}</div>
                          <div className="text-sm font-semibold text-foreground font-body leading-tight">
                            {stat.value}<span className="text-[10px] font-normal text-muted-foreground">/10</span>
                          </div>
                        </div>
                      ))}
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
                        <Button
                          size="sm" variant="outline" disabled={addingToProfileId === r.id || uploadedReportIds.has(r.id)}
                          onClick={() => handleAddToProfile(r)}
                          title={uploadedReportIds.has(r.id) ? (ro ? "Deja adăugat în profil" : "Already added to profile") : (ro ? "Adaugă în profil" : "Add to profile")}
                        >
                          {addingToProfileId === r.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : uploadedReportIds.has(r.id) ? (
                            <Check className="h-3.5 w-3.5 text-primary" />
                          ) : (
                            <Upload className="h-3.5 w-3.5" />
                          )}
                        </Button>
                        <Button size="sm" variant="outline" disabled={isLocked} onClick={() => setEditingReport(r)}><Pencil className="h-3.5 w-3.5 mr-1" />{ro ? "Editează" : "Edit"}</Button>
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
