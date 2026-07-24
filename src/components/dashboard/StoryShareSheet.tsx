import { useState, useEffect } from "react";
import { Search, User, Link, Loader2, MessageCircle, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";

interface FollowingUser {
  userId: string;
  name: string;
  photo: string | null;
}

interface StoryShareSheetProps {
  open: boolean;
  onClose: () => void;
  storyOwnerId?: string;
  storyOwnerName?: string;
  storyMediaUrl?: string;
  currentUserId: string;
}

const EXTERNAL_ACTIONS = [
  {
    id: "whatsapp",
    label: "WhatsApp",
    bg: "#25D366",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-white">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
      </svg>
    ),
  },
  {
    id: "share",
    label: "Share to...",
    bg: "#6b7280",
    icon: (
      <svg viewBox="0 0 24 24" className="w-6 h-6 fill-none stroke-white stroke-2">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    id: "copylink",
    label: "Copy link",
    bg: "#374151",
    icon: <Link className="w-6 h-6 text-white" />,
  },
  {
    id: "messages",
    label: "Messages",
    bg: "#3b82f6",
    icon: <MessageCircle className="w-6 h-6 text-white fill-white" />,
  },
];

export default function StoryShareSheet({ open, onClose, storyOwnerId, storyOwnerName, storyMediaUrl, currentUserId }: StoryShareSheetProps) {
  const { toast } = useToast();
  const { lang } = useLanguage();

  const [following, setFollowing] = useState<FollowingUser[]>([]);
  const [filtered, setFiltered] = useState<FollowingUser[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());
  const [sending, setSending] = useState<string | null>(null);
  const [storySharesAllowed, setStorySharesAllowed] = useState(true);

  useEffect(() => {
    if (!open || !storyOwnerId) return;
    (supabase as any)
      .rpc("get_story_shares_enabled", { _story_owner_id: storyOwnerId })
      .then(({ data }: any) => setStorySharesAllowed(data ?? true))
      .catch((err: unknown) => console.error("Failed to load story-share setting:", err));
  }, [open, storyOwnerId]);

  useEffect(() => {
    if (!open) { setSearch(""); setSent(new Set()); return; }
    const fetchFollowing = async () => {
      setLoading(true);
      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", currentUserId)
        .eq("status", "accepted");
      const ids = (follows || []).map((f: any) => f.following_id);
      if (ids.length === 0) { setFollowing([]); setFiltered([]); setLoading(false); return; }

      const [playerRes, scoutRes] = await Promise.all([
        supabase.from("player_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", ids),
        supabase.from("scout_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", ids),
      ]);
      const map = new Map<string, { name: string; photo: string | null }>();
      (playerRes.data || []).forEach((p: any) => map.set(p.user_id, { name: `${p.first_name} ${p.last_name}`.trim(), photo: p.photo_url }));
      (scoutRes.data || []).forEach((s: any) => { if (!map.has(s.user_id)) map.set(s.user_id, { name: `${s.first_name} ${s.last_name}`.trim(), photo: s.photo_url }); });

      const list = ids.map((id: string) => ({ userId: id, name: map.get(id)?.name || "Utilizator", photo: map.get(id)?.photo || null }));
      setFollowing(list);
      setFiltered(list);
      setLoading(false);
    };
    fetchFollowing();
  }, [open, currentUserId]);

  useEffect(() => {
    const q = search.toLowerCase();
    setFiltered(q ? following.filter(u => u.name.toLowerCase().includes(q)) : following);
  }, [search, following]);

  const handleSendTo = async (user: FollowingUser) => {
    if (sent.has(user.userId)) return;
    if (!storySharesAllowed) {
      toast({ title: lang === "ro" ? "Această persoană nu permite distribuirea story-urilor sale." : "This person doesn't allow their stories to be shared.", variant: "destructive" });
      return;
    }
    setSending(user.userId);
    try {
      const { data: convId, error: convError } = await supabase.rpc("get_or_create_conversation", { other_user_id: user.userId });
      if (convError || !convId) {
        toast({ title: lang === "ro" ? "Nu s-a putut trimite story-ul." : "Could not send the story.", variant: "destructive" });
        return;
      }
      const text = storyOwnerName
        ? `📸 ${lang === "ro" ? "Ți-am trimis un story de la" : "Sent you a story from"} ${storyOwnerName}`
        : `📸 ${lang === "ro" ? "Ți-am trimis un story" : "Sent you a story"}`;
      const { error: sendError } = await supabase.from("messages").insert({ conversation_id: convId, sender_id: currentUserId, content: text } as any);
      if (sendError) {
        toast({ title: lang === "ro" ? "Nu s-a putut trimite story-ul." : "Could not send the story.", variant: "destructive" });
        return;
      }
      setSent(prev => new Set(prev).add(user.userId));
    } finally {
      setSending(null);
    }
  };

  const handleExternal = (id: string) => {
    const shareUrl = window.location.href;
    const shareText = storyOwnerName
      ? `${lang === "ro" ? "Vezi story-ul lui" : "Check out"} ${storyOwnerName} pe SportRise!`
      : "SportRise story";

    if (id === "whatsapp") {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText + "\n" + shareUrl)}`, "_blank");
    } else if (id === "share") {
      if (navigator.share) {
        navigator.share({ title: shareText, url: shareUrl }).catch(() => {});
      } else {
        navigator.clipboard.writeText(shareUrl);
        toast({ title: lang === "ro" ? "Link copiat!" : "Link copied!" });
      }
    } else if (id === "copylink") {
      navigator.clipboard.writeText(shareUrl);
      toast({ title: lang === "ro" ? "Link copiat!" : "Link copied!" });
    } else {
      toast({ title: lang === "ro" ? "Funcționalitate în curând." : "Coming soon." });
    }
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[60] bg-black/60" onClick={(e) => { e.stopPropagation(); onClose(); }} />

      {/* Sheet */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 z-[61] w-full max-w-sm bg-background rounded-t-2xl shadow-2xl flex flex-col max-h-[70vh]">
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* Close */}
        <button onClick={onClose} className="absolute right-4 top-3 p-1 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>

        {/* Search */}
        <div className="px-4 py-2 shrink-0">
          <div className="flex items-center gap-2 bg-muted rounded-full px-3 py-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder={lang === "ro" ? "Caută..." : "Search..."}
              className="flex-1 bg-transparent text-sm outline-none border-none font-body text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Following grid */}
        <div className="flex-1 overflow-y-auto px-4 py-2">
          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 font-body">
              {search ? (lang === "ro" ? "Niciun rezultat." : "No results.") : (lang === "ro" ? "Nu urmărești pe nimeni." : "Not following anyone.")}
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-x-2 gap-y-4">
              {filtered.map(u => (
                <button
                  key={u.userId}
                  onClick={() => handleSendTo(u)}
                  disabled={!!sending}
                  className="flex flex-col items-center gap-1.5 group"
                >
                  <div className={`relative w-16 h-16 rounded-full overflow-hidden bg-muted flex items-center justify-center transition-all ${sent.has(u.userId) ? "ring-2 ring-primary" : "group-hover:ring-2 group-hover:ring-primary/50"}`}>
                    {u.photo ? <img src={u.photo} alt="" className="w-full h-full object-cover" /> : <User className="h-6 w-6 text-muted-foreground" />}
                    {sending === u.userId && (
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-white" />
                      </div>
                    )}
                    {sent.has(u.userId) && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <span className="text-primary text-lg">✓</span>
                      </div>
                    )}
                  </div>
                  <span className="text-[11px] text-foreground font-body text-center leading-tight line-clamp-2 max-w-[72px]">{u.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* External actions */}
        <div className="shrink-0 border-t border-border px-4 py-3">
          <div className="flex gap-4 overflow-x-auto scrollbar-none pb-safe">
            {EXTERNAL_ACTIONS.map(action => (
              <button
                key={action.id}
                onClick={() => handleExternal(action.id)}
                className="flex flex-col items-center gap-1.5 shrink-0"
              >
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: action.bg }}
                >
                  {action.icon}
                </div>
                <span className="text-[11px] text-muted-foreground font-body">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
