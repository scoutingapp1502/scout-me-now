import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Search, AtSign, EyeOff, MessageCircle, BellOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface RestrictedSectionProps {
  currentUserId: string;
  onBack: () => void;
}

interface RestrictedUser {
  id: string;
  userId: string;
  name: string;
  username: string;
  photo: string | null;
}

// ── "How restrict works" bottom sheet ────────────────────────────────────────
function HowRestrictWorksSheet({ lang, onClose }: { lang: string; onClose: () => void }) {
  const items = [
    {
      icon: AtSign,
      ro: "Nu te vor putea eticheta, menționa sau nu vor mai putea interacționa cu tine în moduri nedorite.",
      en: "They won't be able to tag you, mention you or otherwise interact with you in unwanted ways.",
    },
    {
      icon: EyeOff,
      ro: "Nu vor vedea când ești online sau când le-ai citit mesajele. Mesajele lor vor fi mutate în solicitări.",
      en: "They won't see when you're online or when you've read their messages. Their messages will be moved to requests.",
    },
    {
      icon: MessageCircle,
      ro: "Doar tu și ei vor putea vedea comentariile lor noi la postările tale.",
      en: "Only you and they will be able to see their new comments on your posts.",
    },
    {
      icon: BellOff,
      ro: "Nu îi vom anunța că i-ai restricționat.",
      en: "We won't let them know that you restricted them.",
    },
  ];

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} />
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[61] w-full max-w-sm bg-background rounded-t-2xl shadow-2xl pb-8">
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>
        <p className="text-center text-base font-semibold font-heading text-foreground py-3 border-b border-border">
          {lang === "ro" ? "Cum funcționează restricția" : "How restrict works"}
        </p>
        <div className="divide-y divide-border/40">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="flex items-start gap-4 px-5 py-4">
                <Icon className="h-5 w-5 text-foreground shrink-0 mt-0.5" />
                <p className="text-sm font-body text-foreground leading-relaxed">
                  {lang === "ro" ? item.ro : item.en}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

