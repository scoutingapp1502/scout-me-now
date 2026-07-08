import { useState, useEffect } from "react";
import { ArrowLeft, ChevronDown, Video, User, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import PostCard from "./PostCard";

interface LikedPost {
  likeId: string;
  likedAt: string;
  post: {
    id: string; content: string; image_url: string | null; video_url: string | null;
    post_type: string; user_id: string; created_at: string; is_archived: boolean;
  };
  author: { user_id: string; name: string; photo: string | null; role: string } | null;
}

interface LikesActivitySectionProps {
  userId: string;
  onBack: () => void;
  onViewProfile: (userId: string, role: string) => void;
}

type SortOrder  = "newest" | "oldest";
type DateFilter = "all" | "7d" | "30d" | "3m" | "1y";
type TypeFilter = "all" | "image" | "video" | "text";

const SORT_OPTIONS = [
  { value: "newest" as SortOrder, labelRo: "De la nou la vechi", labelEn: "Newest to oldest" },
  { value: "oldest" as SortOrder, labelRo: "De la vechi la nou", labelEn: "Oldest to newest" },
];
const DATE_OPTIONS = [
  { value: "all" as DateFilter,  labelRo: "Toate datele",     labelEn: "All dates"       },
  { value: "7d"  as DateFilter,  labelRo: "Ultimele 7 zile",  labelEn: "Last 7 days"     },
  { value: "30d" as DateFilter,  labelRo: "Ultimele 30 zile", labelEn: "Last 30 days"    },
  { value: "3m"  as DateFilter,  labelRo: "Ultimele 3 luni",  labelEn: "Last 3 months"   },
  { value: "1y"  as DateFilter,  labelRo: "Ultimul an",       labelEn: "Last year"       },
];
const TYPE_OPTIONS = [
  { value: "all"   as TypeFilter, labelRo: "Toate tipurile", labelEn: "All content types" },
  { value: "image" as TypeFilter, labelRo: "Imagini",        labelEn: "Photos"            },
  { value: "video" as TypeFilter, labelRo: "Videoclipuri",   labelEn: "Videos"            },
  { value: "text"  as TypeFilter, labelRo: "Text",           labelEn: "Text"              },
];

/* ─── Generic radio bottom sheet ─── */
function RadioSheet<T extends string>({
  title, options, value, onChange, onClose, lang,
}: {
  title: string;
  options: { value: T; labelRo: string; labelEn: string }[];
  value: T; onChange: (v: T) => void; onClose: () => void; lang: string;
}) {
  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} />
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[61] w-full max-w-sm bg-background rounded-t-2xl shadow-2xl pb-6">
        <div className="flex justify-center pt-3 pb-1"><div className="w-10 h-1 rounded-full bg-border" /></div>
        <p className="text-center text-sm font-semibold text-foreground font-body py-3 border-b border-border">{title}</p>
        {options.map(opt => (
          <button key={opt.value} onClick={() => { onChange(opt.value); onClose(); }}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-body text-foreground hover:bg-muted/30 transition-colors border-b border-border/40 last:border-0">
            <span>{lang === "ro" ? opt.labelRo : opt.labelEn}</span>
            <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${value === opt.value ? "border-foreground" : "border-muted-foreground/40"}`}>
              {value === opt.value && <div className="w-2.5 h-2.5 rounded-full bg-foreground" />}
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

/* ─── Author filter bottom sheet ─── */
function AuthorSheet({
  authors, selectedId, onApply, onClose, lang,
}: {
  authors: { user_id: string; name: string; photo: string | null }[];
  selectedId: string | null;
  onApply: (id: string | null) => void;
  onClose: () => void;
  lang: string;
}) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string | null>(selectedId);

  const filtered = authors.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} />
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[61] w-full max-w-sm bg-background rounded-t-2xl shadow-2xl flex flex-col max-h-[75vh]">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0"><div className="w-10 h-1 rounded-full bg-border" /></div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <p className="text-sm font-semibold text-foreground font-body">
            {lang === "ro" ? "Filtrează după autor" : "Filter by Author"}
          </p>
          <button onClick={() => { setPicked(null); }} className="text-sm font-body text-primary hover:opacity-80">
            {lang === "ro" ? "Resetează" : "Clear"}
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-2 shrink-0">
          <div className="flex items-center gap-2 bg-muted rounded-full px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={lang === "ro" ? "Caută" : "Search"}
              className="flex-1 bg-transparent text-sm outline-none border-none font-body text-foreground placeholder:text-muted-foreground"
              autoFocus
            />
          </div>
        </div>

        {/* Authors list */}
        <div className="flex-1 overflow-y-auto">
          {filtered.map(a => (
            <button key={a.user_id} onClick={() => setPicked(p => p === a.user_id ? null : a.user_id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors border-b border-border/30 last:border-0">
              <div className="w-10 h-10 rounded-full overflow-hidden bg-muted flex items-center justify-center shrink-0">
                {a.photo ? <img src={a.photo} alt="" className="w-full h-full object-cover" /> : <User className="h-5 w-5 text-muted-foreground" />}
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-body text-foreground">{a.name}</p>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${picked === a.user_id ? "border-foreground" : "border-muted-foreground/40"}`}>
                {picked === a.user_id && <div className="w-2.5 h-2.5 rounded-full bg-foreground" />}
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8 font-body">
              {lang === "ro" ? "Niciun rezultat." : "No results."}
            </p>
          )}
        </div>

        {/* Apply button */}
        <div className="shrink-0 px-4 py-4 border-t border-border">
          <button
            onClick={() => { onApply(picked); onClose(); }}
            className="w-full py-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold font-body hover:bg-primary/90 transition-colors"
          >
            {lang === "ro" ? "Aplică" : "Apply"}
          </button>
        </div>
      </div>
    </>
  );
}

