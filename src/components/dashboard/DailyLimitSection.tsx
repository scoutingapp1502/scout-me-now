import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";

interface DailyLimitSectionProps {
  onBack: () => void;
}

const OPTIONS: { value: number | null; labelRo: string; labelEn: string }[] = [
  { value: 15,   labelRo: "15 minute",   labelEn: "15 minutes" },
  { value: 30,   labelRo: "30 minute",   labelEn: "30 minutes" },
  { value: 45,   labelRo: "45 minute",   labelEn: "45 minutes" },
  { value: 60,   labelRo: "1 oră",       labelEn: "1 hour"     },
  { value: 120,  labelRo: "2 ore",       labelEn: "2 hours"    },
  { value: null, labelRo: "Dezactivat",  labelEn: "Off"        },
];

const STORAGE_KEY = "sportrise_daily_limit";

export default function DailyLimitSection({ onBack }: DailyLimitSectionProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored !== null) setSelected(stored === "null" ? null : Number(stored));
    else setSelected(null);
  }, []);

  const handleSelect = (value: number | null) => {
    setSelected(value);
    localStorage.setItem(STORAGE_KEY, String(value));
    if (value !== null) {
      toast({
        title: lang === "ro"
          ? `Limită zilnică setată: ${OPTIONS.find(o => o.value === value)?.labelRo}`
          : `Daily limit set: ${OPTIONS.find(o => o.value === value)?.labelEn}`,
      });
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground">
          {lang === "ro" ? "Limită zilnică" : "Daily limit"}
        </h2>
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground font-body px-5 py-4 leading-relaxed">
        {lang === "ro"
          ? "Te vom anunța să închizi SportRise când petreci această perioadă pe zi. Te vom înștiința și când ești aproape de limită."
          : "We'll remind you to close SportRise when you spend this amount of time in a day. We'll also let you know when you're close to reaching the limit."}
      </p>

      {/* Options */}
      <div className="flex-1 overflow-y-auto">
        {OPTIONS.map((opt, i) => (
          <button
            key={String(opt.value)}
            onClick={() => handleSelect(opt.value)}
            className={`w-full flex items-center justify-between px-5 py-4 text-sm font-body text-foreground hover:bg-muted/30 transition-colors ${i > 0 ? "border-t border-border/40" : ""}`}
          >
            <span>{lang === "ro" ? opt.labelRo : opt.labelEn}</span>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${selected === opt.value ? "border-foreground" : "border-muted-foreground/40"}`}>
              {selected === opt.value && <div className="w-2.5 h-2.5 rounded-full bg-foreground" />}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
