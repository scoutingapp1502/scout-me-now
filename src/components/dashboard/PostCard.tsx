import { useState, useEffect, useRef, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Heart, MessageCircle, User, MoreHorizontal, Trash2, Send, Forward, Loader2, Bookmark, Instagram, TrendingUp, RefreshCw, Archive, Eye, EyeOff, Film, Pencil, Crop, Pin, MessageSquare, Users, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { isLikelyUnwantedComment, type HideUnwantedLevel } from "@/lib/commentModeration";
import { useAccountLock } from "@/hooks/useAccountLock";

interface PostAuthor {
  user_id: string;
  name: string;
  photo: string | null;
  role: string;
  title: string;
}

interface PostData {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  video_url?: string | null;
  post_type: string;
  created_at: string;
  comments_disabled?: boolean;
}

interface Comment {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  author_name: string;
  author_photo: string | null;
  author_role: string;
  likes_count: number;
  liked_by_me: boolean;
}

interface PostCardProps {
  post: PostData;
  author: PostAuthor;
  currentUserId: string | null;
  onDelete: (postId: string) => void;
  onViewProfile: (userId: string, role: string) => void;
  hideLikeCounts?: boolean;
  hideMenu?: boolean;
  simplifiedMenu?: boolean;
}

// Batches the per-post engagement lookup (likes count, my like state,
// comments count) across every PostCard that mounts within the same tick,
// so a feed of N posts fires one request instead of N. Each card just calls
// requestEngagement(); the module-level queue does the rest.
interface EngagementResult {
  likes_count: number;
  liked_by_me: boolean;
  comments_count: number;
  hide_unwanted_comments: HideUnwantedLevel;
}
const EMPTY_ENGAGEMENT: EngagementResult = { likes_count: 0, liked_by_me: false, comments_count: 0, hide_unwanted_comments: "some" };
// Keyed per-viewer so PostCards for two different viewer ids that happen to
// mount within the same 30ms window (e.g. two profile views open at once)
// never share a batch — the previous single shared batch pinned every
// request in the window to whichever viewerId arrived first, silently
// computing liked_by_me against the wrong viewer for the others.
const pendingEngagementBatches = new Map<string, Map<string, Array<(r: EngagementResult) => void>>>();
const engagementBatchTimers = new Map<string, ReturnType<typeof setTimeout>>();

function flushEngagementBatch(viewerKey: string) {
  const batch = pendingEngagementBatches.get(viewerKey);
  pendingEngagementBatches.delete(viewerKey);
  engagementBatchTimers.delete(viewerKey);
  if (!batch || batch.size === 0) return;

  const postIds = [...batch.keys()];
  (supabase as any)
    .rpc("get_post_engagement_summary", {
      p_post_ids: postIds,
      p_viewer_id: viewerKey === "anon" ? "00000000-0000-0000-0000-000000000000" : viewerKey,
    })
    .then(({ data }: { data: any[] | null }) => {
      const resultMap = new Map<string, EngagementResult>();
      (data || []).forEach((row) => {
        resultMap.set(row.post_id, {
          likes_count: row.likes_count ?? 0,
          liked_by_me: !!row.liked_by_me,
          comments_count: row.comments_count ?? 0,
          hide_unwanted_comments: (row.hide_unwanted_comments as HideUnwantedLevel) ?? "some",
        });
      });
      batch.forEach((callbacks, postId) => {
        const result = resultMap.get(postId) ?? EMPTY_ENGAGEMENT;
        callbacks.forEach((cb) => cb(result));
      });
    })
    .catch((err: unknown) => {
      console.error("Failed to load post engagement:", err);
      batch.forEach((callbacks) => callbacks.forEach((cb) => cb(EMPTY_ENGAGEMENT)));
    });
}

function requestEngagement(postId: string, viewerId: string | null): Promise<EngagementResult> {
  return new Promise((resolve) => {
    const viewerKey = viewerId ?? "anon";
    let batch = pendingEngagementBatches.get(viewerKey);
    if (!batch) {
      batch = new Map();
      pendingEngagementBatches.set(viewerKey, batch);
    }
    const callbacks = batch.get(postId) ?? [];
    callbacks.push(resolve);
    batch.set(postId, callbacks);

    const existingTimer = engagementBatchTimers.get(viewerKey);
    if (existingTimer) clearTimeout(existingTimer);
    engagementBatchTimers.set(viewerKey, setTimeout(() => flushEngagementBatch(viewerKey), 30));
  });
}

function CommentRow({ comment: c, currentUserId, lang, onViewProfile, onDelete, onToggleLike, timeAgo }: {
  comment: Comment;
  currentUserId: string | null;
  lang: string;
  onViewProfile: (userId: string, role: string) => void;
  onDelete: (commentId: string) => void;
  onToggleLike: (commentId: string) => void;
  timeAgo: (dateStr: string) => string;
}) {
  return (
    <div className="flex items-start gap-2 group">
      <button onClick={() => onViewProfile(c.user_id, c.author_role)} className="w-7 h-7 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all">
        {c.author_photo ? (
          <img src={c.author_photo} alt="" className="w-full h-full object-cover" />
        ) : (
          <User className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-1">
          <div className="flex-1 bg-muted/50 rounded-lg px-3 py-1.5">
            <button onClick={() => onViewProfile(c.user_id, c.author_role)} className="text-xs font-medium text-foreground hover:underline cursor-pointer text-left">{c.author_name}</button>
            <p className="text-xs text-foreground/80">{c.content}</p>
          </div>
          {c.user_id === currentUserId && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0 text-muted-foreground">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onDelete(c.id)} className="text-destructive">
                  <Trash2 className="h-3.5 w-3.5 mr-2" />
                  {lang === "ro" ? "Șterge mesajul" : "Delete message"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
        <div className="flex items-center gap-2 ml-1 mt-0.5">
          <span className="text-[10px] text-muted-foreground/60">{timeAgo(c.created_at)}</span>
          <button
            onClick={() => onToggleLike(c.id)}
            className={`flex items-center gap-0.5 text-[10px] transition-colors ${c.liked_by_me ? "text-red-500" : "text-muted-foreground/60 hover:text-foreground"}`}
          >
            <Heart className={`h-3 w-3 ${c.liked_by_me ? "fill-red-500" : ""}`} />
            {c.likes_count > 0 && <span>{c.likes_count}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}

const PostCard = ({ post, author, currentUserId, onDelete, onViewProfile, hideLikeCounts = false, hideMenu = false, simplifiedMenu = false }: PostCardProps) => {
  const { lang } = useLanguage();
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  useEffect(() => {
    if (!currentUserId) return;
    supabase.from("user_roles").select("role").eq("user_id", currentUserId).maybeSingle()
      .then(({ data }) => setCurrentUserRole(data?.role ?? null))
      .catch((err) => console.error("Failed to load current user role:", err));
  }, [currentUserId]);
  const { isLocked: viewerLocked } = useAccountLock(currentUserId, currentUserRole);
  const [liked, setLiked] = useState(false);
  const [likingPending, setLikingPending] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [otherLikerName, setOtherLikerName] = useState<string | null>(null);
  const likerFetchedForRef = useRef<number>(-1);

  // Likes list dialog
  const [showLikesList, setShowLikesList] = useState(false);
  const [loadingLikers, setLoadingLikers] = useState(false);
  const [likersList, setLikersList] = useState<{ userId: string; name: string; photo: string | null; role: string; followStatus: "none" | "pending" | "accepted" | "self" }[]>([]);
  const [likersSearch, setLikersSearch] = useState("");
  const [followBusyId, setFollowBusyId] = useState<string | null>(null);
  const [showComments, setShowComments] = useState(false);
  const showCommentsRef = useRef(false);
  useEffect(() => { showCommentsRef.current = showComments; }, [showComments]);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showHiddenComments, setShowHiddenComments] = useState(false);
  const [hideUnwantedLevel, setHideUnwantedLevel] = useState<HideUnwantedLevel>("some");
  const [commentText, setCommentText] = useState("");
  const [commentsCount, setCommentsCount] = useState(0);
  const [loadingComments, setLoadingComments] = useState(false);
  const commentsLoadedRef = useRef(false);
  const commentInputRef = useRef<HTMLInputElement>(null);
  const [isNew, setIsNew] = useState(() => {
    const diff = Date.now() - new Date(post.created_at).getTime();
    return diff < 5 * 60 * 1000;
  });

  useEffect(() => {
    if (!isNew) return;
    const diff = Date.now() - new Date(post.created_at).getTime();
    const remaining = 5 * 60 * 1000 - diff;
    if (remaining <= 0) { setIsNew(false); return; }
    const timer = setTimeout(() => setIsNew(false), remaining);
    return () => clearTimeout(timer);
  }, [post.created_at, isNew]);

  // Load likes count + user like status + comments count in one batched
  // request shared across every PostCard mounted at the same time.
  useEffect(() => {
    let cancelled = false;
    requestEngagement(post.id, currentUserId).then((result) => {
      if (cancelled) return;
      setLikesCount(result.likes_count);
      setLiked(result.liked_by_me);
      setCommentsCount(result.comments_count);
      setHideUnwantedLevel(result.hide_unwanted_comments);
    });
    return () => { cancelled = true; };
  }, [post.id, currentUserId]);

  // Fetch the most recent liker (other than the viewer) for the "Liked by
  // X and others" line. Re-runs when the count changes so a fresh like
  // updates who's shown, but not on every unrelated re-render.
  useEffect(() => {
    if (hideLikeCounts || likesCount <= 0 || likerFetchedForRef.current === likesCount) return;
    likerFetchedForRef.current = likesCount;
    let cancelled = false;
    (async () => {
      const { data: likeRows } = await supabase
        .from("post_likes")
        .select("user_id")
        .eq("post_id", post.id)
        .neq("user_id", currentUserId ?? "00000000-0000-0000-0000-000000000000")
        .order("created_at", { ascending: false })
        .limit(1);
      const likerId = likeRows?.[0]?.user_id;
      if (!likerId) { if (!cancelled) setOtherLikerName(null); return; }
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from("player_profiles").select("first_name, last_name").eq("user_id", likerId).maybeSingle(),
        supabase.from("scout_profiles").select("first_name, last_name").eq("user_id", likerId).maybeSingle(),
      ]);
      const prof = p || s;
      if (!cancelled) setOtherLikerName(prof ? `${prof.first_name} ${prof.last_name}`.trim() : null);
    })();
    return () => { cancelled = true; };
  }, [likesCount, post.id, currentUserId, hideLikeCounts]);

  // Live-update likes/comments for anyone with this post open, so the
  // author sees engagement from other users without refreshing. Events
  // caused by the current viewer's own actions are skipped here because
  // toggleLike/submitComment/deleteComment already update local state
  // optimistically — applying both would double-count.
  useEffect(() => {
    const channel = supabase
      .channel(`post-engagement-${post.id}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_likes", filter: `post_id=eq.${post.id}` },
        (payload: any) => {
          if (payload.eventType === "INSERT") {
            if (payload.new?.user_id === currentUserId) return;
            setLikesCount((c) => c + 1);
          } else if (payload.eventType === "DELETE") {
            if (payload.old?.user_id === currentUserId) return;
            setLikesCount((c) => Math.max(0, c - 1));
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "post_comments", filter: `post_id=eq.${post.id}` },
        (payload: any) => {
          if (payload.eventType === "INSERT") {
            if (payload.new?.user_id !== currentUserId) setCommentsCount((c) => c + 1);
          } else if (payload.eventType === "DELETE") {
            if (payload.old?.user_id !== currentUserId) setCommentsCount((c) => Math.max(0, c - 1));
          }
          // Refresh the visible comment list (with author profiles) whenever
          // the panel is open, regardless of who made the change.
          if (showCommentsRef.current) loadComments(true);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id, currentUserId]);

  const toggleLike = async () => {
    if (!currentUserId || likingPending) return;
    setLikingPending(true);
    if (liked) {
      setLiked(false);
      setLikesCount(c => Math.max(0, c - 1));
      const { error } = await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", currentUserId);
      if (error) { setLiked(true); setLikesCount(c => c + 1); }
    } else {
      setLiked(true);
      setLikesCount(c => c + 1);
      const { error } = await supabase.from("post_likes").insert({ post_id: post.id, user_id: currentUserId } as any);
      // A unique-violation here means a nearly-simultaneous click already
      // succeeded — treat it as "still liked" instead of rolling back to a
      // false "unliked" state that doesn't match the DB.
      if (error && error.code !== "23505") { setLiked(false); setLikesCount(c => Math.max(0, c - 1)); }
    }
    setLikingPending(false);
  };

  const loadComments = async (silent = false) => {
    if (!silent) setLoadingComments(true);
    // Cap at the 100 most recent comments to avoid an unbounded query/render
    // on posts with very large comment counts, then re-sort ascending for
    // display so the visible order still reads oldest-to-newest.
    const { data: latestComments } = await supabase
      .from("post_comments")
      .select("*")
      .eq("post_id", post.id)
      .order("created_at", { ascending: false })
      .limit(100);
    const rawComments = (latestComments || []).slice().reverse();

    if (!rawComments || rawComments.length === 0) {
      setComments([]);
      commentsLoadedRef.current = true;
      if (!silent) setLoadingComments(false);
      return;
    }

    const userIds = [...new Set(rawComments.map((c: any) => c.user_id))];
    const [playerRes, scoutRes, roleRes] = await Promise.all([
      supabase.from("player_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", userIds),
      supabase.from("scout_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", userIds),
      supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
    ]);

    const roleMap = new Map<string, string>();
    (roleRes.data || []).forEach(r => roleMap.set(r.user_id, r.role));
    const profileMap = new Map<string, { name: string; photo: string | null }>();
    (playerRes.data || []).forEach(p => profileMap.set(p.user_id, { name: `${p.first_name} ${p.last_name}`.trim(), photo: p.photo_url }));
    (scoutRes.data || []).forEach(s => { if (!profileMap.has(s.user_id)) profileMap.set(s.user_id, { name: `${s.first_name} ${s.last_name}`.trim(), photo: s.photo_url }); });

    // Fetch comment likes
    const commentIds = rawComments.map((c: any) => c.id);
    const [likesRes, myLikesRes] = await Promise.all([
      supabase.from("comment_likes").select("comment_id", { count: "exact" }).in("comment_id", commentIds),
      currentUserId
        ? supabase.from("comment_likes").select("comment_id").in("comment_id", commentIds).eq("user_id", currentUserId)
        : Promise.resolve({ data: [] }),
    ]);

    const likesCountMap = new Map<string, number>();
    (likesRes.data || []).forEach((l: any) => {
      likesCountMap.set(l.comment_id, (likesCountMap.get(l.comment_id) || 0) + 1);
    });
    const myLikedSet = new Set((myLikesRes.data || []).map((l: any) => l.comment_id));

    setComments(rawComments.map((c: any) => {
      const profile = profileMap.get(c.user_id);
      return {
        ...c,
        author_name: profile?.name || (lang === "ro" ? "Utilizator" : "User"),
        author_photo: profile?.photo || null,
        author_role: roleMap.get(c.user_id) || "player",
        likes_count: likesCountMap.get(c.id) || 0,
        liked_by_me: myLikedSet.has(c.id),
      };
    }));
    commentsLoadedRef.current = true;
    if (!silent) setLoadingComments(false);
  };

  const handleCommentClick = () => {
    if (showComments) {
      setShowComments(false);
      return;
    }
    setShowComments(true);
    if (!canSeeComments) return;
    if (commentsLoadedRef.current) {
      // Already loaded at least once — open instantly and refresh quietly
      // in the background instead of blocking on a fresh round trip.
      loadComments(true);
    } else {
      loadComments();
    }
    setTimeout(() => commentInputRef.current?.focus(), 100);
  };

  const submitComment = async () => {
    if (!commentText.trim() || !currentUserId) return;
    const text = commentText.trim();
    const { error } = await supabase.from("post_comments").insert({
      post_id: post.id,
      user_id: currentUserId,
      content: text,
    } as any);
    if (error) {
      toast.error(lang === "ro" ? "Comentariul nu a putut fi trimis." : "Comment could not be sent.");
      return;
    }
    setCommentText("");
    setCommentsCount(c => c + 1);
    loadComments(true);
  };

  const toggleCommentLike = async (commentId: string) => {
    if (!currentUserId) return;
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;
    if (comment.liked_by_me) {
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, liked_by_me: false, likes_count: Math.max(0, c.likes_count - 1) } : c));
      const { error } = await supabase.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", currentUserId);
      if (error) setComments(prev => prev.map(c => c.id === commentId ? { ...c, liked_by_me: true, likes_count: c.likes_count + 1 } : c));
    } else {
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, liked_by_me: true, likes_count: c.likes_count + 1 } : c));
      const { error } = await supabase.from("comment_likes").insert({ comment_id: commentId, user_id: currentUserId } as any);
      if (error) setComments(prev => prev.map(c => c.id === commentId ? { ...c, liked_by_me: false, likes_count: Math.max(0, c.likes_count - 1) } : c));
    }
  };

  const deleteComment = async (commentId: string) => {
    const { error } = await supabase.from("post_comments").delete().eq("id", commentId);
    if (error) {
      toast.error(lang === "ro" ? "Comentariul nu a putut fi șters." : "Comment could not be deleted.");
      return;
    }
    setCommentsCount(c => Math.max(0, c - 1));
    setComments(prev => prev.filter(c => c.id !== commentId));
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return lang === "ro" ? "acum" : "now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString(lang === "ro" ? "ro-RO" : "en-US", { day: "numeric", month: "short" });
  };

  const timeAgoLong = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return lang === "ro" ? "acum câteva secunde" : "just now";
    if (mins < 60) return lang === "ro" ? `acum ${mins} ${mins === 1 ? "minut" : "minute"}` : `${mins} ${mins === 1 ? "minute" : "minutes"} ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return lang === "ro" ? `acum ${hours} ${hours === 1 ? "oră" : "ore"}` : `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return lang === "ro" ? `acum ${days} ${days === 1 ? "zi" : "zile"}` : `${days} ${days === 1 ? "day" : "days"} ago`;
    return new Date(dateStr).toLocaleDateString(lang === "ro" ? "ro-RO" : "en-US", { day: "numeric", month: "short" });
  };

  const openLikesList = () => {
    setShowLikesList(true);
    setLikersSearch("");
    loadLikers();
  };

  const loadLikers = async () => {
    setLoadingLikers(true);
    const { data: likeRows } = await supabase
      .from("post_likes")
      .select("user_id, created_at")
      .eq("post_id", post.id)
      .order("created_at", { ascending: false });
    const userIds = (likeRows ?? []).map((r: any) => r.user_id);
    if (userIds.length === 0) { setLikersList([]); setLoadingLikers(false); return; }

    const [playerRes, scoutRes, roleRes, followRes] = await Promise.all([
      supabase.from("player_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", userIds),
      supabase.from("scout_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", userIds),
      supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
      currentUserId
        ? supabase.from("follows").select("following_id, status").eq("follower_id", currentUserId).in("following_id", userIds)
        : Promise.resolve({ data: [] }),
    ]);

    const profileMap = new Map<string, { name: string; photo: string | null }>();
    (playerRes.data || []).forEach((p: any) => profileMap.set(p.user_id, { name: `${p.first_name} ${p.last_name}`.trim(), photo: p.photo_url }));
    (scoutRes.data || []).forEach((s: any) => { if (!profileMap.has(s.user_id)) profileMap.set(s.user_id, { name: `${s.first_name} ${s.last_name}`.trim(), photo: s.photo_url }); });
    const roleMap = new Map<string, string>();
    (roleRes.data || []).forEach((r: any) => roleMap.set(r.user_id, r.role));
    const followMap = new Map<string, string>();
    (followRes.data || []).forEach((f: any) => followMap.set(f.following_id, f.status));

    setLikersList(userIds.map((uid: string) => ({
      userId: uid,
      name: profileMap.get(uid)?.name || (lang === "ro" ? "Utilizator" : "User"),
      photo: profileMap.get(uid)?.photo || null,
      role: roleMap.get(uid) || "player",
      followStatus: uid === currentUserId ? "self" : ((followMap.get(uid) as any) || "none"),
    })));
    setLoadingLikers(false);
  };

  const toggleLikerFollow = async (uid: string, status: string) => {
    if (!currentUserId) return;
    setFollowBusyId(uid);
    if (status === "accepted" || status === "pending") {
      const { error } = await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", uid);
      if (!error) setLikersList(prev => prev.map(l => l.userId === uid ? { ...l, followStatus: "none" } : l));
    } else {
      const { error } = await supabase.rpc("request_follow", { _following_id: uid });
      if (!error) setLikersList(prev => prev.map(l => l.userId === uid ? { ...l, followStatus: "pending" } : l));
    }
    setFollowBusyId(null);
  };

  const filteredLikers = likersList.filter(l => l.name.toLowerCase().includes(likersSearch.toLowerCase()));

  const likedByContent = () => {
    if (hideLikeCounts || likesCount <= 0) return null;
    const others = (
      <button onClick={openLikesList} className="hover:underline">
        {lang === "ro" ? `alți ${likesCount - 1}` : `${likesCount - 1} others`}
      </button>
    );
    if (liked && likesCount === 1) return lang === "ro" ? "Apreciat de tine" : "Liked by you";
    if (liked) return <>{lang === "ro" ? "Apreciat de tine și " : "Liked by you and "}{others}</>;
    if (otherLikerName && likesCount === 1) return lang === "ro" ? `Apreciat de ${otherLikerName}` : `Liked by ${otherLikerName}`;
    if (otherLikerName) return <>{lang === "ro" ? `Apreciat de ${otherLikerName} și ` : `Liked by ${otherLikerName} and `}{others}</>;
    return (
      <button onClick={openLikesList} className="hover:underline">
        {lang === "ro" ? `${likesCount} aprecieri` : `${likesCount} likes`}
      </button>
    );
  };

  const getRoleLabel = (role: string) => {
    if (role === "cauta_jucator") return lang === "ro" ? "Descoperitor" : "Discoverer";
    return lang === "ro" ? "Jucător" : "Player";
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case "transfer": return "bg-blue-500/20 text-blue-400";
      case "challenge": return "bg-orange-500/20 text-orange-400";
      case "event": return "bg-green-500/20 text-green-400";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const getTypeLabel = (type: string) => {
    const types: Record<string, { ro: string; en: string }> = {
      transfer: { ro: "Transfer / Colaborare", en: "Transfer / Collaboration" },
      challenge: { ro: "Provocare", en: "Challenge" },
      event: { ro: "Eveniment", en: "Event" },
    };
    return types[type] ? (lang === "ro" ? types[type].ro : types[type].en) : type;
  };

  const isOwnPost = post.user_id === currentUserId;

  const [commentsDisabled, setCommentsDisabled] = useState(!!post.comments_disabled);
  const [togglingComments, setTogglingComments] = useState(false);
  const canSeeComments = !commentsDisabled || isOwnPost;

  const handleToggleComments = async () => {
    const next = !commentsDisabled;
    setTogglingComments(true);
    setCommentsDisabled(next);
    const { error } = await (supabase as any).from("posts").update({ comments_disabled: next }).eq("id", post.id);
    setTogglingComments(false);
    if (error) {
      setCommentsDisabled(!next);
      toast.error(lang === "ro" ? "Nu s-a putut actualiza setarea." : "Could not update the setting.");
      return;
    }
    if (next) setShowComments(false);
  };

  // Split comments into visible / likely-unwanted using the post author's
  // "hide unwanted comments" level. Own comments are never hidden from you.
  const { visibleComments, hiddenComments } = useMemo(() => {
    const visible: Comment[] = [];
    const hidden: Comment[] = [];
    for (const c of comments) {
      if (c.user_id !== currentUserId && isLikelyUnwantedComment(c.content, hideUnwantedLevel)) {
        hidden.push(c);
      } else {
        visible.push(c);
      }
    }
    return { visibleComments: visible, hiddenComments: hidden };
  }, [comments, hideUnwantedLevel, currentUserId]);

  // Saved state
  const [saved, setSaved] = useState(false);
  const [savingPending, setSavingPending] = useState(false);

  const handleArchive = async () => {
    if (!currentUserId || currentUserId !== post.user_id) return;
    const { error } = await (supabase as any).from("posts").update({ is_archived: true }).eq("id", post.id);
    if (error) {
      toast.error(lang === "ro" ? "Nu s-a putut arhiva postarea." : "Failed to archive post.");
      return;
    }
    toast.success(lang === "ro" ? "Postare arhivată." : "Post archived.");
    onDelete(post.id);
  };

  useEffect(() => {
    if (!currentUserId) return;
    supabase
      .from("saved_posts" as any)
      .select("id")
      .eq("post_id", post.id)
      .eq("user_id", currentUserId)
      .maybeSingle()
      .then(
        ({ data }) => setSaved(!!data),
        (err) => console.error("Failed to check saved state:", err)
      );
  }, [post.id, currentUserId]);

  const toggleSave = async () => {
    if (!currentUserId || savingPending) return;
    setSavingPending(true);
    try {
      if (saved) {
        const { error } = await supabase.from("saved_posts" as any).delete().eq("post_id", post.id).eq("user_id", currentUserId);
        if (error) {
          toast.error(lang === "ro" ? "Nu s-a putut elimina din salvate." : "Failed to remove from saved.");
          return;
        }
        setSaved(false);
        toast.info(lang === "ro" ? "Postare eliminată din salvate." : "Post removed from saved.");
      } else {
        const { error } = await supabase.from("saved_posts" as any).insert({ post_id: post.id, user_id: currentUserId });
        // A unique-violation means an almost-simultaneous click already
        // saved it — treat as success instead of surfacing a spurious error.
        if (error && error.code !== "23505") {
          toast.error(lang === "ro" ? "Nu s-a putut salva postarea." : "Failed to save post.");
          return;
        }
        setSaved(true);
        toast.success(lang === "ro" ? "Postare salvată." : "Post saved.");
      }
    } finally {
      setSavingPending(false);
    }
  };

  // Edit mode
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [savingEdit, setSavingEdit] = useState(false);

  const handleEditSave = async () => {
    if (!editContent.trim()) return;
    setSavingEdit(true);
    const { error } = await supabase.from("posts").update({ content: editContent.trim() } as any).eq("id", post.id);
    if (error) { toast.error(lang === "ro" ? "Eroare la salvare." : "Failed to save."); }
    else { setIsEditing(false); }
    setSavingEdit(false);
  };

  // Share dialog
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [followingList, setFollowingList] = useState<{ userId: string; name: string; photo: string | null }[]>([]);
  const [loadingFollowing, setLoadingFollowing] = useState(false);
  const [groupList, setGroupList] = useState<{ groupId: string; name: string }[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [sendingTo, setSendingTo] = useState<string | null>(null);

  const fetchFollowing = async () => {
    if (!currentUserId) return;
    setLoadingFollowing(true);
    const { data: follows } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", currentUserId)
      .eq("status", "accepted");
    const ids = (follows || []).map(f => f.following_id);
    if (ids.length === 0) { setFollowingList([]); setLoadingFollowing(false); return; }

    const [playerRes, scoutRes] = await Promise.all([
      supabase.from("player_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", ids),
      supabase.from("scout_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", ids),
    ]);
    const profileMap = new Map<string, { name: string; photo: string | null }>();
    (playerRes.data || []).forEach(p => profileMap.set(p.user_id, { name: `${p.first_name} ${p.last_name}`.trim(), photo: p.photo_url }));
    (scoutRes.data || []).forEach(s => { if (!profileMap.has(s.user_id)) profileMap.set(s.user_id, { name: `${s.first_name} ${s.last_name}`.trim(), photo: s.photo_url }); });

    setFollowingList(ids.map(id => ({ userId: id, name: profileMap.get(id)?.name || "Utilizator", photo: profileMap.get(id)?.photo || null })));
    setLoadingFollowing(false);
  };

  const fetchGroupsForShare = async () => {
    if (!currentUserId) return;
    setLoadingGroups(true);
    const { data: memberships } = await (supabase as any)
      .from("group_members").select("group_id").eq("user_id", currentUserId);
    const groupIds = (memberships || []).map((m: any) => m.group_id);
    if (groupIds.length === 0) { setGroupList([]); setLoadingGroups(false); return; }

    const { data: groupsData } = await (supabase as any)
      .from("group_conversations").select("id, name").in("id", groupIds);
    setGroupList((groupsData || []).map((g: any) => ({
      groupId: g.id,
      name: g.name || (lang === "ro" ? "Grup fără nume" : "Unnamed group"),
    })));
    setLoadingGroups(false);
  };

  const handleShareTo = async (targetUserId: string) => {
    if (!currentUserId) return;
    setSendingTo(targetUserId);
    const { data: convId, error } = await supabase.rpc("get_or_create_conversation", { other_user_id: targetUserId });
    if (!convId || error) {
      toast.error(lang === "ro" ? "Nu se poate trimite mesajul." : "Could not send message.");
      setSendingTo(null);
      return;
    }
    const excerpt = post.content.length > 120 ? post.content.slice(0, 120) + "…" : post.content;
    const messageContent = `🔗 ${author.name}:\n"${excerpt}"`;
    const { error: sendError } = await supabase.from("messages").insert({ conversation_id: convId, sender_id: currentUserId, content: messageContent, shared_post_id: post.id } as any);
    setSendingTo(null);
    if (sendError) {
      toast.error(lang === "ro" ? "Nu s-a putut trimite postarea." : "Could not send the post.");
      return;
    }
    setShowShareDialog(false);
    toast.success(lang === "ro" ? "Postare trimisă!" : "Post sent!");
  };

  const handleShareToGroup = async (groupId: string) => {
    if (!currentUserId) return;
    setSendingTo(groupId);
    const excerpt = post.content.length > 120 ? post.content.slice(0, 120) + "…" : post.content;
    const messageContent = `🔗 ${author.name}:\n"${excerpt}"`;
    const { error } = await (supabase as any)
      .from("group_messages").insert({ group_id: groupId, sender_id: currentUserId, content: messageContent, shared_post_id: post.id });
    setSendingTo(null);
    if (error) {
      toast.error(lang === "ro" ? "Nu s-a putut trimite postarea." : "Could not send the post.");
      return;
    }
    setShowShareDialog(false);
    toast.success(lang === "ro" ? "Postare trimisă!" : "Post sent!");
  };

  return (
    <div className={`bg-card border rounded-xl overflow-hidden transition-colors ${isNew ? "border-primary/50 ring-1 ring-primary/20" : "border-border"}`}>
      {isNew && (
        <div className="px-4 py-1 bg-primary/10 text-primary text-xs font-medium">
          {lang === "ro" ? "✨ Postare nouă" : "✨ New post"}
        </div>
      )}
      <div className="p-4 pb-3">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => onViewProfile(author.user_id, author.role)}
              className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0 cursor-pointer hover:ring-2 hover:ring-primary/50 transition-all"
            >
              {author.photo ? (
                <img src={author.photo} alt={author.name} className="w-full h-full object-cover" />
              ) : (
                <User className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onViewProfile(author.user_id, author.role)}
                  className="font-display text-sm text-foreground truncate hover:underline cursor-pointer"
                >
                  {author.name}
                </button>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium shrink-0">
                  {getRoleLabel(author.role)}
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">{author.title}</p>
            </div>
          </div>
          {isOwnPost && !hideMenu && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                {simplifiedMenu ? (
                  <>
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      <Pencil className="h-4 w-4 mr-2" /> {lang === "ro" ? "Editează" : "Edit"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleToggleComments} disabled={togglingComments}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      {commentsDisabled
                        ? (lang === "ro" ? "Activează comentariile" : "Turn on commenting")
                        : (lang === "ro" ? "Dezactivează comentariile" : "Turn off commenting")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onDelete(post.id)} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" /> {lang === "ro" ? "Șterge" : "Delete"}
                    </DropdownMenuItem>
                  </>
                ) : (
                  <>
                    <DropdownMenuItem onClick={toggleSave} disabled={viewerLocked}>
                      <Bookmark className={`h-4 w-4 mr-2 ${saved ? "fill-current" : ""}`} />
                      {saved ? (lang === "ro" ? "Elimină din salvate" : "Unsave") : (lang === "ro" ? "Salvează" : "Save")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toast.info(lang === "ro" ? "Funcționalitate în curând." : "Coming soon.")}>
                      <Instagram className="h-4 w-4 mr-2" /> {lang === "ro" ? "Distribuie pe Instagram" : "Share to Instagram"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toast.info(lang === "ro" ? "Funcționalitate în curând." : "Coming soon.")}>
                      <TrendingUp className="h-4 w-4 mr-2" /> {lang === "ro" ? "Statistici" : "Insights"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toast.info(lang === "ro" ? "Funcționalitate în curând." : "Coming soon.")}>
                      <RefreshCw className="h-4 w-4 mr-2" /> {lang === "ro" ? "Permite refolosirea" : "Allow reuse"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {currentUserId === post.user_id && (
                      <DropdownMenuItem onClick={handleArchive}>
                        <Archive className="h-4 w-4 mr-2" /> {lang === "ro" ? "Arhivează" : "Archive"}
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => toast.info(lang === "ro" ? "Funcționalitate în curând." : "Coming soon.")}>
                      <Eye className="h-4 w-4 mr-2" /> {lang === "ro" ? "Afișează nr. like-uri" : "Unhide like count"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toast.info(lang === "ro" ? "Funcționalitate în curând." : "Coming soon.")}>
                      <EyeOff className="h-4 w-4 mr-2" /> {lang === "ro" ? "Ascunde nr. distribuiri" : "Hide share count"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleToggleComments} disabled={togglingComments}>
                      <MessageSquare className="h-4 w-4 mr-2" />
                      {commentsDisabled
                        ? (lang === "ro" ? "Activează comentariile" : "Turn on commenting")
                        : (lang === "ro" ? "Dezactivează comentariile" : "Turn off commenting")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => toast.info(lang === "ro" ? "Funcționalitate în curând." : "Coming soon.")}>
                      <Film className="h-4 w-4 mr-2" /> {lang === "ro" ? "Creează reel din postare" : "Create reel from post"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setIsEditing(true)}>
                      <Pencil className="h-4 w-4 mr-2" /> {lang === "ro" ? "Editează" : "Edit"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toast.info(lang === "ro" ? "Funcționalitate în curând." : "Coming soon.")}>
                      <Crop className="h-4 w-4 mr-2" /> {lang === "ro" ? "Ajustează previzualizarea" : "Adjust preview"}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toast.info(lang === "ro" ? "Funcționalitate în curând." : "Coming soon.")}>
                      <Pin className="h-4 w-4 mr-2" /> {lang === "ro" ? "Fixează în profil" : "Pin to main grid"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => onDelete(post.id)} className="text-destructive">
                      <Trash2 className="h-4 w-4 mr-2" /> {lang === "ro" ? "Șterge" : "Delete"}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Image */}
      {post.image_url && (
        <img src={post.image_url} alt="" loading="lazy" className="w-full max-h-96 object-cover" />
      )}

      {/* Video */}
      {post.video_url && (
        <video src={post.video_url} className="w-full max-h-96" controls preload="none" />
      )}

      {/* Like & Comment bar */}
      <div className="px-4 py-2 border-t border-border flex items-center gap-4 flex-wrap">
        <button
          onClick={toggleLike}
          disabled={likingPending || viewerLocked}
          className={`flex items-center gap-1.5 text-sm transition-colors disabled:opacity-60 ${liked ? "text-red-500" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-red-500" : ""}`} />
        </button>
        <button
          onClick={handleCommentClick}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          {canSeeComments && commentsCount > 0 && <span className="text-xs">{commentsCount}</span>}
        </button>
        <button
          onClick={() => { setShowShareDialog(true); fetchFollowing(); fetchGroupsForShare(); }}
          disabled={viewerLocked}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-60"
        >
          <Forward className="h-4 w-4" />
        </button>
        <button
          onClick={toggleSave}
          disabled={savingPending || viewerLocked}
          className={`ml-auto flex items-center transition-colors disabled:opacity-60 ${saved ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Bookmark className={`h-5 w-5 ${saved ? "fill-current" : ""}`} />
        </button>
      </div>

      {/* Liked by + caption + timestamp */}
      <div className="px-4 pb-3 space-y-1">
        {(() => {
          const content = likedByContent();
          return content && <p className="text-sm font-medium text-foreground">{content}</p>;
        })()}

        {post.post_type !== "general" && (
          <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium ${getTypeBadgeColor(post.post_type)}`}>
            {getTypeLabel(post.post_type)}
          </span>
        )}

        {isEditing ? (
          <div className="space-y-2 mt-1">
            <textarea
              value={editContent}
              onChange={e => setEditContent(e.target.value)}
              className="w-full text-sm bg-muted/50 border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2 justify-end">
              <button onClick={() => { setIsEditing(false); setEditContent(post.content); }} className="text-xs text-muted-foreground hover:text-foreground font-body px-2 py-1">
                {lang === "ro" ? "Anulează" : "Cancel"}
              </button>
              <button onClick={handleEditSave} disabled={savingEdit || !editContent.trim()} className="text-xs bg-primary text-primary-foreground px-3 py-1 rounded-md font-body disabled:opacity-50 flex items-center gap-1">
                {savingEdit && <Loader2 className="h-3 w-3 animate-spin" />}
                {lang === "ro" ? "Salvează" : "Save"}
              </button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-foreground/90 whitespace-pre-wrap">
            <button
              onClick={() => onViewProfile(author.user_id, author.role)}
              className="font-semibold text-foreground hover:underline mr-1.5"
            >
              {author.name}
            </button>
            {editContent}
          </p>
        )}

        <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wide pt-0.5">{timeAgoLong(post.created_at)}</p>
      </div>

      {/* Share dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-base">
              {lang === "ro" ? "Trimite postarea" : "Send post"}
            </DialogTitle>
          </DialogHeader>
          {loadingFollowing || loadingGroups ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : followingList.length === 0 && groupList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 font-body">
              {lang === "ro" ? "Nu urmărești pe nimeni momentan." : "You're not following anyone yet."}
            </p>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {groupList.map(g => (
                <button
                  key={g.groupId}
                  onClick={() => handleShareToGroup(g.groupId)}
                  disabled={!!sendingTo}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Users className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-sm font-medium font-body flex-1">{g.name}</span>
                  {sendingTo === g.groupId ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Forward className="h-4 w-4 text-muted-foreground" />}
                </button>
              ))}
              {followingList.map(u => (
                <button
                  key={u.userId}
                  onClick={() => handleShareTo(u.userId)}
                  disabled={!!sendingTo}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-muted/50 transition-colors text-left disabled:opacity-50"
                >
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {u.photo ? <img src={u.photo} alt="" className="w-full h-full object-cover" /> : <User className="h-4 w-4 text-muted-foreground" />}
                  </div>
                  <span className="text-sm font-medium font-body flex-1">{u.name}</span>
                  {sendingTo === u.userId ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <Forward className="h-4 w-4 text-muted-foreground" />}
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Likes list dialog */}
      <Dialog open={showLikesList} onOpenChange={setShowLikesList}>
        <DialogContent className="max-w-sm p-0 gap-0 max-h-[80vh] flex flex-col">
          <DialogHeader className="px-4 pt-4 pb-2">
            <DialogTitle className="font-heading text-base text-center">
              {lang === "ro" ? "Aprecieri" : "Likes"}
            </DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={likersSearch}
                onChange={(e) => setLikersSearch(e.target.value)}
                placeholder={lang === "ro" ? "Caută" : "Search"}
                className="pl-9 rounded-full bg-muted border-0"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {loadingLikers ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
              </div>
            ) : filteredLikers.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8 font-body">
                {lang === "ro" ? "Niciun rezultat." : "No results."}
              </p>
            ) : (
              filteredLikers.map((l) => (
                <div key={l.userId} className="flex items-center gap-3 px-2 py-2.5">
                  <button
                    onClick={() => { setShowLikesList(false); onViewProfile(l.userId, l.role); }}
                    className="flex items-center gap-3 flex-1 min-w-0 text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                      {l.photo ? <img src={l.photo} alt="" className="w-full h-full object-cover" /> : <User className="h-5 w-5 text-muted-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{l.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{getRoleLabel(l.role)}</p>
                    </div>
                  </button>
                  {l.followStatus !== "self" && (
                    <Button
                      size="sm"
                      variant={l.followStatus === "accepted" || l.followStatus === "pending" ? "secondary" : "default"}
                      disabled={followBusyId === l.userId}
                      onClick={() => toggleLikerFollow(l.userId, l.followStatus)}
                      className="shrink-0"
                    >
                      {followBusyId === l.userId ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : l.followStatus === "accepted" ? (
                        lang === "ro" ? "Urmărit" : "Following"
                      ) : l.followStatus === "pending" ? (
                        lang === "ro" ? "În așteptare" : "Requested"
                      ) : (
                        lang === "ro" ? "Urmărește" : "Follow"
                      )}
                    </Button>
                  )}
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Comments section */}
      {showComments && !canSeeComments && (
        <div className="px-4 pb-3 border-t border-border pt-3">
          <p className="text-xs text-muted-foreground">
            {lang === "ro" ? "Comentariile au fost dezactivate pentru această postare." : "Comments are turned off for this post."}
          </p>
        </div>
      )}
      {showComments && canSeeComments && (
        <div className="px-4 pb-3 border-t border-border pt-3 space-y-3">
          {loadingComments ? (
            <p className="text-xs text-muted-foreground">{lang === "ro" ? "Se încarcă..." : "Loading..."}</p>
          ) : comments.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {visibleComments.map(c => (
                <CommentRow
                  key={c.id}
                  comment={c}
                  currentUserId={currentUserId}
                  lang={lang}
                  onViewProfile={onViewProfile}
                  onDelete={deleteComment}
                  onToggleLike={toggleCommentLike}
                  timeAgo={timeAgo}
                />
              ))}
              {hiddenComments.length > 0 && (
                <div className="pt-1">
                  <button
                    onClick={() => setShowHiddenComments(v => !v)}
                    className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
                  >
                    {showHiddenComments
                      ? (lang === "ro" ? "Ascunde comentariile nedorite" : "Hide unwanted comments")
                      : (lang === "ro" ? `Arată ${hiddenComments.length} comentarii nedorite` : `Show ${hiddenComments.length} unwanted comments`)}
                  </button>
                  {showHiddenComments && (
                    <div className="space-y-2 mt-2">
                      {hiddenComments.map(c => (
                        <CommentRow
                          key={c.id}
                          comment={c}
                          currentUserId={currentUserId}
                          lang={lang}
                          onViewProfile={onViewProfile}
                          onDelete={deleteComment}
                          onToggleLike={toggleCommentLike}
                          timeAgo={timeAgo}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{lang === "ro" ? "Niciun comentariu încă" : "No comments yet"}</p>
          )}

          {/* Comment input */}
          {commentsDisabled ? (
            <p className="text-[11px] text-muted-foreground">
              {lang === "ro" ? "Ai dezactivat comentariile pentru această postare." : "You've turned off commenting for this post."}
            </p>
          ) : (
            <div className="flex items-center gap-2">
              <Input
                ref={commentInputRef}
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitComment()}
                placeholder={lang === "ro" ? "Scrie un comentariu..." : "Write a comment..."}
                className="text-xs h-8 bg-background border-border"
                disabled={viewerLocked}
              />
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={submitComment} disabled={!commentText.trim() || viewerLocked}>
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default PostCard;
