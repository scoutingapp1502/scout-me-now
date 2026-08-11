import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Calendar, RotateCcw, X, ChevronUp, ChevronDown, MoreHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";

/* ─── Types ─── */
interface ArchivedStory {
  id: string;
  media_url: string;
  caption: string;
  overlay_text: string;
  created_at: string;
}

interface ArchivedPost {
  id: string;
  content: string;
  image_url: string | null;
  video_url: string | null;
  post_type: string;
  created_at: string;
}

interface ArchiveSectionProps {
  userId: string;
  onBack: () => void;
}

type StoryTab = "stories" | "calendar";
type ArchiveMode = "stories" | "posts";

const STORY_TABS: { id: StoryTab; icon: React.ElementType }[] = [
  { id: "stories",  icon: RotateCcw },
  { id: "calendar", icon: Calendar  },
];

const MONTH_RO = ["Ianuarie","Februarie","Martie","Aprilie","Mai","Iunie","Iulie","August","Septembrie","Octombrie","Noiembrie","Decembrie"];
const DAY_RO   = ["Lun","Mar","Mie","Joi","Vin","Sâm","Dum"];

/* ─── Helpers ─── */
function groupByDate(stories: ArchivedStory[]) {
  const map = new Map<string, ArchivedStory[]>();
  for (const s of stories) {
    const key = new Date(s.created_at).toLocaleDateString("ro-RO", { day: "2-digit", month: "long", year: "numeric" });
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(s);
  }
  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

function getMonthsWithStories(stories: ArchivedStory[]) {
  if (!stories.length) return [];
  const dates = stories.map(s => new Date(s.created_at));
  const min = new Date(Math.min(...dates.map(d => d.getTime())));
  const now  = new Date();
  const months: { year: number; month: number }[] = [];
  let y = min.getFullYear(), m = min.getMonth();
  while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth())) {
    months.push({ year: y, month: m });
    m++; if (m > 11) { m = 0; y++; }
  }
  return months.reverse();
}

function storiesOnDay(stories: ArchivedStory[], year: number, month: number, day: number) {
  return stories.filter(s => {
    const d = new Date(s.created_at);
    return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
  });
}

