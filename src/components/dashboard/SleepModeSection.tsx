import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import TimePickerDrum from "./TimePickerDrum";

interface SleepModeSectionProps {
  onBack: () => void;
}

const STORAGE_KEY = "sportrise_sleep_mode";

const DAYS_RO = ["D", "L", "M", "M", "J", "V", "S"];
const DAYS_EN = ["S", "M", "T", "W", "T", "F", "S"];

interface SleepConfig {
  enabled: boolean;
  startTime: string;
  endTime: string;
  days: boolean[];
}

const DEFAULT_CONFIG: SleepConfig = {
  enabled: false,
  startTime: "00:00",
  endTime: "00:00",
  days: [false, false, false, false, false, false, false],
};

export default function SleepModeSection({ onBack }: SleepModeSectionProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();

  const [config, setConfig] = useState<SleepConfig>(DEFAULT_CONFIG);
  const [openPicker, setOpenPicker] = useState<"start" | "end" | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { setConfig(JSON.parse(stored)); } catch {}
    }
  }, []);

  const update = (patch: Partial<SleepConfig>) =>
    setConfig(prev => ({ ...prev, ...patch }));

  const toggleDay = (i: number) => {
    const days = [...config.days];
    days[i] = !days[i];
    update({ days });
  };

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    toast({
      title: lang === "ro"
        ? config.enabled ? "Mod somn activat!" : "Mod somn dezactivat."
        : config.enabled ? "Sleep mode enabled!" : "Sleep mode disabled.",
    });
    onBack();
  };

  const activeDays = config.days.filter(Boolean).length;
  const statusText = config.enabled
    ? activeDays > 0
      ? (lang === "ro" ? `Activ ${activeDays} ${activeDays === 1 ? "zi" : "zile"} / săptămână` : `Active ${activeDays} day${activeDays > 1 ? "s" : ""}/week`)
      : (lang === "ro" ? "Activ (nicio zi selectată)" : "Active (no days selected)")
    : (lang === "ro" ? "Modul somn este dezactivat." : "Sleep mode is off.");

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground">
          {lang === "ro" ? "Mod somn" : "Sleep mode"}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto px-5">
        {/* Toggle row */}
        <div className="flex items-center justify-between py-5 border-b border-border">
          <span className="text-sm font-body text-foreground font-medium">
            {lang === "ro" ? "Mod somn" : "Sleep mode"}
          </span>
          <button
            onClick={() => update({ enabled: !config.enabled })}
            className={`relative w-12 h-6 rounded-full transition-colors ${config.enabled ? "bg-primary" : "bg-muted-foreground/30"}`}
          >
            <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${config.enabled ? "translate-x-6" : "translate-x-0.5"}`} />
          </button>
        </div>

        {/* Description */}
        <p className="text-xs text-muted-foreground font-body py-3 leading-relaxed border-b border-border">
          {lang === "ro"
            ? "Notificările tale vor fi silențioase în perioadele pe care le alegi. Oamenii vor vedea că ești în modul somn."
            : "Your notifications will be muted during the times you choose. People will see that you're in sleep mode."}
        </p>

        {/* Start time */}
        <div className={`border-b border-border transition-opacity ${!config.enabled ? "opacity-40 pointer-events-none" : ""}`}>
          <button
            className="w-full flex items-center justify-between py-4"
            onClick={() => setOpenPicker(openPicker === "start" ? null : "start")}
          >
            <span className="text-sm font-body text-foreground">
              {lang === "ro" ? "Oră de început" : "Start time"}
            </span>
            <span className="text-sm font-body text-primary font-medium">{config.startTime}</span>
          </button>
          {openPicker === "start" && (
            <div className="pb-3">
              <TimePickerDrum value={config.startTime} onChange={(v) => update({ startTime: v })} />
            </div>
          )}
        </div>

        {/* End time */}
        <div className={`border-b border-border transition-opacity ${!config.enabled ? "opacity-40 pointer-events-none" : ""}`}>
          <button
            className="w-full flex items-center justify-between py-4"
            onClick={() => setOpenPicker(openPicker === "end" ? null : "end")}
          >
            <span className="text-sm font-body text-foreground">
              {lang === "ro" ? "Oră de sfârșit" : "End time"}
            </span>
            <span className="text-sm font-body text-primary font-medium">{config.endTime}</span>
          </button>
          {openPicker === "end" && (
            <div className="pb-3">
              <TimePickerDrum value={config.endTime} onChange={(v) => update({ endTime: v })} />
            </div>
          )}
        </div>

        {/* Choose days */}
        <div className={`py-4 border-b border-border transition-opacity ${!config.enabled ? "opacity-40 pointer-events-none" : ""}`}>
          <p className="text-sm font-body text-foreground mb-3">
            {lang === "ro" ? "Alege zilele" : "Choose days"}
          </p>
          <div className="flex items-center gap-2">
            {(lang === "ro" ? DAYS_RO : DAYS_EN).map((label, i) => (
              <button
                key={i}
                onClick={() => toggleDay(i)}
                className={`w-9 h-9 rounded-full text-xs font-body font-medium transition-colors ${config.days[i] ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Status */}
        <p className="text-xs text-muted-foreground font-body py-4">
          {statusText}
        </p>
      </div>

      {/* Save button */}
      <div className="shrink-0 px-5 py-4 border-t border-border">
        <button
          onClick={handleSave}
          className={`w-full py-3.5 rounded-full text-sm font-semibold font-body transition-colors ${config.enabled ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-muted text-muted-foreground"}`}
        >
          {lang === "ro" ? "Salvează" : "Save"}
        </button>
      </div>
    </div>
  );
}
