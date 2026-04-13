import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Heart, MessageCircle, User, MoreHorizontal, Trash2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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
  likes_count: number;
  liked_by_me: boolean;
}

interface PostCardProps {
  post: PostData;
  author: PostAuthor;
  currentUserId: string | null;
  onDelete: (postId: string) => void;
  
  onViewProfile: (userId: string, role: string) => void;
}

const PostCard = ({ post, author, currentUserId, onDelete, onViewProfile }: PostCardProps) => {
  const { lang } = useLanguage();
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [commentsCount, setCommentsCount] = useState(0);
  const [loadingComments, setLoadingComments] = useState(false);
  const commentInputRef = useRef<HTMLInputElement>(null);

  // Load likes count + user like status
  useEffect(() => {
    loadLikes();
    loadCommentsCount();
  }, [post.id, currentUserId]);

  const loadLikes = async () => {
    const { count } = await supabase
      .from("post_likes")
      .select("*", { count: "exact", head: true })
      .eq("post_id", post.id);
    setLikesCount(count || 0);

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
    const [playerRes, scoutRes] = await Promise.all([
      supabase.from("player_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", userIds),
      supabase.from("scout_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", userIds),
    ]);

    const profileMap = new Map<string, { name: string; photo: string | null }>();
    (playerRes.data || []).forEach(p => profileMap.set(p.user_id, { name: `${p.first_name} ${p.last_name}`.trim(), photo: p.photo_url }));
    (scoutRes.data || []).forEach(s => { if (!profileMap.has(s.user_id)) profileMap.set(s.user_id, { name: `${s.first_name} ${s.last_name}`.trim(), photo: s.photo_url }); });

    setComments(rawComments.map((c: any) => {
      const profile = profileMap.get(c.user_id);
      return {
        ...c,
        author_name: profile?.name || (lang === "ro" ? "Utilizator" : "User"),
        author_photo: profile?.photo || null,
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

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
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
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onDelete(post.id)} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  {lang === "ro" ? "Șterge" : "Delete"}
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
        <p className="text-sm text-foreground/90 whitespace-pre-wrap">{post.content}</p>
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
      <div className="px-4 py-2 border-t border-border flex items-center gap-4">
        <button
          onClick={toggleLike}
          className={`flex items-center gap-1.5 text-sm transition-colors ${liked ? "text-red-500" : "text-muted-foreground hover:text-foreground"}`}
        >
          <Heart className={`h-4 w-4 ${liked ? "fill-red-500" : ""}`} />
          {likesCount > 0 && <span className="text-xs">{likesCount}</span>}
        </button>
        <button
          onClick={handleCommentClick}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          <MessageCircle className="h-4 w-4" />
          {commentsCount > 0 && <span className="text-xs">{commentsCount}</span>}
        </button>
      </div>

      {/* Comments section */}
      {showComments && (
        <div className="px-4 pb-3 border-t border-border pt-3 space-y-3">
          {loadingComments ? (
            <p className="text-xs text-muted-foreground">{lang === "ro" ? "Se încarcă..." : "Loading..."}</p>
          ) : comments.length > 0 ? (
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {comments.map(c => (
                <div key={c.id} className="flex items-start gap-2 group">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center overflow-hidden shrink-0">
                    {c.author_photo ? (
                      <img src={c.author_photo} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start gap-1">
                      <div className="flex-1 bg-muted/50 rounded-lg px-3 py-1.5">
                        <p className="text-xs font-medium text-foreground">{c.author_name}</p>
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
                    <span className="text-[10px] text-muted-foreground/60 ml-1 mt-0.5">{timeAgo(c.created_at)}</span>
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