/* ─── Calendar subcomponent ─── */
function CalendarView({ stories }: { stories: ArchivedStory[] }) {
  const months = getMonthsWithStories(stories);
  const [preview, setPreview] = useState<ArchivedStory | null>(null);

  if (!months.length) return (
    <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-8">
      <Calendar className="h-12 w-12 text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground font-body">Niciun story arhivat încă.</p>
    </div>
  );

  return (
    <div className="px-4 py-2">
      {preview && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center" onClick={() => setPreview(null)}>
          <button className="absolute top-4 right-4 text-white p-2" onClick={() => setPreview(null)}><X className="h-6 w-6" /></button>
          <img src={preview.media_url} alt="" className="max-w-[90vw] max-h-[80vh] rounded-xl object-contain" />
        </div>
      )}
      {months.map(({ year, month }) => {
        const firstDay = new Date(year, month, 1).getDay();
        const startOffset = firstDay === 0 ? 6 : firstDay - 1;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        return (
          <div key={`${year}-${month}`} className="mb-8">
            <h3 className="text-sm font-semibold text-foreground text-center mb-3 font-heading tracking-wider">{MONTH_RO[month]} {year}</h3>
            <div className="grid grid-cols-7 mb-1">
              {DAY_RO.map(d => <div key={d} className="text-[10px] text-muted-foreground text-center font-body">{d}</div>)}
            </div>
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
                      <button onClick={() => setPreview(dayStories[0])} className="w-9 h-9 rounded-full overflow-hidden ring-2 ring-primary/60 hover:ring-primary transition-all">
                        <img src={dayStories[0].media_url} alt="" className="w-full h-full object-cover" />
                      </button>
                    ) : (
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isToday ? "bg-primary" : ""}`}>
                        <span className={`text-xs font-body ${isToday ? "text-white font-bold" : "text-muted-foreground"}`}>{day}</span>
                      </div>
                    )}
                    {hasStory && dayStories.length > 1 && <span className="text-[9px] text-primary font-body">+{dayStories.length}</span>}
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
export default function ArchiveSection({ userId, onBack }: ArchiveSectionProps) {
  const { lang } = useLanguage();
  const [mode, setMode] = useState<ArchiveMode>("stories");
  const [storyTab, setStoryTab] = useState<StoryTab>("stories");
  const [stories, setStories] = useState<ArchivedStory[]>([]);
  const [posts, setPosts] = useState<ArchivedPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<ArchivedStory | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  /* fetch stories */
  useEffect(() => {
    setLoading(true);
    (supabase as any)
      .from("stories")
      .select("id, media_url, caption, overlay_text, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }: any) => { setStories(data || []); setLoading(false); })
      .catch((err: unknown) => { console.error("Failed to load stories:", err); setLoading(false); });
  }, [userId]);

  /* fetch archived posts */
  useEffect(() => {
    if (mode !== "posts") return;
    Promise.all([
      (supabase as any)
        .from("posts")
        .select("id, content, image_url, video_url, post_type, created_at")
        .eq("user_id", userId)
        .eq("is_archived", true)
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("scout_posts")
        .select("id, content, image_url, created_at")
        .eq("user_id", userId)
        .eq("is_archived", true)
        .order("created_at", { ascending: false }),
    ])
      .then(([postsRes, scoutPostsRes]: any) => {
        const combined = [
          ...(postsRes.data || []),
          ...(scoutPostsRes.data || []).map((p: any) => ({ ...p, video_url: null, post_type: "scout" })),
        ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        setPosts(combined);
      })
      .catch((err: unknown) => console.error("Failed to load archived posts:", err));
  }, [mode, userId]);

  /* close dropdown on outside click */
  useEffect(() => {
    if (!showDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setShowDropdown(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showDropdown]);

  const groups = groupByDate(stories);

  const titleRo = mode === "stories" ? "Story-uri arhivate" : "Postări arhivate";
  const titleEn = mode === "stories" ? "Stories archive"   : "Posts archive";
  const title   = lang === "ro" ? titleRo : titleEn;

  return (
    <div className="flex flex-col h-full bg-background">

      {/* ── Header ── */}
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>

        {/* Centered title + dropdown */}
        <div ref={dropdownRef} className="absolute left-1/2 -translate-x-1/2">
          <button
            onClick={() => setShowDropdown(v => !v)}
            className="flex items-center gap-1 font-heading text-sm text-foreground tracking-wide hover:text-primary transition-colors"
          >
            {title}
            {showDropdown ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {/* Dropdown */}
          {showDropdown && (
            <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-52 bg-popover border border-border rounded-xl shadow-lg overflow-hidden z-50">
              {(["stories", "posts"] as ArchiveMode[]).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setShowDropdown(false); }}
                  className={`w-full px-4 py-3 text-sm font-body text-center transition-colors ${mode === m ? "text-foreground font-semibold bg-muted/50" : "text-muted-foreground hover:bg-muted/30 hover:text-foreground"}`}
                >
                  {m === "stories"
                    ? (lang === "ro" ? "Story-uri arhivate" : "Stories archive")
                    : (lang === "ro" ? "Postări arhivate"  : "Posts archive"  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="ml-auto">
          <MoreHorizontal className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>

      {/* ── Story tabs (only in stories mode) ── */}
      {mode === "stories" && (
        <div className="flex items-center justify-around px-6 border-b border-border shrink-0">
          {STORY_TABS.map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setStoryTab(id)}
              className={`flex flex-col items-center gap-1 py-3 px-6 transition-colors ${storyTab === id ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              <Icon className="h-5 w-5" />
              {storyTab === id && <div className="w-5 h-0.5 rounded-full bg-foreground" />}
            </button>
          ))}
        </div>
      )}

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        {loading && mode === "stories" ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* ════ STORIES MODE ════ */}
            {mode === "stories" && (
              <>
                {storyTab === "stories" && (
                  stories.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 px-8 text-center">
                      <RotateCcw className="h-12 w-12 text-muted-foreground/40" />
                      <p className="text-sm font-semibold text-foreground font-body">
                        {lang === "ro" ? "Niciun story arhivat" : "No archived stories"}
                      </p>
                      <p className="text-xs text-muted-foreground font-body">
                        {lang === "ro" ? "Story-urile tale vor apărea aici după ce expiră." : "Your stories will appear here after they expire."}
                      </p>
                    </div>
                  ) : (
                    <div className="px-1 py-2">
                      {groups.map(({ label, items }) => (
                        <div key={label} className="mb-3">
                          <p className="text-xs text-muted-foreground font-body px-3 py-1">{label}</p>
                          <div className="grid grid-cols-3 gap-0.5">
                            {items.map(s => (
                              <button key={s.id} onClick={() => setPreview(s)} className="aspect-[9/16] overflow-hidden relative">
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
                  )
                )}

                {storyTab === "calendar" && <CalendarView stories={stories} />}
              </>
            )}

            {/* ════ POSTS MODE ════ */}
            {mode === "posts" && (
              posts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3 px-8 text-center">
                  <RotateCcw className="h-12 w-12 text-muted-foreground/40" />
                  <p className="text-sm font-semibold text-foreground font-body">
                    {lang === "ro" ? "Nicio postare arhivată" : "No archived posts"}
                  </p>
                  <p className="text-xs text-muted-foreground font-body">
                    {lang === "ro"
                      ? "Postările arhivate nu mai apar pe profilul tău. Doar tu le poți vedea."
                      : "Archived posts no longer appear on your profile. Only you can see them."}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-0.5 p-0.5">
                  {posts.map(p => (
                    <div key={p.id} className="aspect-square overflow-hidden bg-muted relative">
                      {p.image_url ? (
                        <img src={p.image_url} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center p-2">
                          <p className="text-xs text-muted-foreground font-body text-center line-clamp-4">{p.content}</p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )
            )}
          </>
        )}
      </div>

      {/* Story preview overlay */}
      {preview && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center" onClick={() => setPreview(null)}>
          <button className="absolute top-4 right-4 text-white p-2" onClick={() => setPreview(null)}>
            <X className="h-6 w-6" />
          </button>
          <div className="relative max-w-sm w-full mx-4">
            <img src={preview.media_url} alt="" className="w-full rounded-xl object-contain max-h-[80vh]" />
            {preview.overlay_text && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="text-white text-2xl font-bold text-center px-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                  style={{ fontFamily: "'Bebas Neue', sans-serif", whiteSpace: "pre-wrap", maxWidth: "80%" }}>
                  {preview.overlay_text}
                </span>
              </div>
            )}
            {preview.caption && <p className="text-white/80 text-sm text-center mt-3 font-body">{preview.caption}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
