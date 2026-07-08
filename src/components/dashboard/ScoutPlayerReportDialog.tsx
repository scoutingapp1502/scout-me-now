import React, { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Star, Plus, X, Download, Minus } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import jsPDF from "jspdf";

export type Block =
  | { type: 'text';   id: string; value: string }
  | { type: 'list';   id: string; items: string[] }
  | { type: 'rating'; id: string; value: number; label: string }
  | { type: 'image';  id: string; url: string; name: string };

export interface CustomSection {
  id: string;
  title: string;
  blocks: Block[];
}

function migrateSection(s: any): CustomSection {
  if (Array.isArray(s.blocks)) return s as CustomSection;
  return {
    id: s.id,
    title: s.title ?? "",
    blocks: s.notes ? [{ type: 'text', id: crypto.randomUUID(), value: s.notes }] : [],
  };
}

export interface ReportPDFData {
  playerName: string;
  position: string;
  currentClub: string;
  league: string;
  contractUntil: string;
  salaryRange: string;
  transferValue: string;
  agentName: string;
  overallRating: number;
  fitRating: number;
  technicalRating: number;
  technicalNotes: string;
  physicalRating: number;
  physicalNotes: string;
  mentalRating: number;
  mentalNotes: string;
  financialNotes: string;
  pros: string[];
  cons: string[];
  conclusionText: string;
  recommendation: string | null;
}

function nd(s: string | null | undefined): string {
  if (!s) return "";
  let result = "";
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    // ASCII – pass through unchanged
    if (code < 128) { result += s[i]; continue; }
    // Romanian specific char codes
    if (code === 0x0219 || code === 0x015F) { result += "s"; continue; } // ș ş
    if (code === 0x0218 || code === 0x015E) { result += "S"; continue; } // Ș Ş
    if (code === 0x021B || code === 0x0163) { result += "t"; continue; } // ț ţ
    if (code === 0x021A || code === 0x0162) { result += "T"; continue; } // Ț Ţ
    if (code === 0x0103) { result += "a"; continue; } // ă
    if (code === 0x0102) { result += "A"; continue; } // Ă
    if (code === 0x00E2) { result += "a"; continue; } // â
    if (code === 0x00C2) { result += "A"; continue; } // Â
    if (code === 0x00EE) { result += "i"; continue; } // î
    if (code === 0x00CE) { result += "I"; continue; } // Î
    // General fallback: NFD decompose, keep only ASCII chars
    const decomposed = s[i].normalize("NFD");
    for (let j = 0; j < decomposed.length; j++) {
      const dc = decomposed.charCodeAt(j);
      if (dc >= 0x0300 && dc <= 0x036F) continue; // skip combining diacritics
      if (dc < 128) result += decomposed[j];
    }
  }
  return result;
}

