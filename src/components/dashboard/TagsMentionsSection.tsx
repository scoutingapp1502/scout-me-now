import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, ChevronRight, UserSquare2, Clock, ChevronDown, Search, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";

type TagsVisibility     = "everyone" | "following" | "no_one";
type MentionsVisibility = "everyone" | "following" | "no_one";

interface Config {
  tagsVisibility: TagsVisibility;
  manuallyApproveTags: boolean;
  mentionsVisibility: MentionsVisibility;
}

const DEFAULT_CONFIG: Config = {
  tagsVisibility: "everyone",
  manuallyApproveTags: false,
  mentionsVisibility: "everyone",
};

interface TagsMentionsSectionProps {
  userId: string;
  onBack: () => void;
}

function RadioRow<T extends string>({
  value, current, labelRo, labelEn, lang, onSelect,
}: {
  value: T; current: T; labelRo: string; labelEn: string; lang: string; onSelect: (v: T) => void;
}) {
  return (
    <button onClick={() => onSelect(value)} className="w-full flex items-center justify-between py-3.5 hover:bg-muted/20 transition-colors text-left">
      <span className="text-sm font-body text-foreground">{lang === "ro" ? labelRo : labelEn}</span>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${current === value ? "border-foreground" : "border-muted-foreground/40"}`}>
        {current === value && <div className="w-2.5 h-2.5 rounded-full bg-foreground" />}
      </div>
    </button>
  );
}

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

type SubPage = "review-tags" | "tagged" | "pending-tags" | null;

// ── Review Tags page ──────────────────────────────────────────────────────────
function ReviewTagsPage({ lang, onBack, onNavigate }: { lang: string; onBack: () => void; onNavigate: (p: SubPage) => void }) {
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground">
          {lang === "ro" ? "Etichete" : "Tags"}
        </h2>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="bg-card border-y border-border divide-y divide-border">
          <button onClick={() => onNavigate("tagged")} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
            <UserSquare2 className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="text-sm font-body text-foreground flex-1 text-left">{lang === "ro" ? "Etichetat" : "Tagged"}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
          <button onClick={() => onNavigate("pending-tags")} className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors">
            <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="text-sm font-body text-foreground flex-1 text-left">{lang === "ro" ? "Etichete în așteptare" : "Pending tags"}</span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Shared filter types & options ────────────────────────────────────────────
type TagSortOrder  = "newest" | "oldest";
type TagDateFilter = "all" | "7d" | "30d" | "3m" | "1y";

const TAG_SORT_OPTIONS = [
  { value: "newest" as TagSortOrder, labelRo: "De la nou la vechi", labelEn: "Newest to oldest" },
  { value: "oldest" as TagSortOrder, labelRo: "De la vechi la nou", labelEn: "Oldest to newest" },
];
const TAG_DATE_OPTIONS = [
  { value: "all" as TagDateFilter, labelRo: "Toate datele",     labelEn: "All dates"     },
  { value: "7d"  as TagDateFilter, labelRo: "Ultimele 7 zile",  labelEn: "Last 7 days"   },
  { value: "30d" as TagDateFilter, labelRo: "Ultimele 30 zile", labelEn: "Last 30 days"  },
  { value: "3m"  as TagDateFilter, labelRo: "Ultimele 3 luni",  labelEn: "Last 3 months" },
  { value: "1y"  as TagDateFilter, labelRo: "Ultimul an",       labelEn: "Last year"     },
];

// ── Generic radio bottom sheet ────────────────────────────────────────────────
function RadioSheet<T extends string>({ title, options, value, onChange, onClose, lang }: {
  title: string; options: { value: T; labelRo: string; labelEn: string }[];
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

// ── Author filter bottom sheet ────────────────────────────────────────────────
function TagAuthorSheet({ authors, selectedId, onApply, onClose, lang }: {
  authors: { userId: string; name: string }[];
  selectedId: string | null; onApply: (id: string | null) => void; onClose: () => void; lang: string;
}) {
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<string | null>(selectedId);
  const filtered = authors.filter(a => a.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} />
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[61] w-full max-w-sm bg-background rounded-t-2xl shadow-2xl flex flex-col max-h-[75vh]">
        <div className="flex justify-center pt-3 pb-1 shrink-0"><div className="w-10 h-1 rounded-full bg-border" /></div>
        <div className="flex items-center justify-between px-5 py-3 border-b border-border shrink-0">
          <p className="text-sm font-semibold text-foreground font-body">{lang === "ro" ? "Filtrează după autor" : "Filter by Author"}</p>
          <button onClick={() => setPicked(null)} className="text-sm font-body text-primary hover:opacity-80">{lang === "ro" ? "Resetează" : "Clear"}</button>
        </div>
        <div className="px-4 py-2 shrink-0">
          <div className="flex items-center gap-2 bg-muted rounded-full px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder={lang === "ro" ? "Caută" : "Search"}
              className="flex-1 bg-transparent text-sm outline-none font-body text-foreground placeholder:text-muted-foreground" autoFocus />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map(a => (
            <button key={a.userId} onClick={() => setPicked(p => p === a.userId ? null : a.userId)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors border-b border-border/30 last:border-0">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <User className="h-5 w-5 text-muted-foreground" />
              </div>
              <p className="text-sm font-body text-foreground flex-1 text-left">{a.name}</p>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${picked === a.userId ? "border-foreground" : "border-muted-foreground/40"}`}>
                {picked === a.userId && <div className="w-2.5 h-2.5 rounded-full bg-foreground" />}
              </div>
            </button>
          ))}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8 font-body">{lang === "ro" ? "Niciun rezultat." : "No results."}</p>}
        </div>
        <div className="shrink-0 px-4 py-4 border-t border-border">
          <button onClick={() => { onApply(picked); onClose(); }}
            className="w-full py-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold font-body">
            {lang === "ro" ? "Aplică" : "Apply"}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Filter pill ───────────────────────────────────────────────────────────────
