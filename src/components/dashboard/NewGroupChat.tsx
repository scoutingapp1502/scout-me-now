import { useState, useEffect, useRef } from "react";
import { ArrowLeft, Search, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

interface Suggested {
  userId: string;
  name: string;
  photo: string | null;
  role: string | null;
}

const getRoleLabel = (role: string | null, lang: string) => {
  if (!role) return "";
  if (role === "cauta_jucator") return lang === "ro" ? "Descoperitor" : "Discoverer";
  return lang === "ro" ? "Jucător" : "Player";
};

interface GroupItem {
  id: string;
  name: string;
  members: { userId: string; name: string; photo: string | null }[];
  lastMessage: string;
  lastMessageAt: string;
  inviteToken: string | null;
  muted: boolean;
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

  // "Solicitări de grup" ("Doar cei pe care îi urmăresc") is enforced
  // server-side by can_add_to_group() when actually inserting a member —
  // but per user request, someone who wouldn't pass that check shouldn't
  // even be discoverable here in the first place. Batch-checks each
  // candidate and drops the ones the creator couldn't add anyway.
  const filterAddable = async (list: Suggested[]): Promise<Suggested[]> => {
    if (list.length === 0) return list;
    const checks = await Promise.all(
      list.map(u => (supabase as any).rpc("can_add_to_group", { _target_user_id: u.userId }))
    );
    return list.filter((_, i) => checks[i]?.data === true);
  };

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
      const [{ data: players }, { data: scouts }, { data: roles }] = await Promise.all([
        (supabase as any).from("player_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", ids),
        (supabase as any).from("scout_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", ids),
        (supabase as any).from("user_roles").select("user_id, role").in("user_id", ids),
      ]);

      const roleMap = new Map<string, string>();
      (roles ?? []).forEach((r: any) => roleMap.set(r.user_id, r.role));

      const seen = new Set<string>();
      const result: Suggested[] = [];
      for (const p of [...(players ?? []), ...(scouts ?? [])]) {
        if (!seen.has(p.user_id)) {
          seen.add(p.user_id);
          result.push({ userId: p.user_id, name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(), photo: p.photo_url ?? null, role: roleMap.get(p.user_id) ?? null });
        }
      }
      setSuggested(await filterAddable(result));
    };
    fetchSuggested();
  }, [currentUserId]);

  // Search users
  useEffect(() => {
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(async () => {
      const q = searchQuery.trim();
      const orFilter = `first_name.ilike.%${q}%,last_name.ilike.%${q}%`;
      const [{ data: players }, { data: scouts }] = await Promise.all([
        (supabase as any).from("player_profiles").select("user_id, first_name, last_name, photo_url").or(orFilter).neq("user_id", currentUserId).limit(10),
        (supabase as any).from("scout_profiles").select("user_id, first_name, last_name, photo_url").or(orFilter).neq("user_id", currentUserId).limit(10),
      ]);
      const seen = new Set<string>();
      const combined = [...(players ?? []), ...(scouts ?? [])].filter(p => {
        if (seen.has(p.user_id)) return false;
        seen.add(p.user_id);
        return true;
      });

      const { data: roles } = combined.length
        ? await (supabase as any).from("user_roles").select("user_id, role").in("user_id", combined.map(p => p.user_id))
        : { data: [] };
      const roleMap = new Map<string, string>();
      (roles ?? []).forEach((r: any) => roleMap.set(r.user_id, r.role));

      const result: Suggested[] = combined.map(p => ({
        userId: p.user_id,
        name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
        photo: p.photo_url ?? null,
        role: roleMap.get(p.user_id) ?? null,
      }));
      setSearchResults(await filterAddable(result));
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

    // 2. Insert members (creator + selected). This is a bulk insert whose
    // RLS check (can_add_to_group) can reject individual rows — a bulk
    // INSERT is all-or-nothing, so if even one selected member can't be
    // added, the whole statement (including the creator's own row) used to
    // fail silently, leaving an orphaned group with zero members. Insert
    // members one at a time so a single rejected member doesn't sink the
    // whole group, and surface which ones failed.
    const memberIds = [currentUserId, ...Array.from(selected)];
    const failedIds: string[] = [];
    for (const uid of memberIds) {
      const { error: memberErr } = await (supabase as any)
        .from("group_members")
        .insert({ group_id: group.id, user_id: uid });
      if (memberErr) failedIds.push(uid);
    }

    if (failedIds.includes(currentUserId)) {
      // Creator couldn't even be added to their own group — delete the
      // orphaned group_conversations row and report failure.
      await (supabase as any).from("group_conversations").delete().eq("id", group.id);
      toast({ title: lang === "ro" ? "Eroare la creare grup." : "Error creating group.", variant: "destructive" });
      setCreating(false);
      return;
    }

    // 3. Build GroupItem for navigation (only successfully-added members)
    const allUsers = [...suggested, ...searchResults];
    const addedIds = memberIds.filter(uid => !failedIds.includes(uid));
    const members = addedIds.map(uid => {
      const u = allUsers.find(x => x.userId === uid);
      return { userId: uid, name: u?.name ?? "", photo: u?.photo ?? null };
    });

    if (failedIds.length > 0) {
      const failedNames = failedIds
        .map(uid => allUsers.find(x => x.userId === uid)?.name)
        .filter(Boolean)
        .join(", ");
      toast({
        title: lang === "ro" ? "Unii utilizatori nu au putut fi adăugați." : "Some users couldn't be added.",
        description: failedNames || undefined,
        variant: "destructive",
      });
    } else {
      toast({ title: lang === "ro" ? `Grupul "${name}" a fost creat!` : `Group "${name}" created!` });
    }
    onCreated({ id: group.id, name, members, lastMessage: lang === "ro" ? "Grup nou" : "New group", lastMessageAt: group.created_at, inviteToken: null, muted: false });
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
                {u.name}
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
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold font-body text-foreground truncate">{u.name}</p>
                      {u.role && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium shrink-0">
                          {getRoleLabel(u.role, lang)}
                        </span>
                      )}
                    </div>
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
