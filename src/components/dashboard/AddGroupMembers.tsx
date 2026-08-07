import { useState, useEffect, useRef } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";

interface Candidate {
  userId: string;
  name: string;
  photo: string | null;
  role: string | null;
}

interface GroupMember {
  userId: string;
  name: string;
  photo: string | null;
}

interface GroupItem {
  id: string;
  name: string;
  members: GroupMember[];
  lastMessage: string;
  lastMessageAt: string;
  inviteToken: string | null;
}

interface AddGroupMembersProps {
  group: GroupItem;
  currentUserId: string;
  lang: string;
  onBack: () => void;
  onAdded: (newMembers: GroupMember[]) => void;
}

const getRoleLabel = (role: string | null, lang: string) => {
  if (!role) return "";
  if (role === "cauta_jucator") return lang === "ro" ? "Descoperitor" : "Discoverer";
  return lang === "ro" ? "Jucător" : "Player";
};

export default function AddGroupMembers({ group, currentUserId, lang, onBack, onAdded }: AddGroupMembersProps) {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [suggested, setSuggested] = useState<Candidate[]>([]);
  const [searchResults, setSearchResults] = useState<Candidate[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const existingIds = new Set(group.members.map(m => m.userId));

  useEffect(() => {
    const fetchSuggested = async () => {
      const { data: follows } = await (supabase as any)
        .from("follows")
        .select("following_id")
        .eq("follower_id", currentUserId)
        .eq("status", "accepted")
        .limit(30);
      const ids = (follows ?? []).map((f: any) => f.following_id).filter((id: string) => !existingIds.has(id));
      if (!ids.length) return;

      const [{ data: players }, { data: scouts }, { data: roles }] = await Promise.all([
        (supabase as any).from("player_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", ids),
        (supabase as any).from("scout_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", ids),
        (supabase as any).from("user_roles").select("user_id, role").in("user_id", ids),
      ]);
      const roleMap = new Map<string, string>();
      (roles ?? []).forEach((r: any) => roleMap.set(r.user_id, r.role));

      const seen = new Set<string>();
      const result: Candidate[] = [];
      for (const p of [...(players ?? []), ...(scouts ?? [])]) {
        if (!seen.has(p.user_id)) {
          seen.add(p.user_id);
          result.push({ userId: p.user_id, name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(), photo: p.photo_url ?? null, role: roleMap.get(p.user_id) ?? null });
        }
      }
      setSuggested(result);
    };
    fetchSuggested();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

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
        if (existingIds.has(p.user_id)) return false;
        if (seen.has(p.user_id)) return false;
        seen.add(p.user_id);
        return true;
      });
      const { data: roles } = combined.length
        ? await (supabase as any).from("user_roles").select("user_id, role").in("user_id", combined.map(p => p.user_id))
        : { data: [] };
      const roleMap = new Map<string, string>();
      (roles ?? []).forEach((r: any) => roleMap.set(r.user_id, r.role));

      setSearchResults(combined.map(p => ({
        userId: p.user_id,
        name: `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim(),
        photo: p.photo_url ?? null,
        role: roleMap.get(p.user_id) ?? null,
      })));
      // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const handleAdd = async () => {
    if (selected.size === 0) return;
    setAdding(true);
    const allCandidates = [...suggested, ...searchResults];
    const addedIds: string[] = [];
    const failedIds: string[] = [];
    for (const uid of selected) {
      const { error } = await (supabase as any).from("group_members").insert({ group_id: group.id, user_id: uid });
      if (error) failedIds.push(uid); else addedIds.push(uid);
    }

    if (addedIds.length > 0) {
      const newMembers = addedIds.map(uid => {
        const c = allCandidates.find(x => x.userId === uid);
        return { userId: uid, name: c?.name ?? "", photo: c?.photo ?? null };
      });
      onAdded(newMembers);
    }

    if (failedIds.length > 0) {
      const failedNames = failedIds.map(uid => allCandidates.find(x => x.userId === uid)?.name).filter(Boolean).join(", ");
      toast({
        title: lang === "ro" ? "Unii utilizatori nu au putut fi adăugați." : "Some users couldn't be added.",
        description: failedNames || undefined,
        variant: "destructive",
      });
    } else {
      toast({ title: lang === "ro" ? "Persoane adăugate în grup!" : "People added to the group!" });
    }
    setAdding(false);
    if (addedIds.length > 0) onBack();
  };

  const displayList = searchQuery.trim() ? searchResults : suggested;

  return (
    <div className="flex flex-col h-[calc(100vh-2rem)] max-h-[calc(100vh-2rem)] -mt-4 -mb-4 sm:-mt-8 sm:-mb-8">
      <div className="flex items-center gap-3 pb-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-2 text-muted-foreground hover:text-foreground shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="flex-1 font-display text-base text-foreground">
          {lang === "ro" ? "Adaugă persoane" : "Add people"}
        </h2>
        <button
          onClick={handleAdd}
          disabled={selected.size === 0 || adding}
          className="px-4 py-1.5 rounded-full bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 transition-opacity"
        >
          {adding ? "..." : (lang === "ro" ? "Adaugă" : "Add")}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-3 border-b border-border">
          <input
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder={lang === "ro" ? "Caută..." : "Search"}
            className="w-full bg-muted rounded-xl px-4 py-2.5 text-sm font-body outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>

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
