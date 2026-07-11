import { useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useActivityNotifications, markFollowingSeen, markMineSeen } from "@/hooks/useActivityNotifications";
import { Loader2, Bell, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import PostCard from "./PostCard";
import PersonalProfile from "./PersonalProfile";
import ScoutPersonalProfile from "./ScoutPersonalProfile";
import ActivityNotificationsList from "./ActivityNotificationsList";
import NewPostComposer from "./NewPostComposer";

interface Post {
  id: string;
  user_id: string;
  content: string;
  image_url: string | null;
  post_type: string;
  created_at: string;
  author_name: string;
  author_photo: string | null;
  author_role: string;
  author_title: string;
}

const ActivitySection = ({ onNavigateToChat }: { onNavigateToChat?: (userId: string) => void }) => {
  const { lang } = useLanguage();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [feedTab, setFeedTab] = useState<"following" | "mine">("following");
  const { followingCount, mineCount, notifications: activityNotifs, refetch: refetchNotifications } = useActivityNotifications(currentUserId);
  const [viewingSinglePostId, setViewingSinglePostId] = useState<string | null>(null);
  const [singlePost, setSinglePost] = useState<Post | null>(null);
  const [loadingSinglePost, setLoadingSinglePost] = useState(false);
  const [activitySubTab, setActivitySubTab] = useState<"feed" | "notifications">("feed");
  const [newPostsAvailable, setNewPostsAvailable] = useState(false);
  const feedTabRef = useRef<"following" | "mine">("following");

  const [myPhoto, setMyPhoto] = useState<string | null>(null);
  const [myName, setMyName] = useState("");
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [viewingProfileRole, setViewingProfileRole] = useState<string>("player");
  const [hideLikeCounts, setHideLikeCounts] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
        loadMyProfile(user.id);
        (supabase as any).from("user_privacy_settings").select("hide_like_share_counts").eq("user_id", user.id).maybeSingle()
          .then(({ data }: any) => { if (data) setHideLikeCounts(data.hide_like_share_counts ?? false); })
          .catch((err: unknown) => console.error("Failed to load privacy settings:", err));
      }
    }).catch((err) => console.error("Failed to get current user:", err));
  }, []);

  const loadMyProfile = async (userId: string) => {
    const { data: role } = await supabase.rpc("get_user_role", { _user_id: userId });
    if (role === "player") {
      const { data } = await supabase.from("player_profiles").select("first_name, last_name, photo_url").eq("user_id", userId).maybeSingle();
      if (data) { setMyName(`${data.first_name} ${data.last_name}`.trim()); setMyPhoto(data.photo_url); }
    } else {
      const { data } = await supabase.from("scout_profiles").select("first_name, last_name, photo_url").eq("user_id", userId).maybeSingle();
      if (data) { setMyName(`${data.first_name} ${data.last_name}`.trim()); setMyPhoto(data.photo_url); }
    }
  };

  const fetchPosts = async (userId: string) => {
    setLoading(true);
    const { data: followsData } = await supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId)
      .eq("status", "accepted");
    const followedIds = (followsData || []).map(f => f.following_id);
    const allIds = [...new Set([userId, ...followedIds])];

    const { data: rawPosts } = await supabase.from("posts").select("*").in("user_id", allIds).order("created_at", { ascending: false }).limit(50);
    if (!rawPosts || rawPosts.length === 0) { setPosts([]); setLoading(false); return; }

    const userIds = [...new Set(rawPosts.map(p => p.user_id))];
    const [playerRes, scoutRes, roleRes] = await Promise.all([
      supabase.from("player_profiles").select("user_id, first_name, last_name, photo_url, position, current_team").in("user_id", userIds),
      supabase.from("scout_profiles").select("user_id, first_name, last_name, photo_url, title, organization").in("user_id", userIds),
      supabase.from("user_roles").select("user_id, role").in("user_id", userIds),
    ]);

    const roleMap = new Map<string, string>();
    (roleRes.data || []).forEach(r => roleMap.set(r.user_id, r.role));
    const profileMap = new Map<string, { name: string; photo: string | null; title: string }>();
    (playerRes.data || []).forEach(p => profileMap.set(p.user_id, { name: `${p.first_name} ${p.last_name}`.trim(), photo: p.photo_url, title: [p.position, p.current_team].filter(Boolean).join(" · ") }));
    (scoutRes.data || []).forEach(s => { if (!profileMap.has(s.user_id)) profileMap.set(s.user_id, { name: `${s.first_name} ${s.last_name}`.trim(), photo: s.photo_url, title: [s.title, s.organization].filter(Boolean).join(" | ") }); });

    const enriched: Post[] = rawPosts.map(p => {
      const profile = profileMap.get(p.user_id);
      const role = roleMap.get(p.user_id) || "player";
      return { ...p, author_name: profile?.name || (lang === "ro" ? "Utilizator" : "User"), author_photo: profile?.photo || null, author_role: role, author_title: profile?.title || "" };
    });
    setPosts(enriched);
    setLoading(false);
  };

  const currentUserIdRef = useRef<string | null>(null);
  currentUserIdRef.current = currentUserId;

  useEffect(() => { if (currentUserId) fetchPosts(currentUserId); }, [currentUserId]);

  feedTabRef.current = feedTab;

  useEffect(() => {
    const channel = supabase.channel("posts-feed-" + Date.now())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, (payload: any) => {
        const uid = currentUserIdRef.current;
        if (!uid) return;

        const newUserId = payload.new?.user_id;

        // If the change was made by the current user, refresh immediately
        if (newUserId === uid) {
          fetchPosts(uid);
          return;
        }

        // For others' posts, show refresh hint instantly on Following tab
        if (feedTabRef.current === "following") {
          setNewPostsAvailable(true);
        }
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "posts" }, (payload: any) => {
        const uid = currentUserIdRef.current;
        if (!uid) return;
        if (payload.old?.user_id === uid) fetchPosts(uid);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleDelete = async (postId: string) => {
    const { error } = await supabase.from("posts").delete().eq("id", postId);
    if (error) toast.error(lang === "ro" ? "Eroare la ștergere" : "Failed to delete");
    else if (currentUserId) fetchPosts(currentUserId);
  };

  const handleUnfollow = async (userId: string) => {
    if (!currentUserId) return;
    const { error } = await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", userId);
    if (error) { toast.error(lang === "ro" ? "Eroare" : "Error"); }
    else { toast.success(lang === "ro" ? "Nu mai urmărești acest utilizator" : "Unfollowed successfully"); fetchPosts(currentUserId); }
  };

  const handleViewProfile = (userId: string, role: string) => { setViewingProfileId(userId); setViewingProfileRole(role); };

  const handleViewSinglePost = async (postId: string) => {
    setLoadingSinglePost(true);
    setViewingSinglePostId(postId);
    const { data: rawPost } = await supabase.from("posts").select("*").eq("id", postId).maybeSingle();
    if (!rawPost) { setLoadingSinglePost(false); return; }
    const uid = rawPost.user_id;
    const [playerRes, scoutRes, roleRes] = await Promise.all([
      supabase.from("player_profiles").select("user_id, first_name, last_name, photo_url, position, current_team").eq("user_id", uid).maybeSingle(),
      supabase.from("scout_profiles").select("user_id, first_name, last_name, photo_url, title, organization").eq("user_id", uid).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", uid).maybeSingle(),
    ]);
    const role = roleRes.data?.role || "player";
    const profile = playerRes.data
      ? { name: `${playerRes.data.first_name} ${playerRes.data.last_name}`.trim(), photo: playerRes.data.photo_url, title: [playerRes.data.position, playerRes.data.current_team].filter(Boolean).join(" · ") }
      : scoutRes.data
        ? { name: `${scoutRes.data.first_name} ${scoutRes.data.last_name}`.trim(), photo: scoutRes.data.photo_url, title: [scoutRes.data.title, scoutRes.data.organization].filter(Boolean).join(" | ") }
        : { name: "User", photo: null, title: "" };
    setSinglePost({ ...rawPost, author_name: profile.name, author_photo: profile.photo, author_role: role, author_title: profile.title });
    setLoadingSinglePost(false);
  };

  // Single post view
  if (viewingSinglePostId) {
    return (
      <div className="space-y-4 max-w-2xl mx-auto">
        <Button variant="ghost" size="sm" className="gap-2" onClick={() => { setViewingSinglePostId(null); setSinglePost(null); }}>
          <ArrowLeft className="h-4 w-4" />
          {lang === "ro" ? "Înapoi la activitate" : "Back to activity"}
        </Button>
        {loadingSinglePost ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : singlePost ? (
          <PostCard
            post={{ id: singlePost.id, user_id: singlePost.user_id, content: singlePost.content, image_url: singlePost.image_url, video_url: (singlePost as any).video_url || null, post_type: singlePost.post_type, created_at: singlePost.created_at }}
            author={{ user_id: singlePost.user_id, name: singlePost.author_name, photo: singlePost.author_photo, role: singlePost.author_role, title: singlePost.author_title }}
            currentUserId={currentUserId}
            onDelete={handleDelete}
            onViewProfile={handleViewProfile}
            hideLikeCounts={hideLikeCounts}
          />
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            {lang === "ro" ? "Postarea nu a fost găsită." : "Post not found."}
          </div>
        )}

        <Dialog open={!!viewingProfileId} onOpenChange={(open) => !open && setViewingProfileId(null)}>
          <DialogContent className="max-w-[100vw] sm:max-w-4xl w-[100vw] sm:w-[95vw] h-[100dvh] sm:h-auto sm:max-h-[90vh] p-0 gap-0 bg-background border-0 sm:border sm:border-border rounded-none sm:rounded-xl fixed inset-0 sm:inset-auto sm:left-[50%] sm:top-[50%] !translate-x-0 !translate-y-0 sm:!translate-x-[-50%] sm:!translate-y-[-50%]" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
            <DialogTitle className="sr-only">{lang === "ro" ? "Profil" : "Profile"}</DialogTitle>
            <div className="overflow-y-auto h-full sm:max-h-[90vh]">
              {viewingProfileId && (
                viewingProfileRole === "player"
                  ? <PersonalProfile userId={viewingProfileId} readOnly onNavigateToChat={onNavigateToChat} />
                  : <ScoutPersonalProfile userId={viewingProfileId} readOnly onNavigateToChat={onNavigateToChat} />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl text-foreground">{lang === "ro" ? "Activitate" : "Activity"}</h2>
        <button
          onClick={() => setActivitySubTab(activitySubTab === "notifications" ? "feed" : "notifications")}
          className={`relative p-2 rounded-lg transition-colors ${activitySubTab === "notifications" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
        >
          <Bell className="h-5 w-5" />
          {activityNotifs.length > 0 && activitySubTab !== "notifications" && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
              {activityNotifs.length > 99 ? "99+" : activityNotifs.length}
            </span>
          )}
        </button>
      </div>

      {activitySubTab === "notifications" ? (
        <ActivityNotificationsList
          notifications={activityNotifs}
          onViewPost={handleViewSinglePost}
        />
      ) : (
        <>
          {/* Feed Tab Toggle */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm py-2 flex justify-center">
            <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
            <button
              onClick={() => {
                setFeedTab("following");
                if (currentUserId) { markFollowingSeen(currentUserId); refetchNotifications(); }
              }}
              className={`relative px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${feedTab === "following" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {lang === "ro" ? "Urmăritori" : "Following"}
              {followingCount > 0 && feedTab !== "following" && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                  {followingCount > 99 ? "99+" : followingCount}
                </span>
              )}
            </button>
            <button
              onClick={() => {
                setFeedTab("mine");
                if (currentUserId) { markMineSeen(currentUserId); refetchNotifications(); }
              }}
              className={`relative px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${feedTab === "mine" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {lang === "ro" ? "Postările mele" : "My Posts"}
              {mineCount > 0 && feedTab !== "mine" && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                  {mineCount > 99 ? "99+" : mineCount}
                </span>
              )}
            </button>
            </div>
          </div>

          {feedTab === "mine" && currentUserId && (
            <NewPostComposer currentUserId={currentUserId} myPhoto={myPhoto} onPosted={() => fetchPosts(currentUserId)} />
          )}

          {/* New posts banner */}
          {newPostsAvailable && feedTab === "following" && (
            <button
              onClick={() => {
                setNewPostsAvailable(false);
                if (currentUserId) fetchPosts(currentUserId);
              }}
              className="w-full py-2.5 rounded-lg bg-primary/10 border border-primary/30 text-primary text-sm font-medium hover:bg-primary/20 transition-colors"
            >
              {lang === "ro" ? "🔄 Sunt postări noi. Apasă pentru a le vedea." : "🔄 New posts available. Tap to refresh."}
            </button>
          )}

          {/* Feed */}
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : (() => {
            const filteredPosts = feedTab === "mine"
              ? posts.filter(p => p.user_id === currentUserId)
              : posts.filter(p => p.user_id !== currentUserId);
            return filteredPosts.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground">
                {feedTab === "mine"
                  ? (lang === "ro" ? "Nu ai publicat nicio postare încă." : "You haven't posted anything yet.")
                  : (lang === "ro" ? "Nicio postare încă. Urmărește persoane pentru a vedea activitatea lor!" : "No posts yet. Follow people to see their activity!")}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={{ id: post.id, user_id: post.user_id, content: post.content, image_url: post.image_url, video_url: (post as any).video_url || null, post_type: post.post_type, created_at: post.created_at }}
                    author={{ user_id: post.user_id, name: post.author_name, photo: post.author_photo, role: post.author_role, title: post.author_title }}
                    currentUserId={currentUserId}
                    onDelete={handleDelete}
                    onViewProfile={handleViewProfile}
                    hideLikeCounts={hideLikeCounts}
                  />
                ))}
              </div>
            );
          })()}
        </>
      )}

      {/* Profile View Dialog */}
      <Dialog open={!!viewingProfileId} onOpenChange={(open) => !open && setViewingProfileId(null)}>
        <DialogContent className="max-w-[100vw] sm:max-w-4xl w-[100vw] sm:w-[95vw] h-[100dvh] sm:h-auto sm:max-h-[90vh] p-0 gap-0 bg-background border-0 sm:border sm:border-border rounded-none sm:rounded-xl fixed inset-0 sm:inset-auto sm:left-[50%] sm:top-[50%] !translate-x-0 !translate-y-0 sm:!translate-x-[-50%] sm:!translate-y-[-50%]" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
          <DialogTitle className="sr-only">{lang === "ro" ? "Profil" : "Profile"}</DialogTitle>
          <div className="overflow-y-auto h-full sm:max-h-[90vh]">
            {viewingProfileId && (
              viewingProfileRole === "player"
                ? <PersonalProfile userId={viewingProfileId} readOnly onNavigateToChat={onNavigateToChat} />
                : <ScoutPersonalProfile userId={viewingProfileId} readOnly onNavigateToChat={onNavigateToChat} />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ActivitySection;