/* ─── Filter pill ─── */
function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-body border transition-colors shrink-0 ${active ? "border-primary text-primary" : "border-border text-foreground hover:bg-muted/40"}`}>
      {label}<ChevronDown className="h-3 w-3" />
    </button>
  );
}

/* ─── Main ─── */
export default function LikesActivitySection({ userId, onBack, onViewProfile }: LikesActivitySectionProps) {
  const { lang } = useLanguage();
  const [liked, setLiked] = useState<LikedPost[]>([]);
  const [loading, setLoading] = useState(true);

  const [sort, setSort]               = useState<SortOrder>("newest");
  const [dateFilter, setDateFilter]   = useState<DateFilter>("all");
  const [typeFilter, setTypeFilter]   = useState<TypeFilter>("all");
  const [authorId, setAuthorId]       = useState<string | null>(null);

  const [sheet, setSheet] = useState<"sort" | "date" | "type" | "author" | null>(null);
  const [selectedPost, setSelectedPost] = useState<LikedPost | null>(null);
  const [hideLikeCounts, setHideLikeCounts] = useState(false);

  useEffect(() => {
    (supabase as any).from("user_privacy_settings").select("hide_like_share_counts").eq("user_id", userId).maybeSingle()
      .then(({ data }: any) => { if (data) setHideLikeCounts(data.hide_like_share_counts ?? false); });
  }, [userId]);

  // Select mode
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [unliking, setUnliking] = useState(false);

  const toggleSelectItem = (likeId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(likeId) ? next.delete(likeId) : next.add(likeId);
      return next;
    });
  };

  const handleUnlikeSelected = async () => {
    if (!selectedIds.size) return;
    setUnliking(true);
    const toUnlike = liked.filter(lp => selectedIds.has(lp.likeId));
    await Promise.all(
      toUnlike.map(lp =>
        supabase.from("post_likes").delete().eq("post_id", lp.post.id).eq("user_id", userId)
      )
    );
    setLiked(prev => prev.filter(lp => !selectedIds.has(lp.likeId)));
    setSelectedIds(new Set());
    setSelectMode(false);
    setUnliking(false);
  };

  const exitSelectMode = () => { setSelectMode(false); setSelectedIds(new Set()); };

  useEffect(() => {
    const fetchLiked = async () => {
      setLoading(true);
      const { data: likes } = await (supabase as any)
        .from("post_likes").select("id, created_at, post_id")
        .eq("user_id", userId).order("created_at", { ascending: false });

      if (!likes?.length) { setLiked([]); setLoading(false); return; }

      const postIds = likes.map((l: any) => l.post_id);
      const { data: posts } = await (supabase as any)
        .from("posts").select("id, content, image_url, video_url, post_type, user_id, created_at, is_archived")
        .in("id", postIds).eq("is_archived", false);

      if (!posts?.length) { setLiked([]); setLoading(false); return; }

      const authorIds = [...new Set(posts.map((p: any) => p.user_id))] as string[];
      const [playerRes, scoutRes] = await Promise.all([
        supabase.from("player_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", authorIds),
        supabase.from("scout_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", authorIds),
      ]);
      const authorMap = new Map<string, { name: string; photo: string | null; role: string }>();
      (playerRes.data || []).forEach((p: any) => authorMap.set(p.user_id, { name: `${p.first_name} ${p.last_name}`.trim(), photo: p.photo_url, role: "player" }));
      (scoutRes.data  || []).forEach((s: any) => { if (!authorMap.has(s.user_id)) authorMap.set(s.user_id, { name: `${s.first_name} ${s.last_name}`.trim(), photo: s.photo_url, role: "scout" }); });

      const postMap = new Map(posts.map((p: any) => [p.id, p]));
      setLiked(
        likes.filter((l: any) => postMap.has(l.post_id)).map((l: any) => {
          const post = postMap.get(l.post_id);
          const a = authorMap.get(post.user_id);
          return { likeId: l.id, likedAt: l.created_at, post, author: a ? { user_id: post.user_id, ...a } : null };
        })
      );
      setLoading(false);
    };
    fetchLiked();
  }, [userId]);

  /* unique authors for sheet */
  const uniqueAuthors = Array.from(
    new Map(liked.filter(lp => lp.author).map(lp => [lp.author!.user_id, lp.author!])).values()
  );

  const filtered = liked
    .filter(lp => {
      if (dateFilter !== "all") {
        const days = dateFilter === "7d" ? 7 : dateFilter === "30d" ? 30 : dateFilter === "3m" ? 90 : 365;
        if (Date.now() - new Date(lp.likedAt).getTime() > days * 86400000) return false;
      }
      if (typeFilter === "image" && !lp.post.image_url) return false;
      if (typeFilter === "video" && !lp.post.video_url) return false;
      if (typeFilter === "text" && (lp.post.image_url || lp.post.video_url)) return false;
      if (authorId && lp.author?.user_id !== authorId) return false;
      return true;
    })
    .sort((a, b) => {
      const d = new Date(a.likedAt).getTime() - new Date(b.likedAt).getTime();
      return sort === "newest" ? -d : d;
    });

  const sortLabel  = SORT_OPTIONS.find(o => o.value === sort)!;
  const dateLabel  = DATE_OPTIONS.find(o => o.value === dateFilter)!;
  const typeLabel  = TYPE_OPTIONS.find(o => o.value === typeFilter)!;
  const authorName = authorId ? (uniqueAuthors.find(a => a.user_id === authorId)?.name || "") : null;
  const authorPillLabel = authorName || (lang === "ro" ? "Toți autorii" : "All authors");

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        {selectMode ? (
          <div className="w-6" />
        ) : (
          <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </button>
        )}
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground">
          {lang === "ro" ? "Aprecieri" : "Likes"}
        </h2>
        <div className="ml-auto">
          {selectMode ? (
            <button onClick={exitSelectMode} className="text-sm font-body text-primary hover:opacity-80">
              {lang === "ro" ? "Anulează" : "Cancel"}
            </button>
          ) : (
            <button onClick={() => setSelectMode(true)} className="text-sm font-body text-primary hover:opacity-80">
              {lang === "ro" ? "Selectează" : "Select"}
            </button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2 px-3 py-2.5 border-b border-border overflow-x-auto scrollbar-none shrink-0">
        <Pill label={lang === "ro" ? sortLabel.labelRo : sortLabel.labelEn} active={sort !== "newest"} onClick={() => setSheet("sort")} />
        <Pill label={lang === "ro" ? dateLabel.labelRo : dateLabel.labelEn} active={dateFilter !== "all"} onClick={() => setSheet("date")} />
        <Pill label={lang === "ro" ? typeLabel.labelRo : typeLabel.labelEn} active={typeFilter !== "all"} onClick={() => setSheet("type")} />
        <Pill label={authorPillLabel} active={!!authorId} onClick={() => setSheet("author")} />
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <p className="text-sm text-muted-foreground font-body">{lang === "ro" ? "Nicio postare găsită." : "No posts found."}</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-0.5">
            {filtered.map(lp => {
              const isSelected = selectedIds.has(lp.likeId);
              return (
                <button
                  key={lp.likeId}
                  onClick={() => selectMode ? toggleSelectItem(lp.likeId) : setSelectedPost(lp)}
                  className={`aspect-square overflow-hidden bg-muted relative ${isSelected ? "opacity-80" : ""}`}
                >
                  {lp.post.image_url ? (
                    <img src={lp.post.image_url} alt="" className="w-full h-full object-cover hover:opacity-90 transition-opacity" />
                  ) : lp.post.video_url ? (
                    <div className="w-full h-full bg-muted/60 flex items-center justify-center"><Video className="h-6 w-6 text-white/80" /></div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center p-2 bg-muted/40">
                      <p className="text-[10px] text-muted-foreground font-body text-center line-clamp-4">{lp.post.content}</p>
                    </div>
                  )}
                  {lp.author?.photo && !selectMode && (
                    <div className="absolute bottom-1 left-1 w-5 h-5 rounded-full overflow-hidden border border-white/30">
                      <img src={lp.author.photo} alt="" className="w-full h-full object-cover" />
                    </div>
                  )}
                  {/* Select circle */}
                  {selectMode && (
                    <div className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSelected ? "bg-primary border-primary" : "bg-black/30 border-white/70"}`}>
                      {isSelected && (
                        <svg viewBox="0 0 12 12" className="w-3.5 h-3.5 fill-none stroke-white stroke-2">
                          <polyline points="2,6 5,9 10,3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Unlike bottom bar */}
      {selectMode && (
        <div className="shrink-0 border-t border-border px-4 py-3 bg-background">
          <button
            onClick={handleUnlikeSelected}
            disabled={selectedIds.size === 0 || unliking}
            className="w-full py-3 text-sm font-semibold font-body text-destructive disabled:opacity-40 transition-opacity"
          >
            {unliking
              ? (lang === "ro" ? "Se procesează..." : "Processing...")
              : selectedIds.size > 0
                ? `${lang === "ro" ? "Elimină aprecierea" : "Unlike"} (${selectedIds.size})`
                : (lang === "ro" ? "Elimină aprecierea" : "Unlike")}
          </button>
        </div>
      )}

      {/* Sheets */}
      {sheet === "sort" && <RadioSheet title={lang === "ro" ? "Sortează după" : "Sort by"} options={SORT_OPTIONS} value={sort} onChange={setSort} onClose={() => setSheet(null)} lang={lang} />}
      {sheet === "date" && <RadioSheet title={lang === "ro" ? "Dată" : "Date"} options={DATE_OPTIONS} value={dateFilter} onChange={setDateFilter} onClose={() => setSheet(null)} lang={lang} />}
      {sheet === "type" && <RadioSheet title={lang === "ro" ? "Tip conținut" : "Content type"} options={TYPE_OPTIONS} value={typeFilter} onChange={setTypeFilter} onClose={() => setSheet(null)} lang={lang} />}
      {sheet === "author" && (
        <AuthorSheet
          authors={uniqueAuthors}
          selectedId={authorId}
          onApply={setAuthorId}
          onClose={() => setSheet(null)}
          lang={lang}
        />
      )}

      {/* Post preview */}
      {selectedPost && (
        <Dialog open={!!selectedPost} onOpenChange={(v) => { if (!v) setSelectedPost(null); }}>
          <DialogContent className="max-w-sm p-0 overflow-hidden">
            <DialogHeader className="sr-only"><DialogTitle>Post</DialogTitle></DialogHeader>
            <div className="overflow-y-auto max-h-[85vh]">
              <PostCard
                post={{
                  id: selectedPost.post.id, content: selectedPost.post.content,
                  image_url: selectedPost.post.image_url, video_url: selectedPost.post.video_url,
                  post_type: selectedPost.post.post_type, user_id: selectedPost.post.user_id,
                  created_at: selectedPost.post.created_at, likes_count: 0, liked_by_me: true,
                  author_name: selectedPost.author?.name || "",
                  author_photo: selectedPost.author?.photo || null,
                  author_role: selectedPost.author?.role || "player",
                }}
                author={{ user_id: selectedPost.post.user_id, name: selectedPost.author?.name || "", photo: selectedPost.author?.photo || null, role: selectedPost.author?.role || "player" }}
                currentUserId={userId}
                onDelete={() => { setSelectedPost(null); setLiked(prev => prev.filter(l => l.post.id !== selectedPost.post.id)); }}
                onViewProfile={(uid, role) => { setSelectedPost(null); onViewProfile(uid, role); }}
                hideLikeCounts={hideLikeCounts}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