function Pill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-body border transition-colors shrink-0 ${active ? "border-primary text-primary" : "border-border text-foreground hover:bg-muted/40"}`}>
      {label}<ChevronDown className="h-3 w-3" />
    </button>
  );
}

// ── Tagged page ───────────────────────────────────────────────────────────────
interface TaggedPost {
  tagId: string;
  postId: string;
  imageUrl: string | null;
  isVisibleOnProfile: boolean;
  createdAt: string;
  authorName: string;
  authorId: string;
}

function TaggedPage({ userId, lang, onBack }: { userId: string; lang: string; onBack: () => void }) {
  const { toast } = useToast();
  const [allPosts, setAllPosts]     = useState<TaggedPost[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [actioning, setActioning]   = useState(false);
  const [sort, setSort]             = useState<TagSortOrder>("newest");
  const [dateFilter, setDateFilter] = useState<TagDateFilter>("all");
  const [authorId, setAuthorId]     = useState<string | null>(null);
  const [sheet, setSheet]           = useState<"sort" | "date" | "author" | null>(null);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const { data: tags } = await (supabase as any)
      .from("post_tags")
      .select("id, post_id, is_visible_on_profile, created_at, tagged_by_user_id")
      .eq("tagged_user_id", userId)
      .eq("is_hidden", false)
      .eq("is_visible_on_profile", true);

    if (!tags?.length) { setAllPosts([]); setLoading(false); return; }

    const postIds   = tags.map((t: any) => t.post_id);
    const authorIds = [...new Set(tags.map((t: any) => t.tagged_by_user_id))] as string[];

    const [{ data: postsData }, { data: players }, { data: scouts }] = await Promise.all([
      (supabase as any).from("posts").select("id, image_url").in("id", postIds),
      (supabase as any).from("player_profiles").select("user_id, first_name, last_name").in("user_id", authorIds),
      (supabase as any).from("scout_profiles").select("user_id, first_name, last_name").in("user_id", authorIds),
    ]);

    const postMap   = new Map((postsData ?? []).map((p: any) => [p.id, p]));
    const authorMap = new Map<string, string>();
    for (const p of [...(players ?? []), ...(scouts ?? [])])
      if (!authorMap.has(p.user_id)) authorMap.set(p.user_id, `${p.first_name} ${p.last_name}`.trim());

    setAllPosts(tags.map((t: any) => ({
      tagId: t.id, postId: t.post_id,
      imageUrl: postMap.get(t.post_id)?.image_url ?? null,
      isVisibleOnProfile: t.is_visible_on_profile,
      createdAt: t.created_at,
      authorName: authorMap.get(t.tagged_by_user_id) ?? "",
      authorId: t.tagged_by_user_id,
    })));
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const uniqueAuthors = Array.from(
    new Map(allPosts.map(p => [p.authorId, { userId: p.authorId, name: p.authorName }])).values()
  );

  const filtered = allPosts
    .filter(p => {
      if (dateFilter !== "all") {
        const days = dateFilter === "7d" ? 7 : dateFilter === "30d" ? 30 : dateFilter === "3m" ? 90 : 365;
        if (Date.now() - new Date(p.createdAt).getTime() > days * 86400000) return false;
      }
      if (authorId && p.authorId !== authorId) return false;
      return true;
    })
    .sort((a, b) => {
      const d = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      return sort === "newest" ? -d : d;
    });

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const handleRemoveFromProfile = async () => {
    if (!selected.size) return;
    setActioning(true);
    await (supabase as any).from("post_tags").update({ is_visible_on_profile: false }).in("id", [...selected]);
    setActioning(false); setSelectMode(false); setSelected(new Set()); fetchPosts();
    toast({ title: lang === "ro" ? "Eliminate din profil." : "Removed from profile." });
  };

  const handleHide = async () => {
    if (!selected.size) return;
    setActioning(true);
    await (supabase as any).from("post_tags").update({ is_hidden: true }).in("id", [...selected]);
    setActioning(false); setSelectMode(false); setSelected(new Set()); fetchPosts();
    toast({ title: lang === "ro" ? "Ascunse." : "Hidden." });
  };

  const sortLabel   = TAG_SORT_OPTIONS.find(o => o.value === sort)!;
  const dateLabel   = TAG_DATE_OPTIONS.find(o => o.value === dateFilter)!;
  const authorLabel = authorId ? (uniqueAuthors.find(a => a.userId === authorId)?.name ?? "") : (lang === "ro" ? "Toți autorii" : "All authors");

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={selectMode ? () => { setSelectMode(false); setSelected(new Set()); } : onBack}
          className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground">
          {lang === "ro" ? "Etichetat" : "Tagged"}
        </h2>
        <button onClick={() => { setSelectMode(v => !v); setSelected(new Set()); }}
          className="ml-auto text-sm text-primary font-body font-semibold">
          {selectMode ? (lang === "ro" ? "Anulează" : "Cancel") : (lang === "ro" ? "Selectează" : "Select")}
        </button>
      </div>

      {/* Section label + filters */}
      <div className="shrink-0 border-b border-border">
        <p className="text-sm font-semibold font-body text-foreground px-4 pt-3 pb-2">
          {lang === "ro" ? "Vizibil pe profilul tău" : "Visible on your profile"}
        </p>
        <div className="flex gap-2 px-3 pb-2.5 overflow-x-auto scrollbar-none">
          <Pill label={lang === "ro" ? sortLabel.labelRo : sortLabel.labelEn} active={sort !== "newest"} onClick={() => setSheet("sort")} />
          <Pill label={lang === "ro" ? dateLabel.labelRo : dateLabel.labelEn} active={dateFilter !== "all"} onClick={() => setSheet("date")} />
          <Pill label={authorLabel} active={!!authorId} onClick={() => setSheet("author")} />
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground font-body text-center py-16">
            {lang === "ro" ? "Nicio postare etichetată." : "No tagged posts."}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-0.5">
            {filtered.map(p => {
              const isSel = selected.has(p.tagId);
              return (
                <button key={p.tagId} onClick={() => selectMode && toggleSelect(p.tagId)}
                  className="relative aspect-square bg-muted overflow-hidden">
                  {p.imageUrl
                    ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-muted-foreground/20" />}
                  {selectMode && (
                    <div className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSel ? "bg-primary border-primary" : "bg-black/30 border-white/70"}`}>
                      {isSel && <svg viewBox="0 0 12 12" className="w-3.5 h-3.5 fill-none stroke-white stroke-2"><polyline points="2,6 5,9 10,3" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Select mode action bar */}
      {selectMode && (
        <div className="shrink-0 border-t border-border bg-card px-4 py-3 flex gap-3">
          <button disabled={!selected.size || actioning} onClick={handleRemoveFromProfile}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold font-body text-foreground disabled:opacity-40">
            {lang === "ro" ? "Elimină din profil" : "Remove from profile"}
          </button>
          <button disabled={!selected.size || actioning} onClick={handleHide}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold font-body disabled:opacity-40">
            {lang === "ro" ? "Ascunde" : "Hide"}
          </button>
        </div>
      )}

      {/* Bottom sheets */}
      {sheet === "sort"   && <RadioSheet title={lang === "ro" ? "Sortează după" : "Sort by"} options={TAG_SORT_OPTIONS} value={sort} onChange={setSort} onClose={() => setSheet(null)} lang={lang} />}
      {sheet === "date"   && <RadioSheet title={lang === "ro" ? "Dată" : "Date"} options={TAG_DATE_OPTIONS} value={dateFilter} onChange={setDateFilter} onClose={() => setSheet(null)} lang={lang} />}
      {sheet === "author" && <TagAuthorSheet authors={uniqueAuthors} selectedId={authorId} onApply={setAuthorId} onClose={() => setSheet(null)} lang={lang} />}
    </div>
  );
}

