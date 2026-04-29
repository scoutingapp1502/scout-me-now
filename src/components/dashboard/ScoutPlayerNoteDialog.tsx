import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Star, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

interface ScoutPlayerNoteDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scoutUserId: string;
  playerUserId: string;
  playerName: string;
  playerSubtitle?: string;
  playerPhotoUrl?: string | null;
}

const DEFAULT_LABELS_RO = ["De urmărit", "Meci vizionat", "Contact inițiat", "Potențial transfer", "Nu se potrivește"];
const DEFAULT_LABELS_EN = ["To watch", "Match watched", "Initial contact", "Potential transfer", "Not a fit"];

const DEFAULT_QUALITIES_RO = ["Tehnică bună", "Viteză", "Viziune de joc", "Lider", "Rezistență fizică", "Precizie pasă", "Mentalitate"];
const DEFAULT_QUALITIES_EN = ["Good technique", "Speed", "Game vision", "Leader", "Physical endurance", "Pass accuracy", "Mentality"];

const PRIORITIES_RO = [
  { key: "low", label: "Scăzută" },
  { key: "medium", label: "Medie" },
  { key: "high", label: "Înaltă" },
];
const PRIORITIES_EN = [
  { key: "low", label: "Low" },
  { key: "medium", label: "Medium" },
  { key: "high", label: "High" },
];

