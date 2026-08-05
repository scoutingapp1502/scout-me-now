import { useState, useEffect } from "react";
import { ArrowLeft, Bookmark, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useLanguage } from "@/i18n/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import PostCard from "@/components/dashboard/PostCard";

interface SavedSectionProps {
  userId: string;
  onBack: () => void;
}

interface SavedPost {
  savedId: string;
  post: {
    id: string;
    user_id: string;
    content: string;
    image_url: string | null;
    video_url: string | null;
    post_type: string;
    created_at: string;
  };
}

interface PostAuthor {
  user_id: string;
  name: string;
  photo: string | null;
  role: string;
  title: string;
}

export default function SavedSection({ userId, onBack }: SavedSectionProps) {
  const { lang } = useLanguage();

  const [hideLikeCounts, setHideLikeCounts] = useState(false);
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // Post detail dialog
  const [selectedPost, setSelectedPost] = useState<{ post: any; author: PostAuthor } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    (supabase as any).from("user_privacy_settings").select("hide_like_share_counts").eq("user_id", userId).maybeSingle()
      .then(({ data }: any) => { if (data) setHideLikeCounts(data.hide_like_share_counts ?? false); })
      .catch((err: unknown) => console.error("Failed to load privacy settings:", err));
  }, [userId]);

  useEffect(() => {
    const fetchSaved = async () => {
      setLoadingPosts(true);
      const { data } = await (supabase as any)
        .from("saved_posts")
        .select("id, posts(id, user_id, content, image_url, video_url, post_type, created_at)")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (data) {
        setSavedPosts(
          data
            .map((row: any) => ({ savedId: row.id, post: row.posts }))
            .filter((r: SavedPost) => !!r.post)
        );
      }
      setLoadingPosts(false);
    };
    fetchSaved();
  }, [userId]);

  const handlePostClick = async (savedPost: SavedPost) => {
    setLoadingDetail(true);
    setSelectedPost(null);

    const postUserId = savedPost.post.user_id;

    const [roleRes, playerRes, scoutRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", postUserId).maybeSingle(),
      supabase.from("player_profiles").select("first_name, last_name, photo_url, position, current_club").eq("user_id", postUserId).maybeSingle(),
      supabase.from("scout_profiles").select("first_name, last_name, photo_url, club").eq("user_id", postUserId).maybeSingle(),
    ]);

    const role = (roleRes.data?.role as string) || "player";
    const isScout = role === "scout" || role === "agent" || role === "club_rep";
    const profile = isScout ? scoutRes.data : (playerRes.data || scoutRes.data);

    const name = profile ? `${(profile as any).first_name} ${(profile as any).last_name}`.trim() : (lang === "ro" ? "Utilizator" : "User");
    const photo = (profile as any)?.photo_url || null;
    const title = isScout
      ? ((profile as any)?.club || "")
      : [(playerRes.data as any)?.position, (playerRes.data as any)?.current_club].filter(Boolean).join(" · ");

    setSelectedPost({
      post: savedPost.post,
      author: { user_id: postUserId, name, photo, role, title },
    });
    setLoadingDetail(false);
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 px-1">
        <button onClick={onBack} className="p-1 text-foreground hover:text-primary transition-colors">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="font-heading text-xl text-foreground">
          {lang === "ro" ? "Salvat" : "Saved"}
        </h2>
        <div className="w-7" />
      </div>

      {loadingPosts ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : savedPosts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center px-4">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Bookmark className="h-7 w-7 text-muted-foreground" />
          </div>
          <h3 className="font-heading text-xl text-foreground mb-2">
            {lang === "ro" ? "Nimic salvat încă" : "Nothing saved yet"}
          </h3>
          <p className="text-sm text-muted-foreground font-body max-w-xs">
            {lang === "ro"
              ? "Salvează postări din feed apăsând iconița bookmark."
              : "Save posts from your feed using the bookmark icon."}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-0.5">
          {savedPosts.map((savedPost) => (
            <button
              key={savedPost.savedId}
              onClick={() => handlePostClick(savedPost)}
              className="aspect-square bg-muted overflow-hidden relative hover:opacity-80 transition-opacity"
            >
              {savedPost.post.image_url ? (
                <img src={savedPost.post.image_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center p-2 bg-card border border-border/30">
                  <p className="text-[10px] text-muted-foreground text-center line-clamp-4 font-body leading-tight">
                    {savedPost.post.content}
                  </p>
                </div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Post detail dialog */}
      <Dialog open={!!(selectedPost || loadingDetail)} onOpenChange={(open) => { if (!open) { setSelectedPost(null); setLoadingDetail(false); } }}>
        <DialogContent className="max-w-lg p-0 overflow-hidden gap-0">
          {loadingDetail ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : selectedPost ? (
            <PostCard
              post={selectedPost.post}
              author={selectedPost.author}
              currentUserId={userId}
              onDelete={(postId) => {
                setSavedPosts(prev => prev.filter(sp => sp.post.id !== postId));
                setSelectedPost(null);
              }}
              onViewProfile={() => setSelectedPost(null)}
              hideLikeCounts={hideLikeCounts}
              hideMenu
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