// ── Pending tags page ─────────────────────────────────────────────────────────
function PendingTagsPage({ userId, lang, onBack, onManageTagging }: {
  userId: string; lang: string; onBack: () => void; onManageTagging: () => void;
}) {
  const { toast } = useToast();
  const [posts, setPosts]           = useState<TaggedPost[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected]     = useState<Set<string>>(new Set());
  const [actioning, setActioning]   = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    const { data: tags } = await (supabase as any)
      .from("post_tags")
      .select("id, post_id, created_at, tagged_by_user_id")
      .eq("tagged_user_id", userId)
      .eq("is_hidden", false)
      .eq("is_visible_on_profile", false);

    if (!tags?.length) { setPosts([]); setLoading(false); return; }

    const postIds   = tags.map((t: any) => t.post_id);
    const authorIds = [...new Set(tags.map((t: any) => t.tagged_by_user_id))] as string[];

    const [{ data: postsData }, { data: players }, { data: scouts }] = await Promise.all([
      (supabase as any).from("posts").select("id, image_url").in("id", postIds),
      (supabase as any).from("player_profiles").select("user_id, first_name, last_name").in("user_id", authorIds),
      (supabase as any).from("scout_profiles").select("user_id, first_name, last_name").in("user_id", authorIds),
    ]);

    const postMap   = new Map((postsData ?? []).map((p: any) => [p.id, p]));
    const authorMap = new Map<string, string>();
    for (const p of [...(players ?? []), ...(scouts ?? [])])
      if (!authorMap.has(p.user_id)) authorMap.set(p.user_id, `${p.first_name} ${p.last_name}`.trim());

    setPosts(tags.map((t: any) => ({
      tagId: t.id, postId: t.post_id,
      imageUrl: postMap.get(t.post_id)?.image_url ?? null,
      isVisibleOnProfile: false,
      createdAt: t.created_at,
      authorName: authorMap.get(t.tagged_by_user_id) ?? "",
      authorId: t.tagged_by_user_id,
    })).sort((a: TaggedPost, b: TaggedPost) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    setLoading(false);
  }, [userId]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  const toggleSelect = (id: string) => setSelected(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next;
  });

  const handleApprove = async () => {
    if (!selected.size) return;
    setActioning(true);
    await (supabase as any).from("post_tags").update({ is_visible_on_profile: true }).in("id", [...selected]);
    setActioning(false); setSelectMode(false); setSelected(new Set()); fetchPosts();
    toast({ title: lang === "ro" ? "Etichete aprobate." : "Tags approved." });
  };

  const handleHide = async () => {
    if (!selected.size) return;
    setActioning(true);
    await (supabase as any).from("post_tags").update({ is_hidden: true }).in("id", [...selected]);
    setActioning(false); setSelectMode(false); setSelected(new Set()); fetchPosts();
    toast({ title: lang === "ro" ? "Ascunse." : "Hidden." });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={selectMode ? () => { setSelectMode(false); setSelected(new Set()); } : onBack}
          className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground">
          {lang === "ro" ? "Etichete în așteptare" : "Pending tags"}
        </h2>
        <button onClick={() => { setSelectMode(v => !v); setSelected(new Set()); }}
          className="ml-auto text-sm text-primary font-body font-semibold">
          {selectMode ? (lang === "ro" ? "Anulează" : "Cancel") : (lang === "ro" ? "Selectează" : "Select")}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Description */}
        <div className="px-5 pt-5 pb-4 text-center border-b border-border">
          <p className="text-sm text-muted-foreground font-body leading-relaxed">
            {lang === "ro"
              ? "Aceste etichete nu vor apărea pe profilul tău până nu le aprobi."
              : "These tags won't appear on your profile until you've approved them."}
          </p>
          <button onClick={onManageTagging} className="text-sm text-primary font-body font-semibold mt-2">
            {lang === "ro" ? "Gestionează cine te poate eticheta" : "Manage who can tag you"}
          </button>
        </div>

        {/* Grid */}
        {loading ? (
          <div className="flex justify-center py-16"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
        ) : posts.length === 0 ? (
          <p className="text-sm text-muted-foreground font-body text-center py-16">
            {lang === "ro" ? "Nicio etichetă în așteptare." : "No pending tags."}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-0.5 mt-0.5">
            {posts.map(p => {
              const isSel = selected.has(p.tagId);
              return (
                <button key={p.tagId} onClick={() => selectMode && toggleSelect(p.tagId)}
                  className="relative aspect-square bg-muted overflow-hidden">
                  {p.imageUrl
                    ? <img src={p.imageUrl} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full bg-muted-foreground/20" />}
                  {selectMode && (
                    <div className={`absolute top-1.5 right-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${isSel ? "bg-primary border-primary" : "bg-black/30 border-white/70"}`}>
                      {isSel && <svg viewBox="0 0 12 12" className="w-3.5 h-3.5 fill-none stroke-white stroke-2"><polyline points="2,6 5,9 10,3" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Select mode action bar */}
      {selectMode && (
        <div className="shrink-0 border-t border-border bg-card px-4 py-3 flex gap-3">
          <button disabled={!selected.size || actioning} onClick={handleApprove}
            className="flex-1 py-2.5 rounded-xl border border-border text-sm font-semibold font-body text-foreground disabled:opacity-40">
            {lang === "ro" ? "Aprobă" : "Approve"}
          </button>
          <button disabled={!selected.size || actioning} onClick={handleHide}
            className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold font-body disabled:opacity-40">
            {lang === "ro" ? "Ascunde" : "Hide"}
          </button>
        </div>
      )}
    </div>
  );
}

export default function TagsMentionsSection({ userId, onBack }: TagsMentionsSectionProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);
  const [subPage, setSubPage] = useState<SubPage>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase as any)
        .from("user_privacy_settings")
        .select("tags_visibility, manually_approve_tags, mentions_visibility")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) {
        setConfig({
          tagsVisibility: data.tags_visibility ?? "everyone",
          manuallyApproveTags: data.manually_approve_tags ?? false,
          mentionsVisibility: data.mentions_visibility ?? "everyone",
        });
      }
    };
    load();
  }, [userId]);

  const save = async (patch: Partial<Config>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    setSaving(true);
    const { error } = await (supabase as any)
      .from("user_privacy_settings")
      .upsert({
        user_id: userId,
        tags_visibility: next.tagsVisibility,
        manually_approve_tags: next.manuallyApproveTags,
        mentions_visibility: next.mentionsVisibility,
        updated_at: new Date().toISOString(),
      });
    setSaving(false);
    if (error) toast({ title: lang === "ro" ? "Eroare la salvare." : "Save error.", variant: "destructive" });
  };

  if (subPage === "review-tags")  return <ReviewTagsPage lang={lang} onBack={() => setSubPage(null)} onNavigate={setSubPage} />;
  if (subPage === "tagged")       return <TaggedPage userId={userId} lang={lang} onBack={() => setSubPage("review-tags")} />;
  if (subPage === "pending-tags") return <PendingTagsPage userId={userId} lang={lang} onBack={() => setSubPage("review-tags")} onManageTagging={() => setSubPage(null)} />;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground whitespace-nowrap">
          {lang === "ro" ? "Etichete și mențiuni" : "Tags and mentions"}
        </h2>
        {saving && <div className="ml-auto w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Who can tag you ── */}
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 pt-5 pb-2 font-body">
          {lang === "ro" ? "Cine te poate eticheta" : "Who can tag you"}
        </p>
        <div className="bg-card border-y border-border px-5 divide-y divide-border/60">
          <RadioRow value="everyone"  current={config.tagsVisibility} labelRo="Permite etichete de la toată lumea"          labelEn="Allow tags from everyone"               lang={lang} onSelect={v => save({ tagsVisibility: v })} />
          <RadioRow value="following" current={config.tagsVisibility} labelRo="Permite etichete de la persoane urmărite"    labelEn="Allow tags from people that you follow"  lang={lang} onSelect={v => save({ tagsVisibility: v })} />
          <RadioRow value="no_one"    current={config.tagsVisibility} labelRo="Nu permite etichete"                         labelEn="Don't allow tags"                        lang={lang} onSelect={v => save({ tagsVisibility: v })} />
        </div>
        <p className="text-xs text-muted-foreground font-body px-5 py-3 leading-relaxed border-b border-border">
          {lang === "ro"
            ? "Alege cine te poate eticheta în fotografii și reels. Când cineva încearcă să te eticheteze, va vedea dacă nu permiți etichete de la toată lumea. Spam-ul potențial va fi întotdeauna filtrat."
            : "Choose who can tag you in their photos and reels. When people try to tag you, they'll see if you don't allow tags from everyone. Potential spam will always be filtered."}
        </p>

        {/* ── How you manage tags ── */}
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 pt-5 pb-2 font-body">
          {lang === "ro" ? "Cum gestionezi etichetele" : "How you manage tags"}
        </p>
        <div className="bg-card border-y border-border divide-y divide-border/60">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-sm font-body text-foreground">
              {lang === "ro" ? "Aprobă manual etichetele" : "Manually approve tags"}
            </span>
            <Toggle on={config.manuallyApproveTags} onToggle={() => save({ manuallyApproveTags: !config.manuallyApproveTags })} />
          </div>
          <button onClick={() => setSubPage("review-tags")} className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
            <span className="text-sm font-body text-foreground">
              {lang === "ro" ? "Revizuiește etichetele" : "Review tags"}
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>

        {/* ── Who can @mention you ── */}
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 pt-5 pb-2 font-body">
          {lang === "ro" ? "Cine te poate @menționa" : "Who can @mention you"}
        </p>
        <div className="bg-card border-y border-border px-5 divide-y divide-border/60">
          <RadioRow value="everyone"  current={config.mentionsVisibility} labelRo="Permite mențiuni de la toată lumea"           labelEn="Allow mentions from everyone"              lang={lang} onSelect={v => save({ mentionsVisibility: v })} />
          <RadioRow value="following" current={config.mentionsVisibility} labelRo="Permite mențiuni de la persoane urmărite"     labelEn="Allow mentions from people you follow"     lang={lang} onSelect={v => save({ mentionsVisibility: v })} />
          <RadioRow value="no_one"    current={config.mentionsVisibility} labelRo="Nu permite mențiuni"                          labelEn="Don't allow mentions"                      lang={lang} onSelect={v => save({ mentionsVisibility: v })} />
        </div>
        <p className="text-xs text-muted-foreground font-body px-5 py-3 leading-relaxed pb-10">
          {lang === "ro"
            ? "Alege cine te poate @menționa pentru a-ți lega profilul în story-uri, note, comentarii, videoclipuri live, bio și descrieri. Când cineva încearcă să te @menționeze, va vedea dacă nu permiți @mențiuni."
            : "Choose who can @mention you to link your profile in their stories, notes, comments, live videos, bio and captions. When people try to @mention you, they'll see if you don't allow @mentions."}
        </p>
      </div>
    </div>
  );
}
