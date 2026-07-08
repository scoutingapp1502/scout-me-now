import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

interface Suggested {
  userId: string;
  name: string;
  username: string;
  photo: string | null;
}

interface GroupItem {
  id: string;
  name: string;
  members: { userId: string; name: string; photo: string | null }[];
  lastMessage: string;
  lastMessageAt: string;
}

interface NewGroupChatProps {
  currentUserId: string;
  lang: string;
  onBack: () => void;
  onCreated: (group: GroupItem) => void;
}

export default function NewGroupChat({ currentUserId, lang, onBack, onCreated }: NewGroupChatProps) {
  const { toast } = useToast();
  const [groupName, setGroupName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [suggested, setSuggested] = useState<Suggested[]>([]);
  const [searchResults, setSearchResults] = useState<Suggested[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch followed users as suggestions
  useEffect(() => {
    const fetchSuggested = async () => {
      const { data: follows } = await (supabase as any)
        .from("follows")
        .select("following_id")
        .eq("follower_id", currentUserId)
        .eq("status", "accepted")
        .limit(30);
      if (!follows?.length) return;

      const ids = follows.map((f: any) => f.following_id);
      const [{ data: players }, { data: scouts }] = await Promise.all([
        (supabase as any).from("player_profiles").select("user_id, first_name, last_name, photo_url, username").in("user_id", ids),
        (supabase as any).from("scout_profiles").select("user_id, first_name, last_name, photo_url, username").in("user_id", ids),
      ]);

      const seen = new Set<string>();
      const result: Suggested[] = [];
      for (const p of [...(players ?? []), ...(scouts ?? [])]) {
        if (!seen.has(p.user_id)) {
          seen.add(p.user_id);
          result.push({ userId: p.user_id, name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(), username: p.username ?? "", photo: p.photo_url ?? null });
        }
      }
      setSuggested(result);
    };
    fetchSuggested();
  }, [currentUserId]);

  // Search users
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      const q = searchQuery.trim();
      const [{ data: players }, { data: scouts }] = await Promise.all([
        (supabase as any).from("player_profiles").select("user_id, first_name, last_name, photo_url, username").ilike("username", `%${q}%`).neq("user_id", currentUserId).limit(10),
        (supabase as any).from("scout_profiles").select("user_id, first_name, last_name, photo_url, username").ilike("username", `%${q}%`).neq("user_id", currentUserId).limit(10),
      ]);
      const seen = new Set<string>();
      const result: Suggested[] = [];
      for (const p of [...(players ?? []), ...(scouts ?? [])]) {
        if (!seen.has(p.user_id)) {
          seen.add(p.user_id);
          result.push({ userId: p.user_id, name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(), username: p.username ?? "", photo: p.photo_url ?? null });
        }
      }
      setSearchResults(result);
    }, 300);
  }, [searchQuery, currentUserId]);

  const toggle = (userId: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId);
      else next.add(userId);
      return next;
    });
  };

  const handleCreate = async () => {
    if (selected.size === 0) return;
    setCreating(true);

    const name = groupName.trim() || (lang === "ro" ? "Grup nou" : "New group");

    // 1. Create group conversation
    const { data: group, error: groupErr } = await (supabase as any)
      .from("group_conversations")
      .insert({ name, created_by: currentUserId })
      .select()
      .single();

    if (groupErr || !group) {
      toast({ title: lang === "ro" ? "Eroare la creare grup." : "Error creating group.", variant: "destructive" });
      setCreating(false);
      return;
    }

    // 2. Insert members (creator + selected)
    const memberIds = [currentUserId, ...Array.from(selected)];
    await (supabase as any).from("group_members").insert(memberIds.map(uid => ({ group_id: group.id, user_id: uid })));

    // 3. Build GroupItem for navigation
    const allUsers = [...suggested, ...searchResults];
    const members = memberIds.map(uid => {
      const u = allUsers.find(x => x.userId === uid);
      return { userId: uid, name: u?.name ?? "", photo: u?.photo ?? null };
    });

    toast({ title: lang === "ro" ? `Grupul "${name}" a fost creat!` : `Group "${name}" created!` });
    onCreated({ id: group.id, name, members, lastMessage: lang === "ro" ? "Grup nou" : "New group", lastMessageAt: group.created_at });
    setCreating(false);
  };

  const displayList = searchQuery.trim() ? searchResults : suggested;
  const selectedUsers = [...suggested, ...searchResults].filter(u => selected.has(u.userId));

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] -mt-4 -mb-4 sm:-mt-8 sm:-mb-8">
      {/* Header */}
      <div className="flex items-center gap-3 pb-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-2 text-muted-foreground hover:text-foreground shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="flex-1 font-display text-base text-foreground">
          {lang === "ro" ? "Grup nou" : "New group chat"}
        </h2>
        <button
          onClick={handleCreate}
          disabled={selected.size === 0 || creating}
          className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 transition-opacity"
        >
          {creating ? "..." : (lang === "ro" ? "Creează" : "Create")}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Group name input */}
        <div className="px-4 pt-4 pb-3 border-b border-border">
          <input
            value={groupName}
            onChange={e => setGroupName(e.target.value)}
            placeholder={lang === "ro" ? "Nume grup (opțional)" : "Group name (optional)"}
            className="w-full bg-muted rounded-xl px-4 py-3 text-sm font-body outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-border">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={lang === "ro" ? "Caută..." : "Search"}
              className="w-full bg-muted rounded-xl pl-9 pr-4 py-2.5 text-sm font-body outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Selected chips */}
        {selectedUsers.length > 0 && (
          <div className="flex gap-2 flex-wrap px-4 py-3 border-b border-border">
            {selectedUsers.map(u => (
              <button key={u.userId} onClick={() => toggle(u.userId)} className="flex items-center gap-1.5 bg-primary/15 text-primary rounded-full px-3 py-1 text-xs font-semibold">
                {u.username || u.name}
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        )}

        {/* User list */}
        {displayList.length > 0 && (
          <>
            {!searchQuery.trim() && (
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 pt-4 pb-2">
                {lang === "ro" ? "Sugerat" : "Suggested"}
              </p>
            )}
            {displayList.map(u => {
              const isSelected = selected.has(u.userId);
              return (
                <button
                  key={u.userId}
                  onClick={() => toggle(u.userId)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                >
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarImage src={u.photo ?? undefined} />
                    <AvatarFallback className="bg-muted">{(u.name || "?")[0]?.toUpperCase()}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold font-body text-foreground truncate">{u.name}</p>
                    {u.username && <p className="text-xs text-muted-foreground font-body truncate">@{u.username}</p>}
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? "bg-primary border-primary" : "border-muted-foreground/40"}`}>
                    {isSelected && (
                      <svg viewBox="0 0 10 8" className="w-3 h-3 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth={2}>
                        <path d="M1 4l3 3 5-6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                </button>
              );
            })}
          </>
        )}

        {searchQuery.trim() && searchResults.length === 0 && (
          <p className="text-sm text-muted-foreground font-body text-center py-10">
            {lang === "ro" ? "Niciun utilizator găsit." : "No users found."}
          </p>
        )}
      </div>
    </div>
  );
}