function buildReportDoc(d: ReportPDFData, ro: boolean): jsPDF {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const W = 210;
  const M = 14;
  const CW = W - M * 2;

  type RGB = [number, number, number];
  const BG: RGB      = [18,  18,  18];
  const PRI: RGB     = [180, 30,  30];
  const WHITE: RGB   = [255, 255, 255];
  const GR: RGB      = [150, 150, 150];
  const TXT: RGB     = [30,  30,  30];
  const GREEN: RGB   = [22,  163, 74];
  const RED_C: RGB   = [220, 38,  38];
  const YLW: RGB     = [202, 138, 4];
  const BLU: RGB     = [37,  99,  235];
  const ZINC: RGB    = [113, 113, 122];

  let y = 0;
  const today = new Date().toLocaleDateString(ro ? "ro-RO" : "en-GB");

  const checkPage = (need: number) => {
    if (y + need > 283) { doc.addPage(); y = 15; }
  };

  const secHeader = (label: string) => {
    checkPage(14);
    doc.setFillColor(...PRI);
    doc.rect(M, y - 2.5, 2.5, 2.5, "F");
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TXT);
    doc.text(label.toUpperCase(), M + 5, y);
    y += 3;
    doc.setDrawColor(...PRI);
    doc.setLineWidth(0.4);
    doc.line(M, y, M + CW, y);
    y += 5;
  };

  const para = (text: string, fs = 9, color: RGB = TXT) => {
    doc.setFontSize(fs);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text, CW) as string[];
    for (const ln of lines) {
      checkPage(5);
      doc.text(ln, M, y);
      y += fs * 0.42;
    }
    y += 1.5;
  };

  const ratingLine = (label: string, val: number) => {
    if (!val) return;
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TXT);
    const lw = doc.getTextWidth(label + ": ");
    doc.text(label + ": ", M, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...YLW);
    doc.text(`${val}/10`, M + lw, y);
    y += 5;
  };

  /* ── HEADER ── */
  const HDR = 56;
  doc.setFillColor(...BG);
  doc.rect(0, 0, W, HDR, "F");
  doc.setFillColor(...PRI);
  doc.rect(0, 0, W, 3, "F");

  doc.setTextColor(...WHITE);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text(nd(d.playerName), W / 2, 16, { align: "center" });

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GR);
  if (d.position) doc.text(nd(d.position), W / 2, 23, { align: "center" });

  if (d.overallRating > 0) {
    doc.setFontSize(7);
    doc.setTextColor(...GR);
    doc.text(ro ? "NOTA GENERALA" : "OVERALL RATING", W / 2 - 26, 31, { align: "center" });
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...YLW);
    doc.text(`${d.overallRating}/10`, W / 2 - 26, 38, { align: "center" });
  }
  if (d.fitRating > 0) {
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GR);
    doc.text(ro ? "POTRIVIRE" : "FIT RATING", W / 2 + 26, 31, { align: "center" });
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...YLW);
    doc.text(`${d.fitRating}/10`, W / 2 + 26, 38, { align: "center" });
  }

  const clubLines = [
    nd(d.currentClub),
    nd(d.league),
    d.contractUntil ? `Contract: ${nd(d.contractUntil)}` : "",
    d.salaryRange   ? `${ro ? "Salariu:" : "Salary:"}   ${nd(d.salaryRange)}` : "",
    d.transferValue ? `${ro ? "Valoare:" : "Value:"}    ${nd(d.transferValue)}` : "",
  ].filter(Boolean);
  let cy = 10;
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...GR);
  clubLines.forEach(ln => { doc.text(ln!, W - M, cy, { align: "right" }); cy += 4.2; });

  if (d.agentName) {
    doc.setFontSize(7.5);
    doc.setTextColor(...GR);
    doc.text(`Agent: ${nd(d.agentName)}`, M, HDR - 5);
  }
  doc.setFontSize(7);
  doc.setTextColor(...GR);
  doc.text(`${ro ? "Data raportului:" : "Report date:"} ${today}`, W - M, HDR - 5, { align: "right" });

  y = HDR + 8;

  /* ── SECTIONS ── */
  if (d.technicalRating > 0 || d.technicalNotes) {
    secHeader(ro ? "Tehnic + Tactic" : "Technical + Tactical");
    ratingLine(ro ? "Nota" : "Rating", d.technicalRating);
    if (d.technicalNotes) para(nd(d.technicalNotes));
    y += 2;
  }
  if (d.physicalRating > 0 || d.physicalNotes) {
    secHeader(ro ? "Fizic" : "Physical");
    ratingLine(ro ? "Nota" : "Rating", d.physicalRating);
    if (d.physicalNotes) para(nd(d.physicalNotes));
    y += 2;
  }
  if (d.mentalRating > 0 || d.mentalNotes) {
    secHeader("Mental & Socio-cultural");
    ratingLine(ro ? "Nota" : "Rating", d.mentalRating);
    if (d.mentalNotes) para(nd(d.mentalNotes));
    y += 2;
  }
  if (d.financialNotes) {
    secHeader(ro ? "Financiar" : "Financial");
    para(nd(d.financialNotes));
    y += 2;
  }

  /* ── CONCLUZIE ── */
  const hasConcl = d.pros.length > 0 || d.cons.length > 0 || d.conclusionText || d.recommendation;
  if (hasConcl) {
    secHeader(ro ? "Concluzie" : "Conclusion");
    const colW = (CW - 6) / 2;

    if (d.pros.length > 0 || d.cons.length > 0) {
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...GREEN);
      doc.text(ro ? "Avantaje:" : "Pros:", M, y);
      doc.setTextColor(...RED_C);
      doc.text(ro ? "Dezavantaje:" : "Cons:", M + colW + 6, y);
      y += 5;

      const startY = y;

      /* left column: pros */
      let leftY = y;
      d.pros.forEach(item => {
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...TXT);
        const lines = doc.splitTextToSize(`• ${nd(item)}`, colW) as string[];
        lines.forEach(ln => { doc.text(ln, M, leftY); leftY += 4; });
      });

      /* right column: cons */
      let rightY = startY;
      d.cons.forEach(item => {
        doc.setFontSize(8.5);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(...TXT);
        const lines = doc.splitTextToSize(`• ${nd(item)}`, colW) as string[];
        lines.forEach(ln => { doc.text(ln, M + colW + 6, rightY); rightY += 4; });
      });

      y = Math.max(leftY, rightY) + 4;
    }

    if (d.conclusionText) { checkPage(10); para(nd(d.conclusionText)); y += 1; }

    if (d.recommendation) {
      checkPage(18);
      const REC_MAP: Record<string, { ro: string; en: string; c: RGB }> = {
        buy:       { ro: "Cumpara",      en: "Buy",       c: GREEN },
        shortlist: { ro: "Lista scurta", en: "Shortlist",  c: YLW  },
        follow:    { ro: "Urmarire",     en: "Follow",     c: BLU  },
        forget:    { ro: "Renunta",      en: "Forget",     c: ZINC },
      };
      const rec = REC_MAP[d.recommendation];
      if (rec) {
        doc.setFontSize(9);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...TXT);
        doc.text(ro ? "Recomandare:" : "Recommendation:", M, y);
        y += 6;
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(...rec.c);
        doc.text(ro ? rec.ro : rec.en, M, y);
        y += 8;
      }
    }
  }

  /* ── FOOTER on every page ── */
  const total = (doc as any).internal.getNumberOfPages() as number;
  for (let p = 1; p <= total; p++) {
    doc.setPage(p);
    doc.setFontSize(7);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...GR);
    doc.text(
      `SportRise · ${ro ? "Raport generat" : "Report generated"} ${today} · ${p}/${total}`,
      W / 2, 292, { align: "center" }
    ); // footer uses only ASCII-safe chars, no nd() needed
  }

  return doc;
}

