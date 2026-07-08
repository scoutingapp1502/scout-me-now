import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Plus, X, MoreHorizontal, ChevronRight, Grid3X3, UserSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface BlockedUser {
  blockId: string;
  userId: string;
  username: string;
  fullName: string;
  avatarUrl: string | null;
}

interface ProfileStats {
  postCount: number;
  followersCount: number;
  followingCount: number;
  bio: string;
}

interface BlockedSectionProps {
  currentUserId: string;
  onBack: () => void;
}

// ── Add-block search sheet ─────────────────────────────────────────────────────
function AddBlockSheet({
  currentUserId,
  lang,
  onClose,
  onBlocked,
}: {
  currentUserId: string;
  lang: string;
  onClose: () => void;
  onBlocked: () => void;
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(async () => {
      setSearching(true);
      const [{ data: players }, { data: scouts }] = await Promise.all([
        (supabase as any).from("player_profiles").select("user_id, username, full_name, avatar_url").ilike("username", `%${query.trim()}%`).neq("user_id", currentUserId).limit(10),
        (supabase as any).from("scout_profiles").select("user_id, username, full_name, avatar_url").ilike("username", `%${query.trim()}%`).neq("user_id", currentUserId).limit(10),
      ]);
      const seen = new Set<string>();
      const combined = [...(players ?? []), ...(scouts ?? [])].filter(p => { if (seen.has(p.user_id)) return false; seen.add(p.user_id); return true; });
      setResults(combined);
      setSearching(false);
    }, 300);
  }, [query, currentUserId]);

  const handleBlock = async (userId: string, username: string) => {
    const { error } = await (supabase as any).from("blocks").insert({ blocker_id: currentUserId, blocked_id: userId });
    if (error && error.code !== "23505") {
      toast({ title: lang === "ro" ? "Eroare la blocare." : "Error blocking.", variant: "destructive" });
    } else {
      toast({ title: lang === "ro" ? `@${username} a fost blocat.` : `@${username} blocked.` });
      onBlocked();
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/50" onClick={onClose} />
      <div className="fixed inset-x-0 bottom-0 z-[61] bg-background rounded-t-2xl max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h3 className="font-heading text-sm text-foreground">
            {lang === "ro" ? "Blochează un profil" : "Block a profile"}
          </h3>
          <button onClick={onClose} className="p-1 text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="px-4 py-3 border-b border-border shrink-0">
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder={lang === "ro" ? "Caută după username..." : "Search by username..."}
            className="w-full bg-muted rounded-xl px-3 py-2 text-sm font-body outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>
        <div className="flex-1 overflow-y-auto">
          {searching && (
            <div className="flex justify-center py-8">
              <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
            </div>
          )}
          {results.map(u => (
            <div key={u.user_id} className="flex items-center gap-3 px-4 py-3 border-b border-border/40">
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={u.avatar_url ?? undefined} />
                <AvatarFallback className="bg-muted text-sm">{(u.username || "?")[0]?.toUpperCase()}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold font-body text-foreground truncate">{u.username}</p>
                {u.full_name && <p className="text-xs text-muted-foreground font-body truncate">{u.full_name}</p>}
              </div>
              <button
                onClick={() => handleBlock(u.user_id, u.username)}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold font-body hover:bg-destructive/90 transition-colors"
              >
                {lang === "ro" ? "Blochează" : "Block"}
              </button>
            </div>
          ))}
          {!searching && query.trim() && results.length === 0 && (
            <p className="text-sm text-muted-foreground font-body text-center py-10">
              {lang === "ro" ? "Niciun utilizator găsit." : "No users found."}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

// ── Blocked profile view ───────────────────────────────────────────────────────
function BlockedProfileView({
  user,
  currentUserId,
  lang,
  onBack,
  onUnblocked,
}: {
  user: BlockedUser;
  currentUserId: string;
  lang: string;
  onBack: () => void;
  onUnblocked: () => void;
}) {
  const { toast } = useToast();
  const [stats, setStats] = useState<ProfileStats>({ postCount: 0, followersCount: 0, followingCount: 0, bio: "" });
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    const fetchStats = async () => {
      const [{ count: postCount }, { count: followersCount }, { count: followingCount }, { data: playerProfile }, { data: scoutProfile }] = await Promise.all([
        (supabase as any).from("posts").select("id", { count: "exact", head: true }).eq("user_id", user.userId).eq("is_archived", false),
        (supabase as any).from("follows").select("id", { count: "exact", head: true }).eq("following_id", user.userId).eq("status", "accepted"),
        (supabase as any).from("follows").select("id", { count: "exact", head: true }).eq("follower_id", user.userId).eq("status", "accepted"),
        (supabase as any).from("player_profiles").select("bio").eq("user_id", user.userId).maybeSingle(),
        (supabase as any).from("scout_profiles").select("bio").eq("user_id", user.userId).maybeSingle(),
      ]);
      setStats({
        postCount: postCount ?? 0,
        followersCount: followersCount ?? 0,
        followingCount: followingCount ?? 0,
        bio: playerProfile?.bio ?? scoutProfile?.bio ?? "",
      });
    };
    fetchStats();
  }, [user.userId]);

  const handleUnblock = async () => {
    const { error } = await (supabase as any).from("blocks").delete().eq("id", user.blockId);
    if (error) {
      toast({ title: lang === "ro" ? "Eroare la deblocare." : "Error unblocking.", variant: "destructive" });
    } else {
      toast({ title: lang === "ro" ? `@${user.username} a fost deblocat.` : `@${user.username} unblocked.` });
      onUnblocked();
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
          {user.username || user.fullName}
        </h2>
        <div className="ml-auto relative">
          <button onClick={() => setShowMenu(v => !v)} className="p-1 text-muted-foreground hover:text-foreground">
            <MoreHorizontal className="h-5 w-5" />
          </button>
          {showMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowMenu(false)} />
              <div className="absolute right-0 top-8 z-20 bg-card border border-border rounded-xl shadow-lg min-w-[160px] overflow-hidden">
                <button
                  onClick={() => { setShowMenu(false); handleUnblock(); }}
                  className="w-full px-4 py-3 text-sm font-body text-left hover:bg-muted/40 transition-colors"
                >
                  {lang === "ro" ? "Deblochează" : "Unblock"}
                </button>
                <button
                  onClick={() => setShowMenu(false)}
                  className="w-full px-4 py-3 text-sm font-body text-left text-destructive hover:bg-muted/40 transition-colors border-t border-border"
                >
                  {lang === "ro" ? "Raportează" : "Report"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Profile header */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-6">
            <Avatar className="h-20 w-20 shrink-0">
              <AvatarImage src={user.avatarUrl ?? undefined} />
              <AvatarFallback className="bg-muted text-2xl">
                {(user.username || user.fullName || "?")[0]?.toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex gap-6 flex-1">
              {[
                { label: lang === "ro" ? "postări" : "posts", value: stats.postCount },
                { label: lang === "ro" ? "urmăritori" : "followers", value: stats.followersCount },
                { label: lang === "ro" ? "urmăriri" : "following", value: stats.followingCount },
              ].map(s => (
                <div key={s.label} className="flex flex-col items-center">
                  <span className="text-base font-bold font-heading text-foreground">{s.value}</span>
                  <span className="text-xs text-muted-foreground font-body">{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Name + bio */}
          <div className="mt-3 space-y-0.5">
            {user.fullName && (
              <p className="text-sm font-semibold font-body text-foreground">{user.fullName}</p>
            )}
            {stats.bio && (
              <p className="text-sm font-body text-foreground">{stats.bio}</p>
            )}
          </div>

          {/* Unblock button */}
          <button
            onClick={handleUnblock}
            className="mt-4 w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold font-body hover:bg-primary/90 transition-colors"
          >
            {lang === "ro" ? "Deblochează" : "Unblock"}
          </button>
        </div>

        {/* Tabs */}
        <div className="border-t border-border flex">
          <button className="flex-1 flex items-center justify-center py-3 border-b-2 border-foreground">
            <Grid3X3 className="h-5 w-5 text-foreground" />
          </button>
          <button className="flex-1 flex items-center justify-center py-3 border-b-2 border-transparent">
            <UserSquare className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        {/* Blurred placeholder grid */}
        <div className="grid grid-cols-3 gap-0.5 px-0">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square bg-muted/50 animate-pulse" />
          ))}
        </div>

        {/* Blocked message */}
        <div className="flex flex-col items-center px-8 py-10 text-center gap-3">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
            <svg viewBox="0 0 24 24" className="w-9 h-9 text-foreground" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <circle cx="12" cy="12" r="9" />
              <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
            </svg>
          </div>
          <p className="text-base font-bold font-heading text-foreground">
            {lang === "ro" ? "Ai blocat acest profil" : "You've blocked this profile"}
          </p>
          <p className="text-sm text-muted-foreground font-body leading-relaxed">
            {lang === "ro"
              ? "Deblochează acest profil pentru a vedea fotografiile și videoclipurile sale. Când îl deblochezi, va putea să îți găsească profilul și să îți trimită mesaje."
              : "Unblock this profile to see their photos and videos. When you unblock them, they'll also be able to find your profile and message you again."}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main BlockedSection ────────────────────────────────────────────────────────
export default function BlockedSection({ currentUserId, onBack }: BlockedSectionProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [blocked, setBlocked] = useState<BlockedUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [selectedUser, setSelectedUser] = useState<BlockedUser | null>(null);

  const fetchBlocked = async () => {
    setLoading(true);
    const { data: blocks } = await (supabase as any)
      .from("blocks")
      .select("id, blocked_id, created_at")
      .eq("blocker_id", currentUserId)
      .order("created_at", { ascending: false });

    if (!blocks?.length) { setBlocked([]); setLoading(false); return; }

    const userIds = blocks.map((b: any) => b.blocked_id);
    const [{ data: players }, { data: scouts }] = await Promise.all([
      (supabase as any).from("player_profiles").select("user_id, username, full_name, avatar_url").in("user_id", userIds),
      (supabase as any).from("scout_profiles").select("user_id, username, full_name, avatar_url").in("user_id", userIds),
    ]);

    const profileMap = new Map<string, { username: string; fullName: string; avatarUrl: string | null }>();
    for (const p of players ?? []) profileMap.set(p.user_id, { username: p.username ?? "", fullName: p.full_name ?? "", avatarUrl: p.avatar_url });
    for (const s of scouts ?? []) if (!profileMap.has(s.user_id)) profileMap.set(s.user_id, { username: s.username ?? "", fullName: s.full_name ?? "", avatarUrl: s.avatar_url });

    setBlocked(blocks.map((b: any) => {
      const p = profileMap.get(b.blocked_id);
      return { blockId: b.id, userId: b.blocked_id, username: p?.username ?? "", fullName: p?.fullName ?? "", avatarUrl: p?.avatarUrl ?? null };
    }));
    setLoading(false);
  };

  useEffect(() => { fetchBlocked(); }, [currentUserId]);

  const handleUnblock = async (blockId: string, username: string) => {
    const { error } = await (supabase as any).from("blocks").delete().eq("id", blockId);
    if (error) {
      toast({ title: lang === "ro" ? "Eroare la deblocare." : "Error unblocking.", variant: "destructive" });
    } else {
      setBlocked(prev => prev.filter(b => b.blockId !== blockId));
      toast({ title: lang === "ro" ? `@${username} a fost deblocat.` : `@${username} unblocked.` });
    }
  };

  // Show blocked profile sub-view
  if (selectedUser) {
    return (
      <BlockedProfileView
        user={selectedUser}
        currentUserId={currentUserId}
        lang={lang}
        onBack={() => setSelectedUser(null)}
        onUnblocked={() => {
          setBlocked(prev => prev.filter(b => b.blockId !== selectedUser.blockId));
          setSelectedUser(null);
          toast({ title: lang === "ro" ? `@${selectedUser.username} a fost deblocat.` : `@${selectedUser.username} unblocked.` });
        }}
      />
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground">
          {lang === "ro" ? "Profile blocate" : "Blocked profiles"}
        </h2>
        <button onClick={() => setShowSearch(true)} className="ml-auto p-1 text-foreground hover:text-foreground/70">
          <Plus className="h-5 w-5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {blocked.map(user => (
              <button
                key={user.blockId}
                onClick={() => setSelectedUser(user)}
                className="w-full flex items-center gap-3 px-4 py-3 border-b border-border/50 hover:bg-muted/20 transition-colors text-left"
              >
                <Avatar className="h-12 w-12 shrink-0">
                  <AvatarImage src={user.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-muted text-sm">
                    {(user.username || user.fullName || "?")[0]?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold font-body text-foreground truncate">{user.username || user.fullName}</p>
                  {user.fullName && user.username && (
                    <p className="text-xs text-muted-foreground font-body truncate">{user.fullName}</p>
                  )}
                </div>
                <button
                  onClick={e => { e.stopPropagation(); handleUnblock(user.blockId, user.username); }}
                  className="shrink-0 px-4 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold font-body hover:bg-primary/90 transition-colors"
                >
                  {lang === "ro" ? "Deblochează" : "Unblock"}
                </button>
              </button>
            ))}

            {/* You may want to block */}
            <button className="w-full flex items-center justify-between px-4 py-4 hover:bg-muted/30 transition-colors border-b border-border/50">
              <div className="text-left">
                <p className="text-sm font-body text-foreground">
                  {lang === "ro" ? "Poate vrei să blochezi" : "You May Want to Block"}
                </p>
                <p className="text-xs text-muted-foreground font-body mt-0.5">
                  {lang === "ro" ? "Pe baza activității tale" : "Based on your Accounts Centre"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>

            {blocked.length === 0 && (
              <p className="text-sm text-muted-foreground font-body text-center py-12 px-6">
                {lang === "ro" ? "Nu ai blocat niciun profil." : "You haven't blocked any profiles."}
              </p>
            )}
          </>
        )}
      </div>

      {showSearch && (
        <AddBlockSheet
          currentUserId={currentUserId}
          lang={lang}
          onClose={() => setShowSearch(false)}
          onBlocked={() => { setShowSearch(false); fetchBlocked(); }}
        />
      )}
    </div>
  );
}
