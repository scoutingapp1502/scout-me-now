import { useState, useEffect, useRef } from "react";
import { ArrowLeft, ChevronRight, GripVertical, MinusCircle, Plus, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import type { Language } from "@/i18n/translations";

interface LanguageSectionProps {
  userId: string;
  onBack: () => void;
}

interface LangOption {
  code: string;
  native: string;
  english: string;
}

const ALL_LANGUAGES: LangOption[] = [
  { code: "en", native: "English",  english: "English"  },
  { code: "ro", native: "Română",   english: "Romanian" },
  { code: "de", native: "Deutsch",  english: "German"   },
  { code: "fr", native: "Français", english: "French"   },
  { code: "es", native: "Español",  english: "Spanish"  },
  { code: "it", native: "Italiano", english: "Italian"  },
];

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${on ? "bg-primary" : "bg-muted-foreground/30"}`}
    >
      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-6" : "translate-x-0.5"}`} />
    </button>
  );
}

// ── Set Language sub-page ────────────────────────────────────────────────────
function SetLanguagePage({ lang, setLang, onBack }: { lang: Language; setLang: (l: Language) => void; onBack: () => void }) {
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground whitespace-nowrap">
          {lang === "ro" ? "Setează limba" : "Set language"}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="bg-card border-y border-border divide-y divide-border">
          {ALL_LANGUAGES.map(l => (
            <button
              key={l.code}
              onClick={() => setLang(l.code as Language)}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors text-left"
            >
              <div>
                <p className="text-sm font-semibold font-body text-foreground">{l.native}</p>
                <p className="text-xs text-muted-foreground font-body">{l.english}</p>
              </div>
              {lang === l.code && <Check className="h-5 w-5 text-primary shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Preferred Languages sub-page ─────────────────────────────────────────────
function PreferredLanguagesPage({
  userId, lang, onBack,
}: { userId: string; lang: string; onBack: () => void }) {
  const { toast } = useToast();
  const [preferred, setPreferred] = useState<string[]>(["en"]);
  const [editMode, setEditMode] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const dragIdx = useRef<number | null>(null);

  useEffect(() => {
    (supabase as any)
      .from("user_privacy_settings")
      .select("preferred_languages")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.preferred_languages?.length) setPreferred(data.preferred_languages);
      })
      .catch((err: unknown) => console.error("Failed to load preferred languages:", err));
  }, [userId]);

  const persist = async (list: string[]) => {
    try {
      await (supabase as any)
        .from("user_privacy_settings")
        .upsert({ user_id: userId, preferred_languages: list, updated_at: new Date().toISOString() });
    } catch (err) {
      console.error("Failed to save preferred languages:", err);
    }
  };

  const handleRemove = (code: string) => {
    if (preferred.length <= 1) {
      toast({ title: lang === "ro" ? "Trebuie să ai cel puțin o limbă." : "At least one language is required." });
      return;
    }
    const next = preferred.filter(c => c !== code);
    setPreferred(next);
    persist(next);
  };

  const handleAdd = (code: string) => {
    if (preferred.includes(code)) return;
    const next = [...preferred, code];
    setPreferred(next);
    persist(next);
    setShowAdd(false);
  };

  // HTML5 drag-and-drop reorder
  const handleDragStart = (idx: number) => { dragIdx.current = idx; };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx.current === null || dragIdx.current === idx) return;
    const next = [...preferred];
    const [moved] = next.splice(dragIdx.current, 1);
    next.splice(idx, 0, moved);
    dragIdx.current = idx;
    setPreferred(next);
  };
  const handleDrop = () => {
    dragIdx.current = null;
    persist(preferred);
  };

  const getLang = (code: string) => ALL_LANGUAGES.find(l => l.code === code);
  const available = ALL_LANGUAGES.filter(l => !preferred.includes(l.code));

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground whitespace-nowrap">
          {lang === "ro" ? "Limbi preferate" : "Preferred languages"}
        </h2>
        <button
          onClick={() => { setEditMode(v => !v); setShowAdd(false); }}
          className="ml-auto text-sm font-semibold font-body text-foreground hover:text-primary transition-colors"
        >
          {editMode ? (lang === "ro" ? "Gata" : "Done") : (lang === "ro" ? "Editează" : "Edit")}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <p className="text-sm text-muted-foreground font-body px-5 py-4 leading-relaxed">
          {lang === "ro"
            ? "Vom traduce reels-urile în aceste limbi în ordinea aleasă și putem sugera reels-uri create inițial în aceste limbi."
            : "We'll translate reels into these languages in the order that you choose and may also suggest reels that were originally created in these languages."}
        </p>

        <div className="bg-card border-y border-border divide-y divide-border">
          {preferred.map((code, idx) => {
            const l = getLang(code);
            if (!l) return null;
            return (
              <div
                key={code}
                draggable={!editMode}
                onDragStart={() => handleDragStart(idx)}
                onDragOver={e => handleDragOver(e, idx)}
                onDrop={handleDrop}
                className="flex items-center gap-3 px-5 py-3.5 select-none"
              >
                {editMode && (
                  <button onClick={() => handleRemove(code)} className="text-destructive shrink-0">
                    <MinusCircle className="h-5 w-5" />
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold font-body text-foreground">{l.native}</p>
                  <p className="text-xs text-muted-foreground font-body">{l.english}</p>
                </div>
                {idx === 0 && !editMode && (
                  <span className="text-xs text-muted-foreground font-body mr-2">
                    {lang === "ro" ? "Primară" : "Primary"}
                  </span>
                )}
                {!editMode && <GripVertical className="h-5 w-5 text-muted-foreground/50 shrink-0 cursor-grab" />}
              </div>
            );
          })}
        </div>

        {/* Add language */}
        {editMode && (
          <div className="mt-4">
            {!showAdd ? (
              <button
                onClick={() => setShowAdd(true)}
                className="flex items-center gap-2 px-5 py-3 text-sm font-semibold font-body text-primary hover:text-primary/80 transition-colors"
              >
                <Plus className="h-4 w-4" />
                {lang === "ro" ? "Adaugă limbă" : "Add language"}
              </button>
            ) : (
              <div className="bg-card border-y border-border divide-y divide-border">
                {available.map(l => (
                  <button
                    key={l.code}
                    onClick={() => handleAdd(l.code)}
                    className="w-full flex flex-col items-start px-5 py-3 hover:bg-muted/30 transition-colors text-left"
                  >
                    <span className="text-sm font-semibold font-body text-foreground">{l.native}</span>
                    <span className="text-xs text-muted-foreground font-body">{l.english}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main LanguageSection ──────────────────────────────────────────────────────
export default function LanguageSection({ userId, onBack }: LanguageSectionProps) {
  const { lang, setLang } = useLanguage();
  const { toast } = useToast();
  const [subPage, setSubPage] = useState<"set-language" | "preferred-languages" | null>(null);
  const [translateReelsText, setTranslateReelsText] = useState(true);
  const [translateVoice, setTranslateVoice] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (supabase as any)
      .from("user_privacy_settings")
      .select("translate_reels_text, translate_voice")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          if (data.translate_reels_text != null) setTranslateReelsText(data.translate_reels_text);
          if (data.translate_voice != null) setTranslateVoice(data.translate_voice);
        }
      })
      .catch((err: unknown) => console.error("Failed to load translation settings:", err));
  }, [userId]);

  if (subPage === "set-language") {
    return <SetLanguagePage lang={lang} setLang={setLang} onBack={() => setSubPage(null)} />;
  }
  if (subPage === "preferred-languages") {
    return <PreferredLanguagesPage userId={userId} lang={lang} onBack={() => setSubPage(null)} />;
  }

  const save = async (field: string, value: boolean) => {
    setSaving(true);
    const { error } = await (supabase as any)
      .from("user_privacy_settings")
      .upsert({ user_id: userId, [field]: value, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) toast({ title: lang === "ro" ? "Eroare la salvare." : "Save error.", variant: "destructive" });
  };

  const handleTranslateReelsText = () => { const v = !translateReelsText; setTranslateReelsText(v); save("translate_reels_text", v); };
  const handleTranslateVoice = () => { const v = !translateVoice; setTranslateVoice(v); save("translate_voice", v); };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground whitespace-nowrap">
          {lang === "ro" ? "Limbă și traduceri" : "Language and translations"}
        </h2>
        {saving && <div className="ml-auto w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />}
      </div>

      <div className="flex-1 overflow-y-auto">
        <p className="text-sm font-semibold font-body text-foreground px-5 pt-5 pb-2">
          {lang === "ro" ? "Limba SportRise" : "SportRise language"}
        </p>
        <div className="bg-card border-y border-border">
          <button
            onClick={() => setSubPage("set-language")}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
          >
            <span className="text-sm font-body text-foreground">
              {lang === "ro" ? "Setează limba" : "Set language"}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
          </button>
        </div>

        <p className="text-sm font-semibold font-body text-foreground px-5 pt-5 pb-2">
          {lang === "ro" ? "Traduceri reels" : "Reels translations"}
        </p>
        <div className="bg-card border-y border-border divide-y divide-border">
          <button
            onClick={() => setSubPage("preferred-languages")}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
          >
            <span className="text-sm font-body text-foreground">
              {lang === "ro" ? "Limbi preferate" : "Preferred languages"}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
          </button>

          <div className="px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-body text-foreground flex-1 pr-4">
                {lang === "ro" ? "Traduce textul din reels" : "Translate text on reels"}
              </span>
              <Toggle on={translateReelsText} onToggle={handleTranslateReelsText} />
            </div>
            <p className="text-xs text-muted-foreground font-body mt-1.5 leading-relaxed pr-16">
              {lang === "ro"
                ? "Vezi autocolante și text în limba ta preferată, când este disponibil."
                : "See stickers and text in your preferred language when available."}
            </p>
          </div>

          <div className="px-5 py-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-body text-foreground flex-1 pr-4">
                {lang === "ro" ? "Traduce vocea" : "Translate voice"}
              </span>
              <Toggle on={translateVoice} onToggle={handleTranslateVoice} />
            </div>
            <p className="text-xs text-muted-foreground font-body mt-1.5 leading-relaxed pr-16">
              {lang === "ro"
                ? "Ascultă sunetul tradus în limba ta implicită în vocea vorbitorului, când este disponibil."
                : "Hear audio translated into your default language in the speaker's voice when available."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
