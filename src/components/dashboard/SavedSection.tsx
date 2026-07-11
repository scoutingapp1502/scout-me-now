import { useState, useEffect } from "react";
import { Plus, ArrowLeft, LayoutGrid, Bookmark, Users, ChevronRight, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import PostCard from "@/components/dashboard/PostCard";

interface SavedSectionProps {
  userId: string;
  onBack: () => void;
}

type Tab = "all" | "collections" | "posts";

interface Collection {
  id: string;
  name: string;
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

const tabs = [
  { id: "all",         labelRo: "Toate",    labelEn: "All"         },
  { id: "collections", labelRo: "Colecții", labelEn: "Collections" },
  { id: "posts",       labelRo: "Postări",  labelEn: "Posts"       },
];

export default function SavedSection({ userId, onBack }: SavedSectionProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [showNewCollection, setShowNewCollection] = useState(false);
  const [hideLikeCounts, setHideLikeCounts] = useState(false);
  const [collectionName, setCollectionName] = useState("");
  const [collections, setCollections] = useState<Collection[]>([]);
  const [savedPosts, setSavedPosts] = useState<SavedPost[]>([]);
  const [loadingPosts, setLoadingPosts] = useState(true);

  // Post detail dialog
  const [selectedPost, setSelectedPost] = useState<{ post: any; author: PostAuthor } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    (supabase as any).from("user_privacy_settings").select("hide_like_share_counts").eq("user_id", userId).maybeSingle()
      .then(({ data }: any) => { if (data) setHideLikeCounts(data.hide_like_share_counts ?? false); });
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

  const handleCreateCollection = () => {
    if (!collectionName.trim()) return;
    setCollections(prev => [...prev, { id: crypto.randomUUID(), name: collectionName.trim() }]);
    setCollectionName("");
    setShowNewCollection(false);
    toast({ title: lang === "ro" ? "Colecție creată!" : "Collection created!" });
  };

  const renderGrid = () => {
    if (loadingPosts) {
      return (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      );
    }

    if (savedPosts.length === 0) {
      return (
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
      );
    }

    return (
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
    );
  };

  const renderContent = () => {
    if (activeTab === "collections") {
      if (collections.length === 0) {
        return (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-5">
              <LayoutGrid className="h-7 w-7 text-muted-foreground" />
            </div>
            <h3 className="font-heading text-xl text-foreground mb-2">
              {lang === "ro" ? "Organizează conținutul salvat" : "Organise content you saved"}
            </h3>
            <p className="text-sm text-muted-foreground font-body mb-6 max-w-xs">
              {lang === "ro"
                ? "Colecțiile îți permit să gestionezi postările salvate și să colaborezi cu prietenii."
                : "Collections let you manage your saved posts and collaborate with friends."}
            </p>
            <Button onClick={() => setShowNewCollection(true)} className="font-body px-8">
              {lang === "ro" ? "Creează colecție" : "Create collection"}
            </Button>
          </div>
        );
      }

      return (
        <div className="grid grid-cols-2 gap-3 px-1">
          {collections.map((col) => (
            <button
              key={col.id}
              onClick={() => toast({ title: lang === "ro" ? "Funcționalitate în curând." : "Coming soon." })}
              className="aspect-square rounded-xl bg-muted flex flex-col items-center justify-center gap-2 hover:bg-muted/70 transition-colors border border-border"
            >
              <LayoutGrid className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-body text-foreground truncate px-3 w-full text-center">{col.name}</span>
            </button>
          ))}
        </div>
      );
    }

    return renderGrid();
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
        <button
          onClick={() => setShowNewCollection(true)}
          className="p-1 text-foreground hover:text-primary transition-colors"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-5 px-1 overflow-x-auto scrollbar-none">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as Tab)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-body transition-colors border ${
              activeTab === tab.id
                ? "bg-foreground text-background border-foreground"
                : "border-border text-foreground/70 hover:border-foreground/50"
            }`}
          >
            {lang === "ro" ? tab.labelRo : tab.labelEn}
          </button>
        ))}
      </div>

      {renderContent()}

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
            />
          ) : null}
        </DialogContent>
      </Dialog>

      {/* New Collection Dialog */}
      <Dialog open={showNewCollection} onOpenChange={(open) => { setShowNewCollection(open); if (!open) setCollectionName(""); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center font-heading">
              {lang === "ro" ? "Colecție nouă" : "New collection"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-1">
            <div className="relative">
              <Input
                placeholder={lang === "ro" ? "Numele colecției" : "Collection name"}
                value={collectionName}
                onChange={(e) => setCollectionName(e.target.value)}
                className="pr-9 font-body"
                autoFocus
                onKeyDown={(e) => e.key === "Enter" && handleCreateCollection()}
              />
              {collectionName && (
                <button
                  onClick={() => setCollectionName("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <button
              onClick={() => toast({ title: lang === "ro" ? "Funcționalitate în curând." : "Coming soon." })}
              className="w-full flex items-center gap-3 px-1 py-2 hover:bg-muted/30 rounded-lg transition-colors"
            >
              <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Users className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 text-left">
                <p className="text-sm font-body text-foreground">
                  {lang === "ro" ? "Adaugă persoane în colecție" : "Add people to collection"}
                </p>
                <p className="text-xs text-muted-foreground font-body">
                  {lang === "ro" ? "Salvați împreună într-o colecție" : "Save to a collection together"}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>

            <div className="flex gap-2 pt-1">
              <Button
                variant="ghost"
                className="flex-1 font-body"
                onClick={() => { setShowNewCollection(false); setCollectionName(""); }}
              >
                {lang === "ro" ? "Anulează" : "Cancel"}
              </Button>
              <Button
                className="flex-1 font-body"
                disabled={!collectionName.trim()}
                onClick={handleCreateCollection}
              >
                {lang === "ro" ? "Următor" : "Next"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
