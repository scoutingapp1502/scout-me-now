import { useState, useEffect, useCallback } from "react";
import { X, ChevronLeft, ChevronRight, User, Heart, Send, Forward } from "lucide-react";
import { SignedImg } from "@/components/SignedSrc";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
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
  // Opens directly at this specific story instead of the owner's oldest
  // active one — used when jumping in from a shared-story chat bubble.
  initialStoryId?: string;
}

const STORY_DURATION = 5000;

export default function StoryViewer({ userId, open, onClose, displayName, avatarUrl, currentUserId, initialStoryId }: StoryViewerProps) {
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
  // Distinguishes "owner has no active stories" from "blocked by their
  // account_visibility privacy setting" — both look like zero rows through
  // the stories RLS policy, so a separate check is needed for correct copy.
  const [viewBlocked, setViewBlocked] = useState(false);

  // Resolve currentUserId (prop or session)
  useEffect(() => {
    if (currentUserId) { setViewerId(currentUserId); return; }
    supabase.auth.getUser().then(({ data }) => { if (data.user) setViewerId(data.user.id); })
      .catch((err) => console.error("Failed to get current user:", err));
  }, [currentUserId]);

  useEffect(() => {
    if (!open) { setIndex(0); setProgress(0); setMessage(""); setLiked(false); setShowShare(false); setPaused(false); setViewBlocked(false); return; }
    const fetch = async () => {
      setLoading(true);
      setViewBlocked(false);
      const { data: allowed } = await (supabase as any).rpc("can_view_story", { _story_owner_id: userId });
      if (!allowed) { setViewBlocked(true); setStories([]); setLoading(false); return; }
      const { data } = await (supabase as any)
        .from("stories")
        .select("id, media_url, caption, overlay_text, created_at")
        .eq("user_id", userId)
        .gt("expires_at", new Date().toISOString())
        .order("created_at", { ascending: true });
      const list: Story[] = data || [];
      setStories(list);
      // Jump straight to the shared story instead of the owner's oldest one.
      const initialIdx = initialStoryId ? list.findIndex(s => s.id === initialStoryId) : -1;
      setIndex(initialIdx >= 0 ? initialIdx : 0);
      setLoading(false);
    };
    fetch();
  }, [open, userId, initialStoryId]);

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

  // Like count + who-liked is only meaningful (and only ever returned by
  // get_story_like_details) when the viewer is the story's own owner —
  // other viewers of the same story never see this, server-enforced.
  const [likeDetails, setLikeDetails] = useState<{ liker_user_id: string; liker_name: string; liker_photo: string | null }[]>([]);
  const [showLikeDetails, setShowLikeDetails] = useState(false);
  const isOwnStory = !!viewerId && viewerId === userId;

  useEffect(() => {
    const current = stories[index];
    if (!current || !isOwnStory) { setLikeDetails([]); return; }
    (supabase as any)
      .rpc("get_story_like_details", { _story_id: current.id })
      .then(
        ({ data }: any) => setLikeDetails(data || []),
        (err: unknown) => console.error("Failed to load story like details:", err)
      );
  }, [stories, index, isOwnStory]);

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
    const storyId = stories[index]?.id;
    if (!message.trim() || !viewerId || sendingReply || !storyId) return;
    const text = message.trim();
    setSendingReply(true);
    try {
      const tag = lang === "ro" ? "Răspuns la story" : "Reply to story";
      const { error } = await (supabase as any).rpc("reply_to_story", {
        _story_id: storyId,
        _story_owner_id: userId,
        _content: `📖 ${tag}:\n${text}`,
      });

      if (error) {
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
      {/* modal={false} while the share sheet is open — Radix's Dialog focus
          trap otherwise swallows every pointer event outside its own
          portaled content, including clicks on StoryShareSheet's plain
          fixed-position div (rendered as a sibling, not a Dialog child), so
          its buttons would be visible but completely unclickable. */}
      <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }} modal={!showShare}>
        <DialogContent className="max-w-sm w-full p-0 bg-black border-0 overflow-hidden h-[90vh] flex flex-col gap-0" hideClose={true}>
          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            </div>
          ) : viewBlocked ? (
            <div className="flex-1 flex flex-col items-center justify-center text-white/60 text-sm gap-3 px-6 text-center">
              <span>
                {lang === "ro"
                  ? "Nu poți vedea story-urile acestei persoane din cauza setărilor sale de confidențialitate."
                  : "You can't view this person's stories due to their privacy settings."}
              </span>
              <button onClick={onClose} className="text-white/80 text-xs underline underline-offset-2">
                {lang === "ro" ? "Închide" : "Close"}
              </button>
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
                <SignedImg
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

              {/* Like count — owner-only, never shown to other viewers */}
              {isOwnStory && likeDetails.length > 0 && (
                <button
                  onClick={() => { setShowLikeDetails(true); setPaused(true); }}
                  className="flex items-center gap-1.5 px-4 py-1 shrink-0 text-white/80 hover:text-white"
                >
                  <Heart className="h-3.5 w-3.5 fill-current text-red-500" />
                  <span className="text-xs font-body">
                    {likeDetails.length} {lang === "ro" ? (likeDetails.length === 1 ? "apreciere" : "aprecieri") : (likeDetails.length === 1 ? "like" : "likes")}
                  </span>
                </button>
              )}

              {/* Bottom bar — replying to and liking your own story doesn't
                  make sense (there's no one to message, and self-likes would
                  just inflate your own count), so owners only get Share. */}
              <div className="flex items-center gap-2 px-3 py-3 shrink-0">
                {!isOwnStory && (
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
                )}

                {!isOwnStory && (
                  <button onClick={toggleLike} className="p-2 transition-transform active:scale-125">
                    <Heart
                      className="h-6 w-6 transition-colors"
                      style={{ color: liked ? "#ef4444" : "rgba(255,255,255,0.8)", fill: liked ? "#ef4444" : "none" }}
                    />
                  </button>
                )}

                {/* Share */}
                <button onClick={() => { setShowShare(true); setPaused(true); }} className={`p-2 ${isOwnStory ? "flex-1 flex items-center justify-center gap-2" : ""}`}>
                  <Forward className="h-6 w-6 text-white/80" />
                  {isOwnStory && <span className="text-white/80 text-sm font-body">{lang === "ro" ? "Distribuie" : "Share"}</span>}
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
        storyId={current?.id}
        storyOwnerId={userId}
        storyOwnerName={displayName}
        storyMediaUrl={current?.media_url}
        currentUserId={viewerId}
      />

      {/* Who-liked list — owner-only, nested Dialog needs modal=false on the
          parent (see the story-viewer Dialog above) or its clicks would be
          swallowed the same way StoryShareSheet's were. */}
      <Dialog open={showLikeDetails} onOpenChange={(v) => { setShowLikeDetails(v); if (!v) setPaused(false); }}>
        <DialogContent className="max-w-sm bg-white border-gray-200 text-gray-900 z-[110]">
          <DialogTitle>{lang === "ro" ? "Aprecieri" : "Likes"}</DialogTitle>
          {likeDetails.length === 0 ? (
            <p className="text-sm text-gray-500 py-4 text-center">
              {lang === "ro" ? "Încă nimeni nu a apreciat acest story." : "No one has liked this story yet."}
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {likeDetails.map((liker) => (
                <div key={liker.liker_user_id} className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full overflow-hidden bg-gray-100 shrink-0 flex items-center justify-center">
                    {liker.liker_photo ? <img src={liker.liker_photo} alt="" className="w-full h-full object-cover" /> : <User className="h-4 w-4 text-gray-400" />}
                  </div>
                  <span className="text-sm text-gray-900 font-body">{liker.liker_name}</span>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