export function exportReportPDF(d: ReportPDFData, ro: boolean): void {
  const doc = buildReportDoc(d, ro);
  doc.save(`raport_${d.playerName.replace(/\s+/g, "_")}.pdf`);
}

export function getReportPDFBlob(d: ReportPDFData, ro: boolean): Blob {
  return buildReportDoc(d, ro).output("blob") as Blob;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scoutUserId: string;
  playerUserId: string;
  playerName: string;
  playerPhotoUrl?: string | null;
}

const RECOMMENDATIONS = [
  { key: "buy",       ro: "Cumpără",      en: "Buy" },
  { key: "shortlist", ro: "Listă scurtă", en: "Shortlist" },
  { key: "follow",    ro: "Urmărire",     en: "Follow" },
  { key: "forget",    ro: "Renunță",      en: "Forget" },
];

const REC_COLORS: Record<string, string> = {
  buy:       "bg-green-600  border-green-600  text-white",
  shortlist: "bg-yellow-500 border-yellow-500 text-white",
  follow:    "bg-blue-500   border-blue-500   text-white",
  forget:    "bg-zinc-500   border-zinc-500   text-white",
};

function ImageBlockContent({
  block, onUpdate, uploadFn, ro,
}: {
  block: Extract<Block, { type: 'image' }>;
  onUpdate: (b: Block) => void;
  uploadFn: (file: File) => Promise<string>;
  ro: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const url = await uploadFn(file);
      onUpdate({ ...block, url, name: file.name });
    } catch (err: any) {
      toast({ title: ro ? "Eroare upload" : "Upload error", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  if (block.url) {
    return (
      <div className="space-y-2">
        <img src={block.url} alt={block.name} className="max-w-full rounded-lg border border-border object-cover" style={{ maxHeight: 300 }} />
        <button type="button" onClick={() => onUpdate({ ...block, url: "", name: "" })}
          className="text-xs text-muted-foreground hover:text-foreground underline">
          {ro ? "Schimbă imaginea" : "Change image"}
        </button>
      </div>
    );
  }

  return (
    <label className="flex flex-col items-center justify-center border-2 border-dashed border-border rounded-lg p-6 cursor-pointer hover:border-primary transition-colors">
      {uploading
        ? <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        : <Plus className="h-6 w-6 text-muted-foreground" />}
      <span className="text-sm text-muted-foreground mt-2">
        {uploading ? (ro ? "Se încarcă..." : "Uploading...") : (ro ? "Alege o imagine" : "Choose an image")}
      </span>
      <input type="file" accept="image/*" onChange={handleFile} className="hidden" disabled={uploading} />
    </label>
  );
}

function AddBlockBar({ onAdd, ro }: { onAdd: (type: Block['type']) => void; ro: boolean }) {
  return (
    <div className="flex gap-1 flex-wrap pt-1">
      {([
        { type: 'text'   as const, label: ro ? '+ Notițe'  : '+ Notes'  },
        { type: 'list'   as const, label: ro ? '+ Listă'   : '+ List'   },
        { type: 'rating' as const, label: ro ? '+ Rating'  : '+ Rating' },
        { type: 'image'  as const, label: ro ? '+ Imagine' : '+ Image'  },
      ]).map(({ type, label }) => (
        <button key={type} type="button" onClick={() => onAdd(type)}
          className="text-xs px-2 py-1 rounded border border-border text-muted-foreground hover:border-primary hover:text-foreground transition-colors">
          {label}
        </button>
      ))}
    </div>
  );
}

function StarRating({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-0.5 flex-wrap">
      {[1,2,3,4,5,6,7,8,9,10].map((n) => (
        <button key={n} type="button"
          onClick={() => onChange(n)}
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          className="focus:outline-none">
          <Star className={`h-5 w-5 transition-colors ${n <= (hover || value) ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"}`} />
        </button>
      ))}
      {value > 0 && <span className="ml-2 text-sm text-muted-foreground self-center">{value}/10</span>}
    </div>
  );
}

function SectionTitle({ label, onRemove }: { label: string; onRemove?: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 bg-primary rotate-45 shrink-0" />
        <h3 className="font-display text-sm font-bold uppercase tracking-wider">{label}</h3>
      </div>
      {onRemove && (
        <button type="button" onClick={onRemove}
          className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded"
          title="Șterge secțiunea">
          <Minus className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function ListEditor({ items, onChange, placeholder, color }: {
  items: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  color?: string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    if (!draft.trim()) return;
    onChange([...items, draft.trim()]);
    setDraft("");
  };
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input value={draft} onChange={e => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={e => e.key === "Enter" && (e.preventDefault(), add())}
          className="flex-1 text-sm" />
        <Button type="button" size="sm" variant="outline" onClick={add} className="shrink-0">
          <Plus className="h-4 w-4" />
        </Button>
      </div>
      {items.length > 0 && (
        <ul className="space-y-1 pl-1">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm group">
              <span className={`mt-0.5 shrink-0 ${color ?? "text-primary"}`}>•</span>
              <span className="flex-1">{item}</span>
              <button type="button" onClick={() => remove(i)}
                className="opacity-0 group-hover:opacity-100 transition-opacity">
                <X className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ScoutPlayerReportDialog({ open, onOpenChange, scoutUserId, playerUserId, playerName }: Props) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const ro = lang === "ro";

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addingToProfile, setAddingToProfile] = useState(false);

  // Informații jucător
  const [position, setPosition] = useState("");
  const [currentClub, setCurrentClub] = useState("");
  const [league, setLeague] = useState("");
  const [contractUntil, setContractUntil] = useState("");
  const [salaryRange, setSalaryRange] = useState("");
  const [transferValue, setTransferValue] = useState("");
  const [agentName, setAgentName] = useState("");

  // Evaluare
  const [overallRating, setOverallRating] = useState(0);
  const [fitRating, setFitRating] = useState(0);

  // Tehnic + Tactic
  const [technicalRating, setTechnicalRating] = useState(0);
  const [technicalNotes, setTechnicalNotes] = useState("");

  // Fizic
  const [physicalRating, setPhysicalRating] = useState(0);
  const [physicalNotes, setPhysicalNotes] = useState("");

  // Mental & Socio-cultural
  const [mentalRating, setMentalRating] = useState(0);
  const [mentalNotes, setMentalNotes] = useState("");

  // Financiar
  const [financialNotes, setFinancialNotes] = useState("");

  // Concluzie
  const [pros, setPros] = useState<string[]>([]);
  const [cons, setCons] = useState<string[]>([]);
  const [conclusionText, setConclusionText] = useState("");
  const [recommendation, setRecommendation] = useState<string | null>(null);

  // Secțiuni dinamice
  const [hiddenSections, setHiddenSections] = useState<Set<string>>(new Set());
  const [customSections, setCustomSections] = useState<CustomSection[]>([]);

  const [confirmDelete, setConfirmDelete] = useState<{ type: 'builtin'; key: string } | { type: 'custom'; id: string } | null>(null);

  const hideSection = (key: string) => setHiddenSections(prev => new Set([...prev, key]));
  const requestDeleteBuiltin = (key: string) => setConfirmDelete({ type: 'builtin', key });
  const requestDeleteCustom = (id: string) => setConfirmDelete({ type: 'custom', id });
  const confirmDeleteSection = () => {
    if (!confirmDelete) return;
    if (confirmDelete.type === 'builtin') hideSection(confirmDelete.key);
    else setCustomSections(prev => prev.filter(s => s.id !== confirmDelete.id));
    setConfirmDelete(null);
  };

  const uploadSectionImage = async (file: File): Promise<string> => {
    const path = `${scoutUserId}/section-images/${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
    const { error } = await supabase.storage.from("scout-reports").upload(path, file, { upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("scout-reports").getPublicUrl(path);
    return data.publicUrl;
  };

  const addBlock = (sectionId: string, type: Block['type']) => {
    const newBlock: Block =
      type === 'text'   ? { type, id: crypto.randomUUID(), value: "" } :
      type === 'list'   ? { type, id: crypto.randomUUID(), items: [] } :
      type === 'rating' ? { type, id: crypto.randomUUID(), value: 0, label: "" } :
                          { type, id: crypto.randomUUID(), url: "", name: "" };
    setCustomSections(prev => prev.map(s => s.id === sectionId ? { ...s, blocks: [...s.blocks, newBlock] } : s));
  };

  const updateBlock = (sectionId: string, block: Block) =>
    setCustomSections(prev => prev.map(s => s.id === sectionId
      ? { ...s, blocks: s.blocks.map(b => b.id === block.id ? block : b) } : s));

  const removeBlock = (sectionId: string, blockId: string) =>
    setCustomSections(prev => prev.map(s => s.id === sectionId
      ? { ...s, blocks: s.blocks.filter(b => b.id !== blockId) } : s));

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      const { data } = await (supabase as any)
        .from("scout_player_reports")
        .select("*")
        .eq("scout_user_id", scoutUserId)
        .eq("player_user_id", playerUserId)
        .maybeSingle();
      if (data) {
        setPosition(data.position || "");
        setCurrentClub(data.current_club || "");
        setLeague(data.league || "");
        setContractUntil(data.contract_until || "");
        setSalaryRange(data.salary_range || "");
        setTransferValue(data.transfer_value || "");
        setAgentName(data.agent_name || "");
        setOverallRating(data.overall_rating || 0);
        setFitRating(data.fit_rating || 0);
        setTechnicalRating(data.technical_rating || 0);
        setTechnicalNotes(data.technical_notes || "");
        setPhysicalRating(data.physical_rating || 0);
        setPhysicalNotes(data.physical_notes || "");
        setMentalRating(data.mental_rating || 0);
        setMentalNotes(data.mental_notes || "");
        setFinancialNotes(data.financial_notes || "");
        setPros(data.pros_list || []);
        setCons(data.cons_list || []);
        setConclusionText(data.conclusion_text || "");
        setRecommendation(data.recommendation || null);
        setHiddenSections(new Set(data.hidden_sections || []));
        setCustomSections((data.custom_sections || []).map(migrateSection));
      } else {
        const { data: playerProfile } = await supabase
          .from("player_profiles")
          .select("position, current_team, agent_name")
          .eq("user_id", playerUserId)
          .maybeSingle();
        setPosition(playerProfile?.position || "");
        setCurrentClub(playerProfile?.current_team || "");
        setAgentName(playerProfile?.agent_name || "");
        setLeague(""); setContractUntil("");
        setSalaryRange(""); setTransferValue(""); setAgentName("");
        setOverallRating(0); setFitRating(0);
        setTechnicalRating(0); setTechnicalNotes("");
        setPhysicalRating(0); setPhysicalNotes("");
        setMentalRating(0); setMentalNotes("");
        setFinancialNotes("");
        setPros([]); setCons([]); setConclusionText(""); setRecommendation(null);
        setHiddenSections(new Set()); setCustomSections([]);
      }
      setLoading(false);
    })();
  }, [open, scoutUserId, playerUserId]);

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      scout_user_id: scoutUserId,
      player_user_id: playerUserId,
      position: position.trim() || null,
      current_club: currentClub.trim() || null,
      league: league.trim() || null,
      contract_until: contractUntil.trim() || null,
      salary_range: salaryRange.trim() || null,
      transfer_value: transferValue.trim() || null,
      agent_name: agentName.trim() || null,
      overall_rating: overallRating || null,
      fit_rating: fitRating || null,
      technical_rating: technicalRating || null,
      technical_notes: technicalNotes.trim() || null,
      physical_rating: physicalRating || null,
      physical_notes: physicalNotes.trim() || null,
      mental_rating: mentalRating || null,
      mental_notes: mentalNotes.trim() || null,
      financial_notes: financialNotes.trim() || null,
      pros_list: pros.length > 0 ? pros : null,
      cons_list: cons.length > 0 ? cons : null,
      conclusion_text: conclusionText.trim() || null,
      recommendation: recommendation || null,
      hidden_sections: [...hiddenSections],
      custom_sections: customSections,
      updated_at: new Date().toISOString(),
    };
    const { error } = await (supabase as any)
      .from("scout_player_reports")
      .upsert(payload, { onConflict: "scout_user_id,player_user_id" });
    setSaving(false);
    if (error) {
      toast({ title: ro ? "Eroare la salvare" : "Save error", variant: "destructive" });
    } else {
      toast({ title: ro ? "Raport salvat!" : "Report saved!" });
      onOpenChange(false);
    }
  };

  const handleAddToProfile = async () => {
    setAddingToProfile(true);
    try {
      const pdfData: ReportPDFData = {
        playerName, position, currentClub, league, contractUntil, salaryRange,
        transferValue, agentName, overallRating, fitRating,
        technicalRating, technicalNotes, physicalRating, physicalNotes,
        mentalRating, mentalNotes, financialNotes, pros, cons, conclusionText, recommendation,
      };
      const blob = getReportPDFBlob(pdfData, ro);
      const fileName = `raport_${playerName.replace(/\s+/g, "_")}_${Date.now()}.pdf`;
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
          title: ro ? `Raport — ${playerName}` : `Report — ${playerName}`,
          file_url: urlData.publicUrl,
          file_name: fileName,
        });
      if (dbError) throw dbError;
      toast({ title: ro ? "Raport adăugat în profilul tău!" : "Report added to your profile!" });
    } catch (err: any) {
      toast({ title: ro ? "Eroare" : "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingToProfile(false);
    }
  };

  const handleConfirmDeleteOpenChange = (isOpen: boolean) => {
    if (!isOpen) setConfirmDelete(null);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              {ro ? "Raport jucător" : "Player report"} — {playerName}
            </DialogTitle>
          </DialogHeader>

          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-5 mt-2">

              {/* ── INFORMAȚII JUCĂTOR ── */}
              {!hiddenSections.has("playerInfo") && <div className="space-y-3">
                <SectionTitle label={ro ? "Informații jucător" : "Player info"} onRemove={() => requestDeleteBuiltin("playerInfo")} />
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                      {ro ? "Poziție" : "Position"}
                      {position && <span className="text-primary text-[10px] font-normal">{ro ? "· din profil" : "· from profile"}</span>}
                    </Label>
                    <div className="relative">
                      <Input value={position} onChange={e => setPosition(e.target.value)}
                        placeholder={ro ? "ex: Mijlocaș defensiv" : "e.g. Defensive midfielder"}
                        className={position ? "pr-7" : ""} />
                      {position && (
                        <button type="button" onClick={() => setPosition("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                      {ro ? "Club actual" : "Current club"}
                      {currentClub && <span className="text-primary text-[10px] font-normal">{ro ? "· din profil" : "· from profile"}</span>}
                    </Label>
                    <div className="relative">
                      <Input value={currentClub} onChange={e => setCurrentClub(e.target.value)}
                        placeholder="Fortuna Sittard"
                        className={currentClub ? "pr-7" : ""} />
                      {currentClub && (
                        <button type="button" onClick={() => setCurrentClub("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{ro ? "Ligă" : "League"}</Label>
                    <Input value={league} onChange={e => setLeague(e.target.value)}
                      placeholder="Eredivisie (NED1)" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{ro ? "Contract până în" : "Contract until"}</Label>
                    <Input value={contractUntil} onChange={e => setContractUntil(e.target.value)}
                      placeholder="2025" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{ro ? "Salariu (lunar)" : "Salary (monthly)"}</Label>
                    <Input value={salaryRange} onChange={e => setSalaryRange(e.target.value)}
                      placeholder="20.000 – 30.000 €" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{ro ? "Valoare transfer" : "Transfer value"}</Label>
                    <Input value={transferValue} onChange={e => setTransferValue(e.target.value)}
                      placeholder="0.4 – 0.8M €" />
                  </div>
                  <div className="col-span-2 space-y-1">
                    <Label className="text-xs text-muted-foreground flex items-center gap-1.5">
                      {ro ? "Agent" : "Agent"}
                      {agentName && <span className="text-primary text-[10px] font-normal">{ro ? "· din profil" : "· from profile"}</span>}
                    </Label>
                    <div className="relative">
                      <Input value={agentName} onChange={e => setAgentName(e.target.value)}
                        placeholder={ro ? "Numele agentului" : "Agent name"}
                        className={agentName ? "pr-7" : ""} />
                      {agentName && (
                        <button type="button" onClick={() => setAgentName("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>}

              {/* ── EVALUARE ── */}
              {!hiddenSections.has("evaluare") && <>
                <Separator />
                <div className="space-y-3">
                  <SectionTitle label={ro ? "Evaluare" : "Rating"} onRemove={() => requestDeleteBuiltin("evaluare")} />
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        {ro ? "Notă generală (calitate jucător)" : "Overall rating (player quality)"}
                      </Label>
                      <StarRating value={overallRating} onChange={setOverallRating} />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">
                        {ro ? "Potrivire cu cerințele echipei" : "Fit for team requirements"}
                      </Label>
                      <StarRating value={fitRating} onChange={setFitRating} />
                    </div>
                  </div>
                </div>
              </>}

              {/* ── TEHNIC + TACTIC ── */}
              {!hiddenSections.has("tehnic") && <>
                <Separator />
                <div className="space-y-3">
                  <SectionTitle label={ro ? "Tehnic + Tactic" : "Technical + Tactical"} onRemove={() => requestDeleteBuiltin("tehnic")} />
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{ro ? "Notă tehnică" : "Technical rating"}</Label>
                      <StarRating value={technicalRating} onChange={setTechnicalRating} />
                    </div>
                    <Textarea value={technicalNotes} onChange={e => setTechnicalNotes(e.target.value)}
                      placeholder={ro
                        ? "Calități tehnice, tactice, faze fixe, tranziții, comportament fără minge..."
                        : "Technical/tactical qualities, set pieces, transitions, off-ball behavior..."}
                      rows={4} />
                  </div>
                </div>
              </>}

              {/* ── FIZIC ── */}
              {!hiddenSections.has("fizic") && <>
                <Separator />
                <div className="space-y-3">
                  <SectionTitle label={ro ? "Fizic" : "Physical"} onRemove={() => requestDeleteBuiltin("fizic")} />
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{ro ? "Notă fizică" : "Physical rating"}</Label>
                      <StarRating value={physicalRating} onChange={setPhysicalRating} />
                    </div>
                    <Textarea value={physicalNotes} onChange={e => setPhysicalNotes(e.target.value)}
                      placeholder={ro
                        ? "Viteză, forță, rezistență, agilitate, istoric accidentări..."
                        : "Speed, strength, stamina, agility, injury history..."}
                      rows={4} />
                  </div>
                </div>
              </>}

              {/* ── MENTAL & SOCIO-CULTURAL ── */}
              {!hiddenSections.has("mental") && <>
                <Separator />
                <div className="space-y-3">
                  <SectionTitle label="Mental & Socio-cultural" onRemove={() => requestDeleteBuiltin("mental")} />
                  <div className="space-y-2">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{ro ? "Notă mentală" : "Mental rating"}</Label>
                      <StarRating value={mentalRating} onChange={setMentalRating} />
                    </div>
                    <Textarea value={mentalNotes} onChange={e => setMentalNotes(e.target.value)}
                      placeholder={ro
                        ? "Atitudine, adaptabilitate, leadership, limbă, profil socio-cultural..."
                        : "Attitude, adaptability, leadership, language, socio-cultural profile..."}
                      rows={4} />
                  </div>
                </div>
              </>}

              {/* ── FINANCIAR ── */}
              {!hiddenSections.has("financiar") && <>
                <Separator />
                <div className="space-y-3">
                  <SectionTitle label={ro ? "Financiar" : "Financial"} onRemove={() => requestDeleteBuiltin("financiar")} />
                  <Textarea value={financialNotes} onChange={e => setFinancialNotes(e.target.value)}
                    placeholder={ro
                      ? "Situație contractuală, negociabilitate, interes din alte cluburi, potențial de revânzare..."
                      : "Contract situation, negotiability, interest from other clubs, resell potential..."}
                    rows={3} />
                </div>
              </>}

              {/* ── CONCLUZIE ── */}
              {!hiddenSections.has("concluzie") && <>
                <Separator />
                <div className="space-y-4">
                  <SectionTitle label={ro ? "Concluzie" : "Conclusion"} onRemove={() => requestDeleteBuiltin("concluzie")} />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-green-500">
                        {ro ? "Avantaje" : "Pros"}
                      </Label>
                      <ListEditor items={pros} onChange={setPros}
                        placeholder={ro ? "Adaugă un avantaj..." : "Add a pro..."}
                        color="text-green-500" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold text-red-500">
                        {ro ? "Dezavantaje" : "Cons"}
                      </Label>
                      <ListEditor items={cons} onChange={setCons}
                        placeholder={ro ? "Adaugă un dezavantaj..." : "Add a con..."}
                        color="text-red-500" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">
                      {ro ? "Text concluzie" : "Conclusion text"}
                    </Label>
                    <Textarea value={conclusionText} onChange={e => setConclusionText(e.target.value)}
                      placeholder={ro
                        ? "Concluzia finală privind jucătorul, context, recomandare motivată..."
                        : "Final conclusion about the player, context, motivated recommendation..."}
                      rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase tracking-wider">
                      {ro ? "Recomandare finală" : "Final recommendation"}
                    </Label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {RECOMMENDATIONS.map(r => (
                        <button key={r.key} type="button"
                          onClick={() => setRecommendation(recommendation === r.key ? null : r.key)}
                          className={`py-2 px-3 rounded-lg border text-sm font-semibold transition-all ${
                            recommendation === r.key
                              ? REC_COLORS[r.key]
                              : "border-border text-muted-foreground hover:border-primary hover:text-foreground"
                          }`}>
                          {ro ? r.ro : r.en}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </>}

              {/* ── SECȚIUNI PERSONALIZATE ── */}
              {customSections.map((section) => (
                <div key={section.id}>
                  <Separator />
                  <div className="space-y-3 mt-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-2 h-2 bg-primary rotate-45 shrink-0" />
                        <input
                          value={section.title}
                          onChange={e => setCustomSections(prev => prev.map(s => s.id === section.id ? { ...s, title: e.target.value } : s))}
                          placeholder={ro ? "Titlu secțiune..." : "Section title..."}
                          className="font-display text-sm font-bold uppercase tracking-wider bg-transparent border-none outline-none w-full placeholder:normal-case placeholder:font-normal placeholder:tracking-normal"
                        />
                      </div>
                      <button type="button"
                        onClick={() => requestDeleteCustom(section.id)}
                        className="text-muted-foreground hover:text-destructive transition-colors p-1 rounded ml-2 shrink-0"
                        title={ro ? "Șterge secțiunea" : "Remove section"}>
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {section.blocks.map((block) => (
                      <div key={block.id} className="relative group/block pl-2 border-l-2 border-border">
                        <button type="button"
                          onClick={() => removeBlock(section.id, block.id)}
                          className="absolute -right-1 top-0 opacity-0 group-hover/block:opacity-100 transition-opacity text-muted-foreground hover:text-destructive p-0.5 z-10"
                          title={ro ? "Șterge blocul" : "Remove block"}>
                          <X className="h-3.5 w-3.5" />
                        </button>
                        {block.type === 'text' && (
                          <Textarea value={block.value}
                            onChange={e => updateBlock(section.id, { ...block, value: e.target.value })}
                            placeholder={ro ? "Notițe..." : "Notes..."} rows={3} />
                        )}
                        {block.type === 'list' && (
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">{ro ? "Listă" : "List"}</Label>
                            <ListEditor items={block.items}
                              onChange={items => updateBlock(section.id, { ...block, items })}
                              placeholder={ro ? "Adaugă element..." : "Add item..."} />
                          </div>
                        )}
                        {block.type === 'rating' && (
                          <div className="space-y-1">
                            <input value={block.label}
                              onChange={e => updateBlock(section.id, { ...block, label: e.target.value })}
                              placeholder={ro ? "Etichetă rating..." : "Rating label..."}
                              className="text-xs text-muted-foreground bg-transparent border-none outline-none w-full mb-1" />
                            <StarRating value={block.value}
                              onChange={v => updateBlock(section.id, { ...block, value: v })} />
                          </div>
                        )}
                        {block.type === 'image' && (
                          <ImageBlockContent block={block}
                            onUpdate={b => updateBlock(section.id, b)}
                            uploadFn={uploadSectionImage} ro={ro} />
                        )}
                      </div>
                    ))}
                    <AddBlockBar onAdd={type => addBlock(section.id, type)} ro={ro} />
                  </div>
                </div>
              ))}

              {/* ── BUTON ADAUGĂ SECȚIUNE ── */}
              <div className="flex justify-center pt-1">
                <Button type="button" variant="outline" size="sm"
                  onClick={() => setCustomSections(prev => [...prev, { id: crypto.randomUUID(), title: "", blocks: [] }])}
                  className="gap-2 text-muted-foreground hover:text-foreground">
                  <Plus className="h-4 w-4" />
                  {ro ? "Adaugă secțiune" : "Add section"}
                </Button>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2 flex-wrap">
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" onClick={() => exportReportPDF({
                    playerName, position, currentClub, league, contractUntil, salaryRange, transferValue, agentName,
                    overallRating, fitRating, technicalRating, technicalNotes,
                    physicalRating, physicalNotes, mentalRating, mentalNotes,
                    financialNotes, pros, cons, conclusionText, recommendation,
                  }, ro)}>
                    <Download className="h-4 w-4 mr-2" />
                    {ro ? "Exportă PDF" : "Export PDF"}
                  </Button>
                  <Button variant="outline" onClick={handleAddToProfile} disabled={addingToProfile}>
                    {addingToProfile
                      ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      : <Download className="h-4 w-4 mr-2" />}
                    {ro ? "Adaugă în profilul meu" : "Add to my profile"}
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                    {ro ? "Anulează" : "Cancel"}
                  </Button>
                  <Button onClick={handleSave} disabled={saving}>
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    {ro ? "Salvează raportul" : "Save report"}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={handleConfirmDeleteOpenChange}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ro ? "Ești sigur?" : "Are you sure?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {ro
                ? "Această secțiune va fi ștearsă. Acțiunea va fi salvată doar după ce apeși „Salvează raportul"
                : "This section will be removed. The change is saved only when you press \"Save report\"."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ro ? "Anulează" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSection} className="bg-destructive hover:bg-destructive/90 text-white">
              {ro ? "Șterge secțiunea" : "Remove section"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}