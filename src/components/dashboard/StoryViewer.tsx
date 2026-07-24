import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, User, Heart, Send, Forward } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import StoryShareSheet from "./StoryShareSheet";

interface Story {
  id: string;
  media_url: string;
  caption: string;
  overlay_text: string;
  created_at: string;
}

interface StoryViewerProps {
  userId: string;
  open: boolean;
  onClose: () => void;
  displayName?: string;
  avatarUrl?: string | null;
  currentUserId?: string;
}

const STORY_DURATION = 5000;

export default function StoryViewer({ userId, open, onClose, displayName, avatarUrl, currentUserId }: StoryViewerProps) {
  const { toast } = useToast();
  const { lang } = useLanguage();

  const [stories, setStories] = useState<Story[]>([]);
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [liked, setLiked] = useState(false);
  const [paused, setPaused] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [viewerId, setViewerId] = useState<string>("");

  // Resolve currentUserId (prop or session)
  useEffect(() => {
    if (currentUserId) { setViewerId(currentUserId); return; }
    supabase.auth.getUser().then(({ data }) => { if (data.user) setViewerId(data.user.id); })
      .catch((err) => console.error("Failed to get current user:", err));
  }, [currentUserId]);

  useEffect(() => {
    if (!open) { setIndex(0); setProgress(0); setMessage(""); setLiked(false); setShowShare(false); setPaused(false); return; }
    const fetch = async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("stories")
        .select("id, media_url, caption, overlay_text, created_at")
        .eq("user_id", userId)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true });
      setStories(data || []);
      setLoading(false);
    };
    fetch();
  }, [open, userId]);

  // Load/track whether the viewer already liked the current story.
  useEffect(() => {
    const current = stories[index];
    if (!current || !viewerId) { setLiked(false); return; }
    (supabase as any)
      .from("story_likes")
      .select("id")
      .eq("story_id", current.id)
      .eq("user_id", viewerId)
      .maybeSingle()
      .then(
        ({ data }: any) => setLiked(!!data),
        (err: unknown) => console.error("Failed to check story like:", err)
      );
  }, [stories, index, viewerId]);

  const toggleLike = async () => {
    const current = stories[index];
    if (!current || !viewerId) return;
    if (liked) {
      setLiked(false);
      const { error } = await (supabase as any).from("story_likes").delete().eq("story_id", current.id).eq("user_id", viewerId);
      if (error) setLiked(true);
    } else {
      setLiked(true);
      const { error } = await (supabase as any).from("story_likes").insert({ story_id: current.id, user_id: viewerId });
      if (error) setLiked(false);
    }
  };

  const goNext = useCallback(() => {
    if (index < stories.length - 1) { setIndex(i => i + 1); setProgress(0); }
    else onClose();
  }, [index, stories.length, onClose]);

  const goPrev = () => {
    if (index > 0) { setIndex(i => i - 1); setProgress(0); }
  };

  useEffect(() => {
    if (!open || loading || stories.length === 0 || paused || showShare) return;
    setProgress(0);
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) { clearInterval(interval); goNext(); return 100; }
        return p + (100 / (STORY_DURATION / 100));
      });
    }, 100);
    return () => clearInterval(interval);
  }, [open, index, loading, stories.length, goNext, paused, showShare]);

  const [sendingReply, setSendingReply] = useState(false);

  const handleSend = async () => {
    if (!message.trim() || !viewerId || sendingReply) return;
    const text = message.trim();
    setSendingReply(true);
    try {
      // Respect the story owner's "who can reply to my stories" setting —
      // enforced server-side (SECURITY DEFINER RPC), not just client-side.
      const { data: canReply } = await (supabase as any).rpc("can_reply_to_story", { _story_owner_id: userId });
      if (!canReply) {
        toast({ title: lang === "ro" ? "Nu poți răspunde la acest story." : "You can't reply to this story.", variant: "destructive" });
        return;
      }

      const { data: convId, error: convError } = await supabase.rpc("get_or_create_conversation", { other_user_id: userId });
      if (convError || !convId) {
        if (convError?.message?.includes("FOLLOW_REQUIRED")) {
          toast({
            title: lang === "ro" ? "Mesaj indisponibil" : "Messaging unavailable",
            description: lang === "ro" ? "Poți răspunde la story doar dacă urmărești acest utilizator." : "You can reply to a story only if you follow this user.",
            variant: "destructive",
          });
        } else {
          toast({ title: lang === "ro" ? "Nu s-a putut trimite mesajul." : "Could not send message.", variant: "destructive" });
        }
        return;
      }

      const tag = lang === "ro" ? "Răspuns la story" : "Reply to story";
      const { error: msgError } = await supabase
        .from("messages")
        .insert({ conversation_id: convId, sender_id: viewerId, content: `📖 ${tag}:\n${text}` } as any);

      if (msgError) {
        toast({ title: lang === "ro" ? "Nu s-a putut trimite mesajul." : "Could not send message.", variant: "destructive" });
        return;
      }

      setMessage("");
      toast({ title: lang === "ro" ? "Mesaj trimis!" : "Message sent!" });
    } catch (err) {
      console.error("Failed to send story reply:", err);
      toast({ title: lang === "ro" ? "Nu s-a putut trimite mesajul." : "Could not send message.", variant: "destructive" });
    } finally {
      setSendingReply(false);
    }
  };

  const current = stories[index];

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const h = Math.floor(diff / 3600000);
    if (h < 1) return `${Math.floor(diff / 60000)}m`;
    return `${h}h`;
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
        <DialogContent className="max-w-sm w-full p-0 bg-black border-0 overflow-hidden h-[90vh] flex flex-col gap-0" hideClose={true}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          ) : stories.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-white/60 text-sm">
              Niciun story activ.
            </div>
          ) : (
            <>
              {/* Progress bars */}
              <div className="flex gap-1 px-3 pt-3 shrink-0">
                {stories.map((_, i) => (
                  <div key={i} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-white transition-none rounded-full"
                      style={{ width: i < index ? "100%" : i === index ? `${progress}%` : "0%" }}
                    />
                  </div>
                ))}
              </div>

              {/* Header: avatar + name + time */}
              <div className="flex items-center justify-between px-3 py-2 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-white/10 shrink-0 flex items-center justify-center">
                    {avatarUrl
                      ? <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
                      : <User className="h-4 w-4 text-white/60" />
                    }
                  </div>
                  <div className="flex flex-col leading-tight">
                    {displayName && (
                      <span className="text-white text-xs font-semibold font-body leading-none">{displayName}</span>
                    )}
                    <span className="text-white/60 text-[11px] font-body">{timeAgo(current.created_at)}</span>
                  </div>
                </div>
                <button onClick={onClose} className="text-white p-1">
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Image */}
              <div className="flex-1 relative flex items-center justify-center bg-black overflow-hidden">
                <img
                  src={current.media_url}
                  alt=""
                  className="w-full h-full object-contain"
                  draggable={false}
                />

                {/* Overlay text */}
                {current.overlay_text && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                    <span
                      className="text-white text-2xl font-bold text-center px-4 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                      style={{ fontFamily: "'Bebas Neue', sans-serif", whiteSpace: "pre-wrap", maxWidth: "80%" }}
                    >
                      {current.overlay_text}
                    </span>
                  </div>
                )}

                {/* Tap zones */}
                <button className="absolute left-0 top-0 w-1/3 h-full z-10" onClick={goPrev} />
                <button className="absolute right-0 top-0 w-1/3 h-full z-10" onClick={goNext} />

                {/* Nav arrows (visual only) */}
                {index > 0 && (
                  <div className="absolute left-2 top-1/2 -translate-y-1/2 pointer-events-none">
                    <ChevronLeft className="h-6 w-6 text-white/50" />
                  </div>
                )}
                {index < stories.length - 1 && (
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none">
                    <ChevronRight className="h-6 w-6 text-white/50" />
                  </div>
                )}
              </div>

              {/* Caption */}
              {current.caption && (
                <div className="px-4 py-2 shrink-0">
                  <p className="text-white text-sm font-body">{current.caption}</p>
                </div>
              )}

              {/* Bottom bar */}
              <div className="flex items-center gap-2 px-3 py-3 shrink-0">
                <div className="flex-1 flex items-center bg-transparent border border-white/40 rounded-full px-4 py-2 gap-2">
                  <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onFocus={() => setPaused(true)}
                    onBlur={() => setPaused(false)}
                    onKeyDown={(e) => e.key === "Enter" && handleSend()}
                    placeholder={lang === "ro" ? "Trimite mesaj..." : "Send message..."}
                    disabled={sendingReply}
                    className="flex-1 bg-transparent text-white text-sm placeholder:text-white/50 outline-none border-none font-body disabled:opacity-50"
                  />
                  {message.trim() && (
                    <button onClick={handleSend} disabled={sendingReply} className="text-white/80 hover:text-white shrink-0 disabled:opacity-50">
                      <Send className="h-4 w-4" />
                    </button>
                  )}
                </div>

                {/* Like */}
                <button onClick={toggleLike} className="p-2 transition-transform active:scale-125">
                  <Heart
                    className="h-6 w-6 transition-colors"
                    style={{ color: liked ? "#ef4444" : "rgba(255,255,255,0.8)", fill: liked ? "#ef4444" : "none" }}
                  />
                </button>

                {/* Share */}
                <button onClick={() => { setShowShare(true); setPaused(true); }} className="p-2">
                  <Forward className="h-6 w-6 text-white/80" />
                </button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Share sheet — rendered outside Dialog to avoid stacking context issues */}
      <StoryShareSheet
        open={showShare}
        onClose={() => { setShowShare(false); setPaused(false); }}
        storyOwnerId={userId}
        storyOwnerName={displayName}
        storyMediaUrl={current?.media_url}
        currentUserId={viewerId}
      />
    </>
  );
}
