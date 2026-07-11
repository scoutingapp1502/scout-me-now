import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Heart, MessageCircle, User, MoreHorizontal, Trash2, Send, Forward, Loader2, Bookmark, Instagram, TrendingUp, RefreshCw, Archive, Eye, EyeOff, Film, Pencil, Crop, Pin, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

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
}

const PostCard = ({ post, author, currentUserId, onDelete, onViewProfile, hideLikeCounts = false }: PostCardProps) => {
  const { lang } = useLanguage();
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentsCount, setCommentsCount] = useState(0);
  const [loadingComments, setLoadingComments] = useState(false);
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

  // Load likes count + user like status
  useEffect(() => {
    loadLikes();
    loadCommentsCount();
  }, [post.id, currentUserId]);

  const loadLikes = async () => {
    // Use RPC to respect feed_activity_visibility privacy setting
    const { data: rpcData } = await (supabase as any).rpc("get_visible_likes_count", {
      p_post_id: post.id,
      p_viewer_id: currentUserId ?? "00000000-0000-0000-0000-000000000000",
    });
    setLikesCount(typeof rpcData === "number" ? rpcData : 0);

    if (currentUserId) {
      const { data } = await supabase
        .from("post_likes")
        .select("id")
        .eq("post_id", post.id)
        .eq("user_id", currentUserId)
        .maybeSingle();
      setLiked(!!data);
    }
  };

  const loadCommentsCount = async () => {
    const { count } = await supabase
      .from("post_comments")
      .select("*", { count: "exact", head: true })
      .eq("post_id", post.id);
    setCommentsCount(count || 0);
  };

  const toggleLike = async () => {
    if (!currentUserId) return;
    if (liked) {
      await supabase.from("post_likes").delete().eq("post_id", post.id).eq("user_id", currentUserId);
      setLiked(false);
      setLikesCount(c => Math.max(0, c - 1));
    } else {
      await supabase.from("post_likes").insert({ post_id: post.id, user_id: currentUserId } as any);
      setLiked(true);
      setLikesCount(c => c + 1);
    }
  };

  const loadComments = async () => {
    setLoadingComments(true);
    const { data: rawComments } = await supabase
      .from("post_comments")
      .select("*")
      .eq("post_id", post.id)
      .order("created_at", { ascending: true });

    if (!rawComments || rawComments.length === 0) {
      setComments([]);
      setLoadingComments(false);
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
    setLoadingComments(false);
  };

  const handleToggleComments = () => {
    if (!showComments) {
      loadComments();
    }
    setShowComments(!showComments);
  };

  const handleCommentClick = () => {
    if (!showComments) {
      loadComments();
      setShowComments(true);
    }
    setTimeout(() => commentInputRef.current?.focus(), 100);
  };

  const submitComment = async () => {
    if (!commentText.trim() || !currentUserId) return;
    await supabase.from("post_comments").insert({
      post_id: post.id,
      user_id: currentUserId,
      content: commentText.trim(),
    } as any);
    setCommentText("");
    setCommentsCount(c => c + 1);
    loadComments();
  };

  const toggleCommentLike = async (commentId: string) => {
    if (!currentUserId) return;
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;
    if (comment.liked_by_me) {
      await supabase.from("comment_likes").delete().eq("comment_id", commentId).eq("user_id", currentUserId);
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, liked_by_me: false, likes_count: Math.max(0, c.likes_count - 1) } : c));
    } else {
      await supabase.from("comment_likes").insert({ comment_id: commentId, user_id: currentUserId } as any);
      setComments(prev => prev.map(c => c.id === commentId ? { ...c, liked_by_me: true, likes_count: c.likes_count + 1 } : c));
    }
  };

  const deleteComment = async (commentId: string) => {
    await supabase.from("post_comments").delete().eq("id", commentId);
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

  const getRoleLabel = (role: string) => {
    if (role === "scout") return "Scouter";
    if (role === "agent") return "Agent";
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

  // Saved state
  const [saved, setSaved] = useState(false);

  const handleArchive = async () => {
    if (!currentUserId || currentUserId !== post.user_id) return;
    await (supabase as any).from("posts").update({ is_archived: true }).eq("id", post.id);
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
      .then(({ data }) => setSaved(!!data));
  }, [post.id, currentUserId]);

  const toggleSave = async () => {
    if (!currentUserId) return;
    if (saved) {
      await supabase.from("saved_posts" as any).delete().eq("post_id", post.id).eq("user_id", currentUserId);
      setSaved(false);
      toast.info(lang === "ro" ? "Postare eliminată din salvate." : "Post removed from saved.");
    } else {
      await supabase.from("saved_posts" as any).insert({ post_id: post.id, user_id: currentUserId });
      setSaved(true);
      toast.success(lang === "ro" ? "Postare salvată." : "Post saved.");
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
    await supabase.from("messages").insert({ conversation_id: convId, sender_id: currentUserId, content: messageContent } as any);
    setSendingTo(null);
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
      <div className="p-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
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
              <p className="text-[10px] text-muted-foreground/60">{timeAgo(post.created_at)}</p>
            </div>
          </div>
          {isOwnPost && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={toggleSave}>
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
                <DropdownMenuItem onClick={() => toast.info(lang === "ro" ? "Funcționalitate în curând." : "Coming soon.")}>
                  <MessageSquare className="h-4 w-4 mr-2" /> {lang === "ro" ? "Dezactivează comentariile" : "Turn off commenting"}
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
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Type badge */}
        {post.post_type !== "general" && (
          <span className={`inline-block text-[10px] px-2 py-0.5 rounded-full font-medium mb-2 ${getTypeBadgeColor(post.post_type)}`}>
            {getTypeLabel(post.post_type)}
          </span>
        )}

        {/* Content */}
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
          <p className="text-sm text-foreground/90 whitespace-pre-wrap">{editContent}</p>
        )}
      </div>

      {/* Image */}
      {post.image_url && (
        <img src={post.image_url} alt="" className="w-full max-h-96 object-cover" />
      )}

      {/* Video */}
      {post.video_url && (
        <video src={post.video_url} className="w-full max-h-96" controls />
      )}

      {/* Like & Comment bar */}
      <div className="px-4 py-2 border-t border-border flex items-center gap-4 flex-wrap">
        <button
          onClick={toggleLike}
          className={`flex items-center gap-1.5 text-sm transition-colors ${liked ? "text-red-500" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-red-500" : ""}`} />
          {likesCount > 0 && !hideLikeCounts && <span className="text-xs">{likesCount}</span>}
        </button>
        <button
          onClick={handleCommentClick}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          {commentsCount > 0 && <span className="text-xs">{commentsCount}</span>}
        </button>
        <button
          onClick={() => { setShowShareDialog(true); fetchFollowing(); }}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <Forward className="h-4 w-4" />
        </button>
        <button
          onClick={toggleSave}
          className={`ml-auto flex items-center transition-colors ${saved ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Bookmark className={`h-5 w-5 ${saved ? "fill-current" : ""}`} />
        </button>
      </div>

      {/* Share dialog */}
      <Dialog open={showShareDialog} onOpenChange={setShowShareDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-heading text-base">
              {lang === "ro" ? "Trimite postarea" : "Send post"}
            </DialogTitle>
          </DialogHeader>
          {loadingFollowing ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          ) : followingList.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6 font-body">
              {lang === "ro" ? "Nu urmărești pe nimeni momentan." : "You're not following anyone yet."}
            </p>
          ) : (
            <div className="space-y-1 max-h-72 overflow-y-auto">
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

      {/* Comments section */}
      {showComments && (
        <div className="px-4 pb-3 border-t border-border pt-3 space-y-3">
          {loadingComments ? (
            <p className="text-xs text-muted-foreground">{lang === "ro" ? "Se încarcă..." : "Loading..."}</p>
          ) : comments.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {comments.map(c => (
                <div key={c.id} className="flex items-start gap-2 group">
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
                            <DropdownMenuItem onClick={() => deleteComment(c.id)} className="text-destructive">
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
                        onClick={() => toggleCommentLike(c.id)}
                        className={`flex items-center gap-0.5 text-[10px] transition-colors ${c.liked_by_me ? "text-red-500" : "text-muted-foreground/60 hover:text-foreground"}`}
                      >
                        <Heart className={`h-3 w-3 ${c.liked_by_me ? "fill-red-500" : ""}`} />
                        {c.likes_count > 0 && <span>{c.likes_count}</span>}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{lang === "ro" ? "Niciun comentariu încă" : "No comments yet"}</p>
          )}

          {/* Comment input */}
          <div className="flex items-center gap-2">
            <Input
              ref={commentInputRef}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitComment()}
              placeholder={lang === "ro" ? "Scrie un comentariu..." : "Write a comment..."}
              className="text-xs h-8 bg-background border-border"
            />
            <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={submitComment} disabled={!commentText.trim()}>
              <Send className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default PostCard;