// ── Main RestrictedSection ────────────────────────────────────────────────────
export default function RestrictedSection({ currentUserId, onBack }: RestrictedSectionProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [restricted, setRestricted] = useState<RestrictedUser[]>([]);
  const [loading, setLoading]       = useState(true);
  const [query, setQuery]           = useState("");
  const [results, setResults]       = useState<any[]>([]);
  const [showSheet, setShowSheet]   = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRestricted = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("restricted_accounts")
      .select("id, restricted_id")
      .eq("restrictor_id", currentUserId);

    if (!data?.length) { setRestricted([]); setLoading(false); return; }

    const ids = data.map((d: any) => d.restricted_id);
    const [{ data: players }, { data: scouts }] = await Promise.all([
      (supabase as any).from("player_profiles").select("user_id, first_name, last_name, username, photo_url").in("user_id", ids),
      (supabase as any).from("scout_profiles").select("user_id, first_name, last_name, username, photo_url").in("user_id", ids),
    ]);
    const pMap = new Map<string, any>();
    for (const p of [...(players ?? []), ...(scouts ?? [])]) if (!pMap.has(p.user_id)) pMap.set(p.user_id, p);

    setRestricted(data.map((d: any) => {
      const p = pMap.get(d.restricted_id);
      return {
        id: d.id,
        userId: d.restricted_id,
        name: `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim(),
        username: p?.username ?? "",
        photo: p?.photo_url ?? null,
      };
    }));
    setLoading(false);
  };

  useEffect(() => { fetchRestricted(); }, [currentUserId]);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const [{ data: p }, { data: s }] = await Promise.all([
        (supabase as any).from("player_profiles").select("user_id, first_name, last_name, username, photo_url").ilike("username", `%${query.trim()}%`).neq("user_id", currentUserId).limit(10),
        (supabase as any).from("scout_profiles").select("user_id, first_name, last_name, username, photo_url").ilike("username", `%${query.trim()}%`).neq("user_id", currentUserId).limit(10),
      ]);
      const seen = new Set<string>();
      setResults([...(p ?? []), ...(s ?? [])].filter(x => { if (seen.has(x.user_id)) return false; seen.add(x.user_id); return true; }));
    }, 300);
  }, [query]);

  const handleRestrict = async (uid: string, username: string) => {
    const { error } = await (supabase as any)
      .from("restricted_accounts")
      .insert({ restrictor_id: currentUserId, restricted_id: uid });
    if (!error || error.code === "23505") {
      toast({ title: lang === "ro" ? `@${username} restricționat.` : `@${username} restricted.` });
      setQuery("");
      fetchRestricted();
    }
  };

  const handleUnrestrict = async (id: string, username: string) => {
    await (supabase as any).from("restricted_accounts").delete().eq("id", id);
    setRestricted(prev => prev.filter(r => r.id !== id));
    toast({ title: lang === "ro" ? `@${username} derestrictionat.` : `@${username} unrestricted.` });
  };

  const isRestricted = (uid: string) => restricted.some(r => r.userId === uid);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground whitespace-nowrap">
          {lang === "ro" ? "Conturi restricționate" : "Restricted accounts"}
        </h2>
      </div>

      {/* Description */}
      <div className="px-5 py-4 border-b border-border shrink-0 text-center">
        <p className="text-sm text-muted-foreground font-body leading-relaxed">
          {lang === "ro"
            ? "Limitează interacțiunile cuiva fără a-l bloca sau de-urma."
            : "Limit interactions from someone without having to block or unfollow them."}
          {" "}
          <button onClick={() => setShowSheet(true)} className="text-primary font-body font-medium">
            {lang === "ro" ? "Află cum funcționează" : "Learn how it works"}
          </button>
        </p>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={lang === "ro" ? "Caută" : "Search"}
            className="flex-1 bg-transparent text-sm font-body outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Search results */}
        {query.trim() && results.length > 0 && (
          <div className="border-b border-border">
            {results.map(u => (
              <div key={u.user_id} className="flex items-center gap-3 px-4 py-3 border-b border-border/40 last:border-0">
                <Avatar className="h-10 w-10 shrink-0">
                  <AvatarImage src={u.photo_url ?? undefined} />
                  <AvatarFallback>{(u.username || "?")[0]?.toUpperCase()}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold font-body text-foreground truncate">{u.username}</p>
                  {u.first_name && <p className="text-xs text-muted-foreground font-body truncate">{`${u.first_name} ${u.last_name}`.trim()}</p>}
                </div>
                {isRestricted(u.user_id) ? (
                  <span className="px-3 py-1.5 text-xs font-semibold font-body text-muted-foreground border border-border rounded-lg">
                    {lang === "ro" ? "Restricționat" : "Restricted"}
                  </span>
                ) : (
                  <button onClick={() => handleRestrict(u.user_id, u.username)}
                    className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold shrink-0">
                    {lang === "ro" ? "Restricționează" : "Restrict"}
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {query.trim() && results.length === 0 && (
          <p className="text-sm text-muted-foreground font-body text-center py-8">
            {lang === "ro" ? "Niciun utilizator găsit." : "No users found."}
          </p>
        )}

        {/* Restricted list */}
        {!query.trim() && (
          loading
            ? <div className="flex justify-center py-10"><div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
            : restricted.length === 0
              ? <p className="text-sm text-muted-foreground font-body text-center py-16">
                  {lang === "ro" ? "Nu ai restricționat pe nimeni." : "You haven't restricted anyone."}
                </p>
              : <>{restricted.map(u => (
                  <div key={u.id} className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
                    <Avatar className="h-11 w-11 shrink-0">
                      <AvatarImage src={u.photo ?? undefined} />
                      <AvatarFallback>{(u.username || "?")[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold font-body text-foreground truncate">{u.username || u.name}</p>
                      {u.name && u.username && <p className="text-xs text-muted-foreground font-body truncate">{u.name}</p>}
                    </div>
                    <button onClick={() => handleUnrestrict(u.id, u.username)}
                      className="px-3 py-1.5 rounded-lg border border-border text-sm font-semibold font-body text-foreground shrink-0">
                      {lang === "ro" ? "Derestrictionează" : "Unrestrict"}
                    </button>
                  </div>
                ))}</>
        )}
      </div>

      {showSheet && <HowRestrictWorksSheet lang={lang} onClose={() => setShowSheet(false)} />}
    </div>
  );
}
