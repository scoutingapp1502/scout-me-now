import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

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
  const [days, setDays] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

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

  // Live-tick today's bar while the tab is visible, on top of the
  // last-persisted baseline from app_sessions (useTimeTracking only
  // flushes to the DB every 60s / on visibility change, so without this
  // the "Azi" bar would visibly jump instead of growing continuously).
  const sessionStartRef = useRef<number | null>(document.visibilityState === "visible" ? Date.now() : null);
  useEffect(() => {
    const onVisibility = () => {
      sessionStartRef.current = document.visibilityState === "visible" ? Date.now() : null;
    };
    document.addEventListener("visibilitychange", onVisibility);

    const interval = setInterval(() => {
      if (sessionStartRef.current === null) return;
      const elapsed = Math.floor((Date.now() - sessionStartRef.current) / 1000);
      if (elapsed < 1) return;
      setDays(prev => {
        if (prev.length === 0) return prev;
        const todayStr = new Date().toISOString().slice(0, 10);
        const idx = prev.findIndex(d => d.isToday);
        if (idx === -1) return prev;
        // Day may have rolled over since the tab was opened.
        if (prev[idx].date !== todayStr) return prev;
        return prev.map((d, i) => i === idx ? { ...d, seconds: d.seconds + elapsed } : d);
      });
      sessionStartRef.current = Date.now();
    }, 1000);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      clearInterval(interval);
    };
  }, []);

  const totalSeconds = days.reduce((s, d) => s + d.seconds, 0);
  const avgSeconds = Math.round(totalSeconds / 7);
  const maxSeconds = Math.max(...days.map(d => d.seconds), 1);
  const selectedDay = selectedDate ? days.find(d => d.date === selectedDate) ?? null : null;

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
            {/* Daily average / selected day card */}
            <div className="px-5 pt-6 pb-4">
              {selectedDay ? (
                <>
                  <p className="text-4xl font-bold text-foreground font-heading">{formatDuration(selectedDay.seconds, lang)}</p>
                  <p className="text-sm font-semibold text-foreground font-body mt-1">
                    {selectedDay.isToday
                      ? (lang === "ro" ? "Azi" : "Today")
                      : new Date(selectedDay.date).toLocaleDateString(lang === "ro" ? "ro-RO" : "en-US", { weekday: "long", day: "numeric", month: "long" })}
                  </p>
                  <button
                    onClick={() => setSelectedDate(null)}
                    className="text-xs text-primary font-body font-medium mt-1"
                  >
                    {lang === "ro" ? "Înapoi la medie" : "Back to average"}
                  </button>
                </>
              ) : (
                <>
                  <p className="text-4xl font-bold text-foreground font-heading">{formatDuration(avgSeconds, lang)}</p>
                  <p className="text-sm font-semibold text-foreground font-body mt-1">
                    {lang === "ro" ? "Medie zilnică" : "Daily average"}
                  </p>
                  <p className="text-xs text-muted-foreground font-body mt-1 leading-relaxed">
                    {lang === "ro"
                      ? "Timpul mediu petrecut pe zi în SportRise în ultima săptămână. Apasă pe o zi pentru detalii."
                      : "Average time spent per day using SportRise in the last week. Tap a day for details."}
                  </p>
                </>
              )}
            </div>

            {/* Bar chart */}
            <div className="px-4 pb-6">
              <div className="flex items-end justify-between gap-1 h-36">
                {days.map(day => {
                  const pct = maxSeconds > 0 ? (day.seconds / maxSeconds) : 0;
                  const heightPct = Math.max(pct * 100, day.seconds > 0 ? 4 : 1);
                  const isSelected = selectedDate === day.date;
                  return (
                    <button
                      key={day.date}
                      onClick={() => setSelectedDate(prev => prev === day.date ? null : day.date)}
                      className="flex flex-col items-center gap-1.5 flex-1"
                    >
                      <div className="w-full flex items-end justify-center" style={{ height: "112px" }}>
                        <div
                          className={`w-full rounded-t-md transition-all ${
                            isSelected ? "bg-foreground" : day.isToday ? "bg-primary" : "bg-primary/50"
                          }`}
                          style={{ height: `${heightPct}%`, minHeight: day.seconds > 0 ? "6px" : "2px" }}
                        />
                      </div>
                      <span className={`text-[10px] font-body ${isSelected || day.isToday ? "font-bold text-foreground" : "text-muted-foreground"}`}>
                        {day.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="border-t border-border" />

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
