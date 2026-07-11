import { useState, useEffect } from "react";
import { X, Heart, Calendar, MapPin, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

interface ArchivedStory {
  id: string;
  media_url: string;
  caption: string;
  overlay_text: string;
  created_at: string;
}

interface StoryArchiveModalProps {
  userId: string;
  open: boolean;
  onClose: () => void;
}

type Tab = "stories" | "highlights" | "calendar" | "map";

const TABS: { id: Tab; icon: React.ElementType }[] = [
  { id: "stories",    icon: RotateCcw  },
  { id: "highlights", icon: Heart      },
  { id: "calendar",   icon: Calendar   },
  { id: "map",        icon: MapPin     },
];

/* ─── helpers ─── */
function groupByDate(stories: ArchivedStory[]): { label: string; items: ArchivedStory[] }[] {
  const map = new Map<string, ArchivedStory[]>();
  for (const s of stories) {
    const d = new Date(s.created_at);
    const key = d.toLocaleDateString("ro-RO", { day: "2-digit", month: "long", year: "numeric" });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

function getMonthsWithStories(stories: ArchivedStory[]) {
  if (stories.length === 0) return [];
  const dates = stories.map(s => new Date(s.created_at));
  const min = new Date(Math.min(...dates.map(d => d.getTime())));
  const now = new Date();
  const months: { year: number; month: number }[] = [];
  let y = min.getFullYear(), m = min.getMonth();
  while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth())) {
    months.push({ year: y, month: m });
    m++; if (m > 11) { m = 0; y++; }
  }
  return months.reverse();
}

function storiesOnDay(stories: ArchivedStory[], year: number, month: number, day: number): ArchivedStory[] {
  return stories.filter(s => {
    const d = new Date(s.created_at);
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
  });
}

const MONTH_RO = ["Ianuarie","Februarie","Martie","Aprilie","Mai","Iunie","Iulie","August","Septembrie","Octombrie","Noiembrie","Decembrie"];
const DAY_RO   = ["Lun","Mar","Mie","Joi","Vin","Sâm","Dum"];

/* ─── Calendar component ─── */
function CalendarTab({ stories }: { stories: ArchivedStory[] }) {
  const months = getMonthsWithStories(stories);
  const [preview, setPreview] = useState<ArchivedStory | null>(null);

  if (months.length === 0) return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8 py-12">
      <Calendar className="h-12 w-12 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">Niciun story arhivat încă.</p>
    </div>
  );

  return (
    <div className="flex-1 overflow-y-auto px-4 py-2">
      {preview && (
        <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center" onClick={() => setPreview(null)}>
          <img src={preview.media_url} alt="" className="max-w-[90vw] max-h-[80vh] rounded-xl object-contain" />
        </div>
      )}
      {months.map(({ year, month }) => {
        const firstDay = new Date(year, month, 1).getDay(); // 0=Sun
        const startOffset = firstDay === 0 ? 6 : firstDay - 1; // Mon-first
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        return (
          <div key={`${year}-${month}`} className="mb-8">
            <h3 className="text-sm font-semibold text-foreground text-center mb-3 font-heading tracking-wider">
              {MONTH_RO[month]} {year}
            </h3>
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-1">
              {DAY_RO.map(d => (
                <div key={d} className="text-[10px] text-muted-foreground text-center font-body">{d}</div>
              ))}
            </div>
            {/* Day cells */}
            <div className="grid grid-cols-7 gap-y-1">
              {Array.from({ length: startOffset }).map((_, i) => <div key={`e${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dayStories = storiesOnDay(stories, year, month, day);
                const hasStory = dayStories.length > 0;
                const today = new Date();
                const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === day;

                return (
                  <div key={day} className="flex flex-col items-center gap-0.5">
                    {hasStory ? (
                      <button
                        onClick={() => setPreview(dayStories[0])}
                        className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-primary/60 hover:ring-primary transition-all"
                      >
                        <img src={dayStories[0].media_url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ) : (
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isToday ? "bg-primary text-white" : ""}`}>
                        <span className={`text-xs font-body ${isToday ? "text-white font-bold" : "text-muted-foreground"}`}>{day}</span>
                      </div>
                    )}
                    {hasStory && dayStories.length > 1 && (
                      <span className="text-[9px] text-primary font-body">+{dayStories.length}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main component ─── */
export default function StoryArchiveModal({ userId, open, onClose }: StoryArchiveModalProps) {
  const { lang } = useLanguage();
  const [tab, setTab] = useState<Tab>("stories");
  const [stories, setStories] = useState<ArchivedStory[]>([]);
  const [loading, setLoading] = useState(false);
  const [previewStory, setPreviewStory] = useState<ArchivedStory | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (supabase as any)
      .from("stories")
      .select("id, media_url, caption, overlay_text, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }: any) => { setStories(data || []); setLoading(false); });
  }, [open, userId]);

  const groups = groupByDate(stories);

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent
          className="max-w-sm w-full p-0 bg-background border-border overflow-hidden h-[90vh] flex flex-col gap-0"
          hideClose={true}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 pt-4 pb-2 shrink-0">
            <h2 className="font-heading text-base text-foreground tracking-wide">
              {lang === "ro" ? "Arhivă" : "Archive"}
            </h2>
            <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex items-center justify-around px-6 pb-2 border-b border-border shrink-0">
            {TABS.map(({ id, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`flex flex-col items-center gap-1 py-2 px-4 transition-colors ${tab === id ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                <Icon className="h-5 w-5" />
                {tab === id && <div className="w-5 h-0.5 rounded-full bg-foreground" />}
              </button>
            ))}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* ── Tab: Stories ── */}
              {tab === "stories" && (
                <div className="flex-1 overflow-y-auto">
                  {stories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full gap-3 px-8 text-center">
                      <RotateCcw className="h-12 w-12 text-muted-foreground/40" />
                      <p className="text-sm font-semibold text-foreground font-body">
                        {lang === "ro" ? "Niciun story arhivat" : "No archived stories"}
                      </p>
                      <p className="text-xs text-muted-foreground font-body">
                        {lang === "ro"
                          ? "Story-urile tale vor apărea aici după ce expiră."
                          : "Your stories will appear here after they expire."}
                      </p>
                    </div>
                  ) : (
                    <div className="px-1 py-2">
                      {groups.map(({ label, items }) => (
                        <div key={label} className="mb-3">
                          <p className="text-xs text-muted-foreground font-body px-3 py-1">{label}</p>
                          <div className="grid grid-cols-3 gap-0.5">
                            {items.map(s => (
                              <button
                                key={s.id}
                                onClick={() => setPreviewStory(s)}
                                className="aspect-[9/16] overflow-hidden relative"
                              >
                                <img src={s.media_url} alt="" className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                                {s.overlay_text && (
                                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                    <span className="text-white text-[10px] font-bold text-center px-1 drop-shadow line-clamp-2" style={{ fontFamily: "'Bebas Neue', sans-serif" }}>
                                      {s.overlay_text}
                                    </span>
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab: Highlights ── */}
              {tab === "highlights" && (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
                  <div className="w-16 h-16 rounded-full border-2 border-muted-foreground/30 flex items-center justify-center">
                    <RotateCcw className="h-7 w-7 text-muted-foreground/50" />
                  </div>
                  <p className="text-base font-semibold text-foreground font-body">
                    {lang === "ro" ? "Niciun highlight arhivat" : "No archived highlights"}
                  </p>
                  <p className="text-xs text-muted-foreground font-body leading-relaxed">
                    {lang === "ro"
                      ? "Când arhivezi highlighturi, vor apărea aici. Doar tu le poți vedea."
                      : "When you archive highlights, they'll appear here. Only you can see them."}
                  </p>
                </div>
              )}

              {/* ── Tab: Calendar ── */}
              {tab === "calendar" && <CalendarTab stories={stories} />}

              {/* ── Tab: Map ── */}
              {tab === "map" && (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 px-8 text-center">
                  <MapPin className="h-12 w-12 text-muted-foreground/40" />
                  <p className="text-sm font-semibold text-foreground font-body">
                    {lang === "ro" ? "Hartă locații" : "Locations map"}
                  </p>
                  <p className="text-xs text-muted-foreground font-body leading-relaxed">
                    {lang === "ro"
                      ? "Când adaugi un sticker de locație la story-urile tale, ele vor apărea pe această hartă. Doar tu le poți vedea."
                      : "When you add a location sticker to your stories, they'll appear on this map. Only you can see your archive."}
                  </p>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Full-screen preview */}
      {previewStory && (
        <div
          className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center"
          onClick={() => setPreviewStory(null)}
        >
          <button
            className="absolute top-4 right-4 text-white p-2"
            onClick={() => setPreviewStory(null)}
          >
            <X className="h-6 w-6" />
          </button>
          <div className="relative max-w-sm w-full mx-4">
            <img src={previewStory.media_url} alt="" className="w-full rounded-xl object-contain max-h-[80vh]" />
            {previewStory.overlay_text && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span
                  className="text-white text-2xl font-bold text-center px-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                  style={{ fontFamily: "'Bebas Neue', sans-serif", whiteSpace: "pre-wrap", maxWidth: "80%" }}
                >
                  {previewStory.overlay_text}
                </span>
              </div>
            )}
            {previewStory.caption && (
              <p className="text-white/80 text-sm text-center mt-3 font-body">{previewStory.caption}</p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
