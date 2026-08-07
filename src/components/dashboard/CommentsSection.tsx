import { useState, useEffect, useRef } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type PostsVisibility    = "everyone" | "following" | "followers" | "following_and_followers" | "no_one";
type HideUnwanted       = "off" | "some" | "more";

interface Config {
  postsVisibility: PostsVisibility;
  hideUnwanted: HideUnwanted;
}

const DEFAULT_CONFIG: Config = { postsVisibility: "everyone", hideUnwanted: "some" };

interface CommentsSectionProps {
  userId: string;
  onBack: () => void;
}

type SubPage = "block-commenters" | "posts-visibility" | "hide-unwanted" | null;

// ── Posts visibility sub-page (with follower/following counts) ────────────────
function PostsVisibilityPage({ userId, lang, value, onSelect, onBack, saving }: {
  userId: string; lang: string; value: PostsVisibility;
  onSelect: (v: PostsVisibility) => void; onBack: () => void; saving: boolean;
}) {
  const [followingCount, setFollowingCount] = useState<number | null>(null);
  const [followersCount, setFollowersCount] = useState<number | null>(null);
  const [combinedCount, setCombinedCount]   = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      const [{ count: following }, { count: followers }, { data: mutual }] = await Promise.all([
        (supabase as any).from("follows").select("id", { count: "exact", head: true }).eq("follower_id", userId),
        (supabase as any).from("follows").select("id", { count: "exact", head: true }).eq("following_id", userId),
        (supabase as any).from("follows").select("following_id").eq("follower_id", userId),
      ]);
      const f1 = following ?? 0;
      const f2 = followers ?? 0;
      const mutualSet = new Set((mutual ?? []).map((r: any) => r.following_id));
      const { data: followerIds } = await (supabase as any).from("follows").select("follower_id").eq("following_id", userId);
      const allIds = new Set([...(mutual ?? []).map((r: any) => r.following_id), ...(followerIds ?? []).map((r: any) => r.follower_id)]);
      setFollowingCount(f1);
      setFollowersCount(f2);
      setCombinedCount(allIds.size);
    };
    load();
  }, [userId]);

  const options: { value: PostsVisibility; labelRo: string; labelEn: string; count?: number | null }[] = [
    { value: "everyone",                labelRo: "Toată lumea",                               labelEn: "Everyone" },
    { value: "following",               labelRo: "Persoane pe care le urmărești",              labelEn: "People you follow",                    count: followingCount },
    { value: "followers",               labelRo: "Urmăritorii tăi",                           labelEn: "Your followers",                       count: followersCount },
    { value: "following_and_followers", labelRo: "Persoane urmărite și urmăritorii tăi",      labelEn: "People you follow and your followers", count: combinedCount },
    { value: "no_one",                  labelRo: "Dezactivat",                                labelEn: "Off" },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground whitespace-nowrap">
          {lang === "ro" ? "Permite comentarii de la" : "Allow comments from"}
        </h2>
        {saving && <div className="ml-auto w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />}
      </div>
      <div className="flex-1 overflow-y-auto px-5">
        <p className="text-xs text-muted-foreground font-body pt-5 pb-4 leading-relaxed">
          {lang === "ro" ? "Această setare se va aplica tuturor postărilor și reels-urilor tale." : "This setting will apply to all of your posts and reels."}
        </p>
        <div className="divide-y divide-border/60">
          {options.map(o => (
            <button key={o.value} onClick={() => onSelect(o.value)} className="w-full flex items-center justify-between py-3.5 hover:bg-muted/20 transition-colors text-left">
              <div className="flex flex-col">
                <span className="text-sm font-body text-foreground">{lang === "ro" ? o.labelRo : o.labelEn}</span>
                {o.count != null && (
                  <span className="text-xs text-muted-foreground font-body mt-0.5">
                    {o.count} {lang === "ro" ? "persoane" : "people"}
                  </span>
                )}
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ml-3 ${value === o.value ? "border-foreground" : "border-muted-foreground/40"}`}>
                {value === o.value && <div className="w-2.5 h-2.5 rounded-full bg-foreground" />}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Reusable radio row ────────────────────────────────────────────────────────
function RadioRow<T extends string>({ value, current, labelRo, labelEn, lang, onSelect }: { value: T; current: T; labelRo: string; labelEn: string; lang: string; onSelect: (v: T) => void }) {
  return (
    <button onClick={() => onSelect(value)} className="w-full flex items-center justify-between py-3.5 hover:bg-muted/20 transition-colors text-left">
      <span className="text-sm font-body text-foreground">{lang === "ro" ? labelRo : labelEn}</span>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${current === value ? "border-foreground" : "border-muted-foreground/40"}`}>
        {current === value && <div className="w-2.5 h-2.5 rounded-full bg-foreground" />}
      </div>
    </button>
  );
}

// ── Who can comment sub-page ──────────────────────────────────────────────────
function VisibilityPage<T extends string>({
  titleRo, titleEn, descRo, descEn,
  value, options, onSelect, onBack, saving, lang,
}: {
  titleRo: string; titleEn: string; descRo: string; descEn: string;
  value: T; options: { value: T; labelRo: string; labelEn: string }[];
  onSelect: (v: T) => void; onBack: () => void; saving: boolean; lang: string;
}) {
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground whitespace-nowrap">{lang === "ro" ? titleRo : titleEn}</h2>
        {saving && <div className="ml-auto w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />}
      </div>
      <div className="flex-1 overflow-y-auto px-5">
        <p className="text-xs text-muted-foreground font-body pt-5 pb-3 leading-relaxed">{lang === "ro" ? descRo : descEn}</p>
        <div className="divide-y divide-border/60">
          {options.map(o => <RadioRow key={o.value} value={o.value} current={value} labelRo={o.labelRo} labelEn={o.labelEn} lang={lang} onSelect={onSelect} />)}
        </div>
      </div>
    </div>
  );
}

// ── Hide unwanted comments sub-page ──────────────────────────────────────────
function HideUnwantedPage({ lang, value, onSelect, onBack, saving }: {
  lang: string; value: HideUnwanted;
  onSelect: (v: HideUnwanted) => void; onBack: () => void; saving: boolean;
}) {
  const options: { value: HideUnwanted; labelRo: string; labelEn: string; descRo: string; descEn: string }[] = [
    { value: "off",  labelRo: "Niciuna",     labelEn: "None", descRo: "Este posibil să vezi comentarii nedorite.",                          descEn: "You might see unwanted comments." },
    { value: "some", labelRo: "Unele",       labelEn: "Some", descRo: "Vom ascunde comentariile care pot fi ofensatoare sau spam.",          descEn: "We'll hide comments that may be offensive or spam." },
    { value: "more", labelRo: "Mai multe",   labelEn: "More", descRo: "Vom ascunde și mai multe comentarii care îndeplinesc criteriile noastre.", descEn: "We'll hide even more comments that meet our criteria." },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground whitespace-nowrap">
          {lang === "ro" ? "Ascunde comentarii nedorite" : "Hide unwanted comments"}
        </h2>
        {saving && <div className="ml-auto w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />}
      </div>

      <div className="flex-1 overflow-y-auto px-5">
        {/* Intro */}
        <p className="text-sm text-muted-foreground font-body pt-5 pb-5 leading-relaxed border-b border-border">
          {lang === "ro"
            ? "Controlează volumul de comentarii potențial ofensatoare sau spam pe care le vezi la toate postările și reels-urile tale. Oricine le poate vedea și le poți afișa din nou oricând."
            : "Control the amount of potentially offensive or spam comments that you see on all of your posts and reels. Anyone can see these comments and you can unhide them at any time."}
        </p>

        {/* Section header */}
        <p className="text-sm font-body text-foreground pt-5 pb-3">
          {lang === "ro" ? "Alege volumul de comentarii de ascuns:" : "Choose the amount of comments to hide:"}
        </p>

        {/* Options */}
        <div className="space-y-1">
          {options.map(o => (
            <button key={o.value} onClick={() => onSelect(o.value)} className="w-full flex items-start justify-between py-3 hover:bg-muted/20 transition-colors text-left gap-3">
              <div className="flex flex-col flex-1">
                <span className="text-sm font-semibold font-body text-foreground">{lang === "ro" ? o.labelRo : o.labelEn}</span>
                <span className="text-sm text-muted-foreground font-body mt-0.5 leading-snug">{lang === "ro" ? o.descRo : o.descEn}</span>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${value === o.value ? "border-foreground" : "border-muted-foreground/40"}`}>
                {value === o.value && <div className="w-2.5 h-2.5 rounded-full bg-foreground" />}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Block commenters sub-page ─────────────────────────────────────────────────
function BlockCommentersPage({ userId, lang, onBack }: { userId: string; lang: string; onBack: () => void }) {
  const { toast } = useToast();
  const [blocked, setBlocked] = useState<{ id: string; userId: string; name: string; photo: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchBlocked = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("blocked_commenters").select("id, blocked_id").eq("blocker_id", userId);
    if (!data?.length) { setBlocked([]); setLoading(false); return; }
    const ids = data.map((d: any) => d.blocked_id);
    const [{ data: players }, { data: scouts }] = await Promise.all([
      (supabase as any).from("player_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", ids),
      (supabase as any).from("scout_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", ids),
    ]);
    const pMap = new Map<string, any>();
    for (const p of [...(players ?? []), ...(scouts ?? [])]) if (!pMap.has(p.user_id)) pMap.set(p.user_id, p);
    setBlocked(data.map((d: any) => {
      const p = pMap.get(d.blocked_id);
      return { id: d.id, userId: d.blocked_id, name: `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim(), photo: p?.photo_url ?? null };
    }));
    setLoading(false);
  };

  useEffect(() => { fetchBlocked(); }, [userId]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const orFilter = `first_name.ilike.%${query.trim()}%,last_name.ilike.%${query.trim()}%`;
      const [{ data: p }, { data: s }] = await Promise.all([
        (supabase as any).from("player_profiles").select("user_id, first_name, last_name, photo_url").or(orFilter).neq("user_id", userId).limit(10),
        (supabase as any).from("scout_profiles").select("user_id, first_name, last_name, photo_url").or(orFilter).neq("user_id", userId).limit(10),
      ]);
      const seen = new Set<string>();
      setResults([...(p ?? []), ...(s ?? [])].filter(x => { if (seen.has(x.user_id)) return false; seen.add(x.user_id); return true; }));
    }, 300);
  }, [query]);

  const handleBlock = async (uid: string, name: string) => {
    const { error } = await (supabase as any).from("blocked_commenters").insert({ blocker_id: userId, blocked_id: uid });
    if (!error || error.code === "23505") { toast({ title: lang === "ro" ? `${name} blocat din comentarii.` : `${name} blocked from commenting.` }); setQuery(""); fetchBlocked(); }
  };

  const handleUnblock = async (id: string, name: string) => {
    await (supabase as any).from("blocked_commenters").delete().eq("id", id);
    setBlocked(prev => prev.filter(b => b.id !== id));
    toast({ title: lang === "ro" ? `${name} deblocat.` : `${name} unblocked.` });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground whitespace-nowrap">{lang === "ro" ? "Blochează comentarii de la" : "Block comments from"}</h2>
      </div>

      {/* Always-visible search input */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder={lang === "ro" ? "Caută după nume..." : "Search by name..."}
          className="w-full bg-muted rounded-xl px-3 py-2.5 text-sm font-body outline-none text-foreground placeholder:text-muted-foreground"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Search results */}
        {query.trim() && results.length > 0 && (
          <div className="border-b border-border">
            {results.map(u => (
              <div key={u.user_id} className="flex items-center gap-3 px-4 py-3 border-b border-border/40 last:border-0">
                <Avatar className="h-10 w-10 shrink-0"><AvatarImage src={u.photo_url ?? undefined} /><AvatarFallback>{(u.first_name || "?")[0]?.toUpperCase()}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0"><p className="text-sm font-semibold font-body text-foreground truncate">{`${u.first_name ?? ""} ${u.last_name ?? ""}`.trim()}</p></div>
                <button onClick={() => handleBlock(u.user_id, `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim())} className="px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold shrink-0">{lang === "ro" ? "Blochează" : "Block"}</button>
              </div>
            ))}
          </div>
        )}
        {query.trim() && results.length === 0 && (
          <p className="text-sm text-muted-foreground font-body text-center py-8">{lang === "ro" ? "Niciun utilizator găsit." : "No users found."}</p>
        )}

        {/* Blocked list */}
        {!query.trim() && (
          loading
            ? <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
            : blocked.length === 0
              ? <p className="text-sm text-muted-foreground font-body text-center py-12">{lang === "ro" ? "Nicio persoană blocată din comentarii." : "No one blocked from commenting."}</p>
              : <>{blocked.map(u => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
                    <Avatar className="h-11 w-11 shrink-0"><AvatarImage src={u.photo ?? undefined} /><AvatarFallback>{(u.name || "?")[0]?.toUpperCase()}</AvatarFallback></Avatar>
                    <div className="flex-1 min-w-0"><p className="text-sm font-semibold font-body text-foreground truncate">{u.name}</p></div>
                    <button onClick={() => handleUnblock(u.id, u.name)} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold">{lang === "ro" ? "Deblochează" : "Unblock"}</button>
                  </div>
                ))}</>
        )}
      </div>
    </div>
  );
}

// ── Main CommentsSection ──────────────────────────────────────────────────────
export default function CommentsSection({ userId, onBack }: CommentsSectionProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [blockedCount, setBlockedCount] = useState(0);
  const [subPage, setSubPage] = useState<SubPage>(null);
  const [blockCommentersReturn, setBlockCommentersReturn] = useState<SubPage>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const [{ data: privacy }, { count }] = await Promise.all([
        (supabase as any).from("user_privacy_settings").select("posts_comments_visibility, hide_unwanted_comments").eq("user_id", userId).maybeSingle(),
        (supabase as any).from("blocked_commenters").select("id", { count: "exact", head: true }).eq("blocker_id", userId),
      ]);
      if (privacy) setConfig({ postsVisibility: privacy.posts_comments_visibility ?? "everyone", hideUnwanted: privacy.hide_unwanted_comments ?? "some" });
      setBlockedCount(count ?? 0);
    };
    fetch();
  }, [userId, subPage]);

  const save = async (patch: Partial<Config>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    setSaving(true);
    const { error } = await (supabase as any).from("user_privacy_settings").upsert({ user_id: userId, posts_comments_visibility: next.postsVisibility, hide_unwanted_comments: next.hideUnwanted, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) toast({ title: lang === "ro" ? "Eroare la salvare." : "Save error.", variant: "destructive" });
  };

  const POSTS_LABEL_MAP: Record<PostsVisibility, { ro: string; en: string }> = {
    everyone:                { ro: "Toată lumea",   en: "Everyone" },
    following:               { ro: "Urmărești",     en: "Following" },
    followers:               { ro: "Urmăritori",    en: "Followers" },
    following_and_followers: { ro: "Urmărești + urmăritori", en: "Following + followers" },
    no_one:                  { ro: "Dezactivat",    en: "Off" },
  };

  if (subPage === "block-commenters") return <BlockCommentersPage userId={userId} lang={lang} onBack={() => setSubPage(blockCommentersReturn)} />;
  if (subPage === "posts-visibility") return <PostsVisibilityPage userId={userId} lang={lang} value={config.postsVisibility} onSelect={v => { save({ postsVisibility: v }); setSubPage(null); }} onBack={() => setSubPage(null)} saving={saving} />;
  if (subPage === "hide-unwanted") return <HideUnwantedPage lang={lang} value={config.hideUnwanted} onSelect={v => { save({ hideUnwanted: v }); }} onBack={() => setSubPage(null)} saving={saving} />;

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground"><ArrowLeft className="h-5 w-5" /></button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground whitespace-nowrap">{lang === "ro" ? "Comentarii" : "Comments"}</h2>
        {saving && <div className="ml-auto w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Block comments from */}
        <div className="bg-card border-b border-border">
          <button onClick={() => { setBlockCommentersReturn(null); setSubPage("block-commenters"); }} className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
            <span className="text-sm font-body text-foreground">{lang === "ro" ? "Blochează comentarii de la" : "Block comments from"}</span>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground font-body">{blockedCount} {lang === "ro" ? "persoane" : "people"}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
        </div>
        <p className="text-xs text-muted-foreground font-body px-5 py-3 leading-relaxed border-b border-border">
          {lang === "ro"
            ? "Orice comentariu nou de la persoanele blocate nu va fi vizibil decât pentru ele."
            : "Any new comments from people you block won't be visible to anyone but them."}
        </p>

        {/* Who can comment */}
        <div className="px-5 pt-5 pb-2">
          <p className="text-sm font-bold font-body text-foreground">{lang === "ro" ? "Cine poate comenta" : "Who can comment"}</p>
        </div>
        <div className="bg-card border-y border-border divide-y divide-border">
          <button onClick={() => setSubPage("posts-visibility")} className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
            <span className="text-sm font-body text-foreground">{lang === "ro" ? "Postări și reels" : "Posts and reels"}</span>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground font-body">{lang === "ro" ? POSTS_LABEL_MAP[config.postsVisibility].ro : POSTS_LABEL_MAP[config.postsVisibility].en}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
        </div>

        {/* Types of comments */}
        <div className="px-5 pt-5 pb-2">
          <p className="text-sm font-bold font-body text-foreground">{lang === "ro" ? "Tipuri de comentarii" : "Types of comments"}</p>
        </div>
        <div className="bg-card border-y border-border">
          <button onClick={() => setSubPage("hide-unwanted")} className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
            <span className="text-sm font-body text-foreground">{lang === "ro" ? "Ascunde comentarii nedorite" : "Hide unwanted comments"}</span>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground font-body">{{off:"Niciuna",some:"Unele",more:"Mai multe"}[config.hideUnwanted]}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
        </div>
        <p className="text-xs text-muted-foreground font-body px-5 py-3 leading-relaxed">
          {lang === "ro"
            ? "SportRise va muta automat comentariile care pot fi ofensatoare sau spam în secțiunea de comentarii ascunse."
            : "SportRise will automatically move comments that may be offensive or spam to the hidden comments section at the bottom of your comments."}
        </p>
      </div>
    </div>
  );
}