export default function ScoutPlayerNoteDialog({
  open, onOpenChange, scoutUserId, playerUserId, playerName, playerSubtitle, playerPhotoUrl,
}: ScoutPlayerNoteDialogProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const ro = lang === "ro";

  const defaultLabels = ro ? DEFAULT_LABELS_RO : DEFAULT_LABELS_EN;
  const defaultQualities = ro ? DEFAULT_QUALITIES_RO : DEFAULT_QUALITIES_EN;
  const priorities = ro ? PRIORITIES_RO : PRIORITIES_EN;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const [label, setLabel] = useState<string | null>(null);
  const [rating, setRating] = useState(0);
  const [qualities, setQualities] = useState<string[]>([]);
  const [matchWatched, setMatchWatched] = useState("");
  const [matchDate, setMatchDate] = useState("");
  const [observations, setObservations] = useState("");
  const [priority, setPriority] = useState<string | null>(null);
  const [customLabels, setCustomLabels] = useState<string[]>([]);
  const [customQualities, setCustomQualities] = useState<string[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newQuality, setNewQuality] = useState("");
  const [showLabelInput, setShowLabelInput] = useState(false);
  const [showQualityInput, setShowQualityInput] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDirty(false);
    setLoading(true);
    (async () => {
      const { data } = await (supabase as any)
        .from("scout_player_notes")
        .select("*")
        .eq("scout_user_id", scoutUserId)
        .eq("player_user_id", playerUserId)
        .maybeSingle();
      if (data) {
        setLabel(data.label || null);
        setRating(data.personal_rating || 0);
        setQualities(data.observed_qualities || []);
        setMatchWatched(data.match_watched || "");
        setMatchDate(data.match_date || "");
        setObservations(data.observations || "");
        setPriority(data.priority || null);
        setCustomLabels(data.custom_labels || []);
        setCustomQualities(data.custom_qualities || []);
      } else {
        setLabel(null); setRating(0); setQualities([]); setMatchWatched(""); setMatchDate("");
        setObservations(""); setPriority(null); setCustomLabels([]); setCustomQualities([]);
      }
      setLoading(false);
    })();
  }, [open, scoutUserId, playerUserId]);

  const markDirty = () => setDirty(true);

  const toggleQuality = (q: string) => {
    setQualities(prev => prev.includes(q) ? prev.filter(x => x !== q) : [...prev, q]);
    markDirty();
  };

  const addCustomLabel = () => {
    const v = newLabel.trim();
    if (!v) { setShowLabelInput(false); return; }
    if ([...defaultLabels, ...customLabels].includes(v)) { setNewLabel(""); setShowLabelInput(false); return; }
    setCustomLabels(prev => [...prev, v]);
    setNewLabel("");
    setShowLabelInput(false);
    markDirty();
  };

  const removeCustomLabel = (v: string) => {
    setCustomLabels(prev => prev.filter(x => x !== v));
    if (label === v) setLabel(null);
    markDirty();
  };

  const addCustomQuality = () => {
    const v = newQuality.trim();
    if (!v) { setShowQualityInput(false); return; }
    if ([...defaultQualities, ...customQualities].includes(v)) { setNewQuality(""); setShowQualityInput(false); return; }
    setCustomQualities(prev => [...prev, v]);
    setNewQuality("");
    setShowQualityInput(false);
    markDirty();
  };

  const removeCustomQuality = (v: string) => {
    setCustomQualities(prev => prev.filter(x => x !== v));
    setQualities(prev => prev.filter(x => x !== v));
    markDirty();
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = {
      scout_user_id: scoutUserId,
      player_user_id: playerUserId,
      label,
      personal_rating: rating,
      observed_qualities: qualities,
      match_watched: matchWatched || null,
      match_date: matchDate || null,
      observations: observations || null,
      priority,
      custom_labels: customLabels,
      custom_qualities: customQualities,
    };
    const { error } = await (supabase as any)
      .from("scout_player_notes")
      .upsert(payload, { onConflict: "scout_user_id,player_user_id" });
    setSaving(false);
    if (error) {
      toast({ title: ro ? "Eroare" : "Error", description: error.message, variant: "destructive" });
      return;
    }
    setDirty(false);
    toast({ title: ro ? "Notiță salvată" : "Note saved" });
    onOpenChange(false);
  };

  const allLabels = [...defaultLabels, ...customLabels];
  const allQualities = [...defaultQualities, ...customQualities];

  const initials = playerName.split(" ").map(p => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="sr-only">{ro ? "Notiță jucător" : "Player note"}</DialogTitle>
          <div className="flex items-center justify-between gap-3 pr-8">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-muted overflow-hidden flex items-center justify-center text-sm font-semibold text-muted-foreground border border-border">
                {playerPhotoUrl ? <img src={playerPhotoUrl} alt={playerName} className="w-full h-full object-cover" /> : initials}
              </div>
              <div className="text-left">
                <div className="font-heading font-semibold text-base text-foreground leading-tight">{playerName}</div>
                {playerSubtitle && <div className="text-xs text-muted-foreground font-body">{playerSubtitle}</div>}
              </div>
            </div>
            <Badge variant="outline" className="text-xs font-body">
              {ro ? "Notiță privată" : "Private note"}
            </Badge>
          </div>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-5 pt-2">
            {/* ETICHETĂ */}
            <div>
              <Label className="text-xs font-body text-muted-foreground tracking-wider">{ro ? "ETICHETĂ" : "LABEL"}</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {allLabels.map(l => {
                  const isCustom = customLabels.includes(l);
                  const active = label === l;
                  return (
                    <button
                      key={l}
                      type="button"
                      onClick={() => { setLabel(active ? null : l); markDirty(); }}
                      className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-body transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"}`}
                    >
                      {l}
                      {isCustom && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); removeCustomLabel(l); }}
                          className="opacity-60 hover:opacity-100"
                          aria-label="remove"
                        >
                          <X className="h-3 w-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-2">
                {showLabelInput && (
                  <Input
                    autoFocus
                    value={newLabel}
                    onChange={(e) => setNewLabel(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); addCustomLabel(); }
                      if (e.key === "Escape") { setNewLabel(""); setShowLabelInput(false); }
                    }}
                    onBlur={() => addCustomLabel()}
                    placeholder={ro ? "Adaugă etichetă nouă…" : "Add new label…"}
                    className="h-9 text-sm"
                  />
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (showLabelInput) addCustomLabel();
                    else setShowLabelInput(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* RATING PERSONAL */}
            <div>
              <Label className="text-xs font-body text-muted-foreground tracking-wider">{ro ? "RATING PERSONAL" : "PERSONAL RATING"}</Label>
              <div className="flex items-center gap-1 mt-2">
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => { setRating(n === rating ? 0 : n); markDirty(); }}
                    className="p-1"
                    aria-label={`rating ${n}`}
                  >
                    <Star className={`h-6 w-6 transition-colors ${n <= rating ? "text-primary fill-primary" : "text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
            </div>

            {/* CALITĂȚI OBSERVATE */}
            <div>
              <Label className="text-xs font-body text-muted-foreground tracking-wider">{ro ? "CALITĂȚI OBSERVATE" : "OBSERVED QUALITIES"}</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {allQualities.map(q => {
                  const isCustom = customQualities.includes(q);
                  const active = qualities.includes(q);
                  return (
                    <button
                      key={q}
                      type="button"
                      onClick={() => toggleQuality(q)}
                      className={`group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-sm font-body transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"}`}
                    >
                      {q}
                      {isCustom && (
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(e) => { e.stopPropagation(); removeCustomQuality(q); }}
                          className="opacity-60 hover:opacity-100"
                          aria-label="remove"
                        >
                          <X className="h-3 w-3" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-2">
                {showQualityInput && (
                  <Input
                    autoFocus
                    value={newQuality}
                    onChange={(e) => setNewQuality(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") { e.preventDefault(); addCustomQuality(); }
                      if (e.key === "Escape") { setNewQuality(""); setShowQualityInput(false); }
                    }}
                    onBlur={() => addCustomQuality()}
                    placeholder={ro ? "Adaugă calitate nouă…" : "Add new quality…"}
                    className="h-9 text-sm"
                  />
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (showQualityInput) addCustomQuality();
                    else setShowQualityInput(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* MECI / DATA */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-body text-muted-foreground tracking-wider">{ro ? "MECI VIZIONAT" : "MATCH WATCHED"}</Label>
                <Input
                  value={matchWatched}
                  onChange={(e) => { setMatchWatched(e.target.value); markDirty(); }}
                  placeholder={ro ? "ex: FC Barcelona vs Real Madrid" : "ex: FC Barcelona vs Real Madrid"}
                  className="mt-2 h-9 text-sm"
                />
              </div>
              <div>
                <Label className="text-xs font-body text-muted-foreground tracking-wider">{ro ? "DATA VIZIONĂRII" : "WATCH DATE"}</Label>
                <Input
                  type="date"
                  value={matchDate}
                  onChange={(e) => { setMatchDate(e.target.value); markDirty(); }}
                  className="mt-2 h-9 text-sm"
                />
              </div>
            </div>

            {/* OBSERVAȚII */}
            <div>
              <Label className="text-xs font-body text-muted-foreground tracking-wider">{ro ? "OBSERVAȚII LIBERE" : "FREE OBSERVATIONS"}</Label>
              <Textarea
                value={observations}
                onChange={(e) => { setObservations(e.target.value); markDirty(); }}
                placeholder={ro ? "ex: Jucător tehnic cu viziune bună de joc. Încearcă driblinguri riscante, dar finalizarea lasă de dorit. Merită urmărit în meciurile următoare…" : "ex: Technical player with good vision. Tries risky dribbles but finishing is poor. Worth watching in upcoming matches…"}
                rows={4}
                className="mt-2 text-sm"
              />
            </div>

            {/* PRIORITATE */}
            <div>
              <Label className="text-xs font-body text-muted-foreground tracking-wider">{ro ? "PRIORITATE URMĂRIRE" : "TRACKING PRIORITY"}</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {priorities.map(p => {
                  const active = priority === p.key;
                  return (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => { setPriority(active ? null : p.key); markDirty(); }}
                      className={`px-3 py-2 rounded-md border text-sm font-body transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-secondary-foreground border-border hover:bg-secondary/80"}`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* FOOTER */}
            <div className="flex items-center justify-between pt-3 border-t border-border">
              <span className="text-xs text-muted-foreground font-body">
                {dirty ? (ro ? "Nesalvat" : "Unsaved") : (ro ? "Salvat" : "Saved")}
              </span>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                  {ro ? "Anulează" : "Cancel"}
                </Button>
                <Button type="button" onClick={handleSave} disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : (ro ? "Salvează notița" : "Save note")}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
