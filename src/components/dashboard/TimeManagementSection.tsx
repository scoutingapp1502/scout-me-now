import { useState, useEffect } from "react";
import { ArrowLeft, Info, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import DailyLimitSection from "./DailyLimitSection";
import SleepModeSection from "./SleepModeSection";

const STORAGE_KEY = "sportrise_daily_limit";

interface DayData { date: string; seconds: number; label: string; isToday: boolean; }

interface TimeManagementSectionProps {
  userId: string;
  onBack: () => void;
}

function formatDuration(seconds: number, lang: string): string {
  if (seconds < 60) return `${seconds}${lang === "ro" ? "s" : "s"}`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

const DAY_SHORT_RO = ["Dum", "Lun", "Mar", "Mie", "Joi", "Vin", "Sâm"];
const DAY_SHORT_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function TimeManagementSection({ userId, onBack }: TimeManagementSectionProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [days, setDays] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [subPage, setSubPage] = useState<"daily-limit" | "sleep-mode" | null>(null);
  const [dailyLimitValue, setDailyLimitValue] = useState<number | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    setDailyLimitValue(stored !== null && stored !== "null" ? Number(stored) : null);
  }, [subPage]); // re-read when returning from sub-page

  useEffect(() => {
    const fetchSessions = async () => {
      setLoading(true);
      // Last 7 days
      const result: DayData[] = [];
      const today = new Date();
      for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const dayIdx = d.getDay();
        result.push({
          date: dateStr,
          seconds: 0,
          label: i === 0
            ? (lang === "ro" ? "Azi" : "Today")
            : (lang === "ro" ? DAY_SHORT_RO[dayIdx] : DAY_SHORT_EN[dayIdx]),
          isToday: i === 0,
        });
      }

      const dates = result.map(d => d.date);
      const { data } = await (supabase as any)
        .from("app_sessions")
        .select("date, duration_seconds")
        .eq("user_id", userId)
        .in("date", dates);

      if (data) {
        for (const row of data) {
          const entry = result.find(d => d.date === row.date);
          if (entry) entry.seconds = row.duration_seconds;
        }
      }

      setDays(result);
      setLoading(false);
    };
    fetchSessions();
  }, [userId, lang]);

  const totalSeconds = days.reduce((s, d) => s + d.seconds, 0);
  const avgSeconds = Math.round(totalSeconds / 7);
  const maxSeconds = Math.max(...days.map(d => d.seconds), 1);

  if (subPage === "daily-limit") return <DailyLimitSection onBack={() => setSubPage(null)} />;
  if (subPage === "sleep-mode")  return <SleepModeSection  onBack={() => setSubPage(null)} />;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground">
          {lang === "ro" ? "Gestionarea timpului" : "Time management"}
        </h2>
        <button className="ml-auto p-1 text-muted-foreground hover:text-foreground">
          <Info className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* Daily average card */}
            <div className="px-5 pt-6 pb-4">
              <p className="text-4xl font-bold text-foreground font-heading">{formatDuration(avgSeconds, lang)}</p>
              <p className="text-sm font-semibold text-foreground font-body mt-1">
                {lang === "ro" ? "Medie zilnică" : "Daily average"}
              </p>
              <p className="text-xs text-muted-foreground font-body mt-1 leading-relaxed">
                {lang === "ro"
                  ? "Timpul mediu petrecut pe zi în SportRise în ultima săptămână."
                  : "Average time spent per day using SportRise in the last week."}
              </p>
            </div>

            {/* Bar chart */}
            <div className="px-4 pb-6">
              <div className="flex items-end justify-between gap-1 h-36">
                {days.map(day => {
                  const pct = maxSeconds > 0 ? (day.seconds / maxSeconds) : 0;
                  const heightPct = Math.max(pct * 100, day.seconds > 0 ? 4 : 1);
                  return (
                    <div key={day.date} className="flex flex-col items-center gap-1.5 flex-1">
                      <div className="w-full flex items-end justify-center" style={{ height: "112px" }}>
                        <div
                          className={`w-full rounded-t-md transition-all ${day.isToday ? "bg-primary" : "bg-primary/50"}`}
                          style={{ height: `${heightPct}%`, minHeight: day.seconds > 0 ? "6px" : "2px" }}
                        />
                      </div>
                      <span className={`text-[10px] font-body ${day.isToday ? "font-bold text-foreground" : "text-muted-foreground"}`}>
                        {day.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Manage your time */}
            <div className="px-5 pt-4 pb-2">
              <p className="text-xs text-muted-foreground font-body uppercase tracking-wider mb-1">
                {lang === "ro" ? "Gestionează-ți timpul" : "Manage your time"}
              </p>
            </div>
            <div className="bg-card border-y border-border">
              {/* Daily limit */}
              <button
                onClick={() => setSubPage("daily-limit")}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
              >
                <span className="text-sm font-body text-foreground">{lang === "ro" ? "Limită zilnică" : "Daily limit"}</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground font-body">
                    {dailyLimitValue === null
                      ? (lang === "ro" ? "Dezactivat" : "Off")
                      : dailyLimitValue < 60
                        ? `${dailyLimitValue} ${lang === "ro" ? "min" : "min"}`
                        : `${dailyLimitValue / 60}h`}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
              {/* Sleep mode */}
              <button
                onClick={() => setSubPage("sleep-mode")}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors border-t border-border"
              >
                <span className="text-sm font-body text-foreground">{lang === "ro" ? "Mod somn" : "Sleep mode"}</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-muted-foreground font-body">
                    {(() => {
                      try {
                        const s = localStorage.getItem("sportrise_sleep_mode");
                        if (s) { const c = JSON.parse(s); if (c.enabled) return lang === "ro" ? "Activat" : "On"; }
                      } catch {}
                      return lang === "ro" ? "Dezactivat" : "Off";
                    })()}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            </div>

            {/* This week summary */}
            <div className="px-5 py-4">
              <p className="text-xs text-muted-foreground font-body">
                {lang === "ro"
                  ? `Total săptămâna aceasta: ${formatDuration(totalSeconds, lang)}`
                  : `This week's total: ${formatDuration(totalSeconds, lang)}`}
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
