import { useState, useEffect, useRef } from "react";
import { X, Plus, Search, UserPlus, Star, Lock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface FavouritesSectionProps {
  userId: string;
  onBack: () => void;
}

interface UserProfile {
  id: string;
  userId: string;
  name: string;
  username: string;
  photo: string | null;
}

// ── How Favourites Works sheet ────────────────────────────────────────────────
function HowFavouritesWorksSheet({ lang, onClose }: { lang: string; onClose: () => void }) {
  const items = [
    {
      icon: UserPlus,
      titleRo: "Adaugă conturi la lista ta de Favorite",
      titleEn: "Add accounts to your Favourites list",
      descRo: "Poți căuta conturi sau vizualiza sugestii pe baza activității tale.",
      descEn: "You can search for accounts or view suggestions based on your activity.",
    },
    {
      icon: Star,
      titleRo: "Vezi favoriții mai sus în feed",
      titleEn: "See favourites higher in your feed",
      descRo: "Postările noi de la favoriții tăi vor apărea mai sus în feed pentru a nu rata nimic.",
      descEn: "New posts from your favourites will appear higher in feed so that you don't miss out.",
    },
    {
      icon: Lock,
      titleRo: "Doar tu poți vedea cine este pe lista ta",
      titleEn: "Only you can see who is on your list",
      descRo: "Favoriții tăi nu vor fi notificați când îi adaugi sau îi elimini.",
      descEn: "Your favourites won't be notified when you add or remove them.",
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
          {lang === "ro" ? "Cum funcționează Favorite" : "How Favourites works"}
        </p>
        <div className="px-5 pt-2 space-y-5 pb-2">
          {items.map((item, i) => {
            const Icon = item.icon;
            return (
              <div key={i} className="flex items-start gap-4 pt-3">
                <Icon className="h-6 w-6 text-foreground shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold font-body text-foreground leading-snug">
                    {lang === "ro" ? item.titleRo : item.titleEn}
                  </p>
                  <p className="text-sm text-muted-foreground font-body leading-relaxed mt-0.5">
                    {lang === "ro" ? item.descRo : item.descEn}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}

export default function FavouritesSection({ userId, onBack }: FavouritesSectionProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [favourites, setFavourites] = useState<UserProfile[]>([]);
  const [suggested, setSuggested]   = useState<UserProfile[]>([]);
  const [loading, setLoading]       = useState(true);
  const [query, setQuery]           = useState("");
  const [searchResults, setSearchResults] = useState<UserProfile[]>([]);
  const [showSheet, setShowSheet]   = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = async () => {
    setLoading(true);

    // Fetch favourites
    const { data: favRows } = await (supabase as any)
      .from("user_favourites")
      .select("id, favourite_user_id")
      .eq("user_id", userId);

    // Fetch people I follow (for suggested)
    const { data: followRows } = await (supabase as any)
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId);

    const favIds     = (favRows ?? []).map((r: any) => r.favourite_user_id) as string[];
    const followIds  = (followRows ?? []).map((r: any) => r.following_id) as string[];
    const suggestIds = followIds.filter(id => !favIds.includes(id) && id !== userId);

    const allIds = [...new Set([...favIds, ...suggestIds])];
    if (!allIds.length) { setFavourites([]); setSuggested([]); setLoading(false); return; }

    const [{ data: players }, { data: scouts }] = await Promise.all([
      (supabase as any).from("player_profiles").select("user_id, first_name, last_name, username, photo_url").in("user_id", allIds),
      (supabase as any).from("scout_profiles").select("user_id, first_name, last_name, username, photo_url").in("user_id", allIds),
    ]);

    const pMap = new Map<string, any>();
    for (const p of [...(players ?? []), ...(scouts ?? [])]) if (!pMap.has(p.user_id)) pMap.set(p.user_id, p);

    const toProfile = (uid: string, rowId?: string): UserProfile => {
      const p = pMap.get(uid);
      return {
        id: rowId ?? uid,
        userId: uid,
        name: `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim(),
        username: p?.username ?? "",
        photo: p?.photo_url ?? null,
      };
    };

    setFavourites((favRows ?? []).map((r: any) => toProfile(r.favourite_user_id, r.id)));
    setSuggested(suggestIds.slice(0, 20).map(id => toProfile(id)));
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [userId]);

  // Search debounce
  useEffect(() => {
    if (!query.trim()) { setSearchResults([]); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      const [{ data: p }, { data: s }] = await Promise.all([
        (supabase as any).from("player_profiles").select("user_id, first_name, last_name, username, photo_url").ilike("username", `%${query.trim()}%`).neq("user_id", userId).limit(10),
        (supabase as any).from("scout_profiles").select("user_id, first_name, last_name, username, photo_url").ilike("username", `%${query.trim()}%`).neq("user_id", userId).limit(10),
      ]);
      const seen = new Set<string>();
      const results = [...(p ?? []), ...(s ?? [])].filter(x => {
        if (seen.has(x.user_id)) return false; seen.add(x.user_id); return true;
      });
      setSearchResults(results.map(u => ({
        id: u.user_id, userId: u.user_id,
        name: `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim(),
        username: u.username ?? "",
        photo: u.photo_url ?? null,
      })));
    }, 300);
  }, [query]);

  const isFavourite = (uid: string) => favourites.some(f => f.userId === uid);

  const handleAdd = async (u: UserProfile) => {
    const { error } = await (supabase as any)
      .from("user_favourites")
      .insert({ user_id: userId, favourite_user_id: u.userId });
    if (!error || error.code === "23505") {
      toast({ title: lang === "ro" ? `@${u.username} adăugat la favorite.` : `@${u.username} added to favourites.` });
      fetchData();
    }
  };

  const handleRemove = async (u: UserProfile) => {
    await (supabase as any).from("user_favourites").delete().eq("id", u.id);
    setFavourites(prev => prev.filter(f => f.id !== u.id));
    toast({ title: lang === "ro" ? `@${u.username} eliminat din favorite.` : `@${u.username} removed from favourites.` });
  };

  const handleRemoveAll = async () => {
    await (supabase as any).from("user_favourites").delete().eq("user_id", userId);
    setFavourites([]);
    toast({ title: lang === "ro" ? "Toate favoritele au fost eliminate." : "All favourites removed." });
  };

  const UserRow = ({ u, isFav }: { u: UserProfile; isFav: boolean }) => (
    <div className="flex items-center gap-3 py-3">
      <Avatar className="h-12 w-12 shrink-0">
        <AvatarImage src={u.photo ?? undefined} />
        <AvatarFallback>{(u.username || "?")[0]?.toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold font-body text-foreground truncate">{u.name || u.username}</p>
        <p className="text-xs text-muted-foreground font-body truncate">{u.username}</p>
      </div>
      {isFav ? (
        <button
          onClick={() => handleRemove(u)}
          className="px-4 py-1.5 rounded-lg border border-border text-sm font-semibold font-body text-foreground shrink-0"
        >
          {lang === "ro" ? "Elimină" : "Remove"}
        </button>
      ) : (
        <button
          onClick={() => handleAdd(u)}
          className="px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold font-body shrink-0"
        >
          {lang === "ro" ? "Adaugă" : "Add Account"}
        </button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground">
          {lang === "ro" ? "Favorite" : "Favourites"}
        </h2>
        <button onClick={() => searchRef.current?.focus()} className="ml-auto p-1 text-foreground hover:text-muted-foreground">
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* Description */}
      <div className="px-5 py-4 border-b border-border shrink-0 text-center">
        <p className="text-sm text-muted-foreground font-body leading-relaxed">
          {lang === "ro"
            ? "Postările noi de la favoriții tăi vor apărea mai sus în feed. Doar tu poți vedea cine adaugi sau elimini."
            : "New posts from your favourites will appear higher in feed. Only you can see who you add or remove."}
          {" "}
          <button onClick={() => setShowSheet(true)} className="text-primary font-body font-medium">{lang === "ro" ? "Cum funcționează." : "How it works."}</button>
        </p>
      </div>

      {/* Search */}
      <div className="px-4 py-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            ref={searchRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={lang === "ro" ? "Caută" : "Search"}
            className="flex-1 bg-transparent text-sm font-body outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        {loading ? (
          <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div>
        ) : query.trim() ? (
          /* Search results */
          <>
            {searchResults.length === 0 ? (
              <p className="text-sm text-muted-foreground font-body text-center py-10">
                {lang === "ro" ? "Niciun utilizator găsit." : "No users found."}
              </p>
            ) : (
              searchResults.map(u => <UserRow key={u.userId} u={u} isFav={isFavourite(u.userId)} />)
            )}
          </>
        ) : (
          <>
            {/* Favourites list */}
            {favourites.length > 0 && (
              <>
                <div className="flex items-center justify-between py-3">
                  <p className="text-sm font-semibold font-body text-foreground">
                    {lang === "ro" ? "Favorite" : "Favourites"}
                  </p>
                  <button onClick={handleRemoveAll} className="text-sm text-primary font-body font-semibold">
                    {lang === "ro" ? "Elimină toate" : "Remove All"}
                  </button>
                </div>
                {favourites.map(u => <UserRow key={u.id} u={u} isFav={true} />)}
              </>
            )}

            {/* Suggested list */}
            {suggested.length > 0 && (
              <>
                <p className="text-sm font-semibold font-body text-foreground pt-4 pb-2">
                  {lang === "ro" ? "Sugerate" : "Suggested"}
                </p>
                {suggested.map(u => <UserRow key={u.userId} u={u} isFav={false} />)}
              </>
            )}

            {favourites.length === 0 && suggested.length === 0 && (
              <p className="text-sm text-muted-foreground font-body text-center py-16">
                {lang === "ro" ? "Niciun favorit sau sugestie." : "No favourites or suggestions yet."}
              </p>
            )}
          </>
        )}
      </div>

      {showSheet && <HowFavouritesWorksSheet lang={lang} onClose={() => setShowSheet(false)} />}
    </div>
  );
}
