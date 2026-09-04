import { Fragment, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useFollowers } from "@/hooks/useFollowers";
import { Loader2, ArrowLeft, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import PostCard from "./PostCard";
import NewsAnnouncementsPanel from "./NewsAnnouncementsPanel";
import PersonalProfile, { FifaPlayerCard } from "./PersonalProfile";
import ScoutPersonalProfile from "./ScoutPersonalProfile";
import NewPostComposer from "./NewPostComposer";
import type { Tables } from "@/integrations/supabase/types";

type PlayerProfileRow = Tables<"player_profiles">;

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

// Decorative geometric accents scattered between feed cards, alternating
// sides and colors so they don't all pile up on the same edge.
const feedDividerVariants = [
  { side: "left" as const, background: "linear-gradient(135deg, #7c3aed, #a855f7)", clipPath: "polygon(0 0, 100% 0, 0 100%)" },
  { side: "right" as const, background: "#a3e635", clipPath: "polygon(100% 0, 100% 100%, 0 100%)" },
  { side: "left" as const, background: "linear-gradient(135deg, #f97316, #fb923c)", clipPath: "polygon(0 100%, 100% 100%, 0 0)" },
];

const FeedDivider = ({ index }: { index: number }) => {
  const variant = feedDividerVariants[index % feedDividerVariants.length];
  const sideClass = variant.side === "left" ? "-left-2 lg:-left-5" : "-right-2 lg:-right-5";
  return (
    <div className="relative h-0 overflow-visible">
      <div
        className={`absolute -z-10 pointer-events-none -top-2 lg:-top-5 w-[70px] h-[70px] lg:w-[120px] lg:h-[120px] ${sideClass}`}
        style={{
          background: variant.background,
          clipPath: variant.clipPath,
          opacity: 0.9,
        }}
      />
    </div>
  );
};

const ActivitySection = ({ onNavigateToChat, onNavigateToProfile }: { onNavigateToChat?: (userId: string) => void; onNavigateToProfile?: () => void }) => {
  const { lang } = useLanguage();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [viewingSinglePostId, setViewingSinglePostId] = useState<string | null>(null);
  const [singlePost, setSinglePost] = useState<Post | null>(null);
  const [loadingSinglePost, setLoadingSinglePost] = useState(false);
  const [newPostsAvailable, setNewPostsAvailable] = useState(false);

  const [myPhoto, setMyPhoto] = useState<string | null>(null);
  const [myName, setMyName] = useState("");
  const [myRole, setMyRole] = useState<"player" | "cauta_jucator" | null>(null);
  const [myProfile, setMyProfile] = useState<PlayerProfileRow | null>(null);
  const [myTitle, setMyTitle] = useState("");
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [viewingProfileRole, setViewingProfileRole] = useState<string>("player");
  const [hideLikeCounts, setHideLikeCounts] = useState(false);
  const [feedMode, setFeedMode] = useState<"following" | "mine">("following");
  const { count: followerCount } = useFollowers(currentUserId);

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
    setMyRole(role === "player" ? "player" : "cauta_jucator");
    if (role === "player") {
      const { data } = await supabase.from("player_profiles").select("*").eq("user_id", userId).maybeSingle();
      if (data) { setMyName(`${data.first_name} ${data.last_name}`.trim()); setMyPhoto(data.photo_url); setMyProfile(data); }
    } else {
      const { data } = await supabase.from("scout_profiles").select("first_name, last_name, photo_url, title, organization").eq("user_id", userId).maybeSingle();
      if (data) {
        setMyName(`${data.first_name} ${data.last_name}`.trim());
        setMyPhoto(data.photo_url);
        setMyTitle([data.title, data.organization].filter(Boolean).join(" | "));
      }
    }
  };

  const fetchPosts = async (userId: string, mode: "following" | "mine" = "following") => {
    setLoading(true);
    const [{ data: followsData }, { data: favouritesData }] = await Promise.all([
      supabase.from("follows").select("following_id, responded_at, created_at").eq("follower_id", userId).eq("status", "accepted"),
      (supabase as any).from("user_favourites").select("favourite_user_id").eq("user_id", userId),
    ]);
    // Only show a followed user's posts from after they accepted the follow —
    // otherwise a fresh accept floods the feed with their whole back-catalog.
    const followedSinceMap: Record<string, string> = {};
    (followsData || []).forEach((f: any) => { followedSinceMap[f.following_id] = f.responded_at || f.created_at; });
    const followedIds = Object.keys(followedSinceMap);
    const allIds = mode === "mine" ? [userId] : [...new Set(followedIds)];
    const favouriteIds = new Set((favouritesData || []).map((f: any) => f.favourite_user_id as string));

    const [postsRes, scoutPostsRes] = await Promise.all([
      (supabase as any).from("posts").select("*").in("user_id", allIds).is("deleted_at", null).eq("is_archived", false).order("created_at", { ascending: false }).limit(50),
      (supabase as any).from("scout_posts").select("*").in("user_id", allIds).is("deleted_at", null).eq("is_archived", false).order("created_at", { ascending: false }).limit(50),
    ]);
    // Favourites' posts surface first (per "Postările noi de la favoriții
    // tăi vor apărea mai sus în feed"), each group still newest-first.
    const rawPosts = [
      ...(postsRes.data || []),
      ...(scoutPostsRes.data || []).map((p: any) => ({ ...p, post_type: "scout", video_url: null })),
    ].filter((p: any) => {
      if (p.user_id === userId) return true;
      const followedSince = followedSinceMap[p.user_id];
      return followedSince && new Date(p.created_at) >= new Date(followedSince);
    }).sort((a, b) => {
      const aFav = favouriteIds.has(a.user_id);
      const bFav = favouriteIds.has(b.user_id);
      if (aFav !== bFav) return aFav ? -1 : 1;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    }).slice(0, 50);
    if (rawPosts.length === 0) { setPosts([]); setLoading(false); return; }

    const userIds = Array.from(new Set<string>(rawPosts.map((p: any) => p.user_id)));
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
  const feedModeRef = useRef<"following" | "mine">("following");
  feedModeRef.current = feedMode;

  useEffect(() => { if (currentUserId) fetchPosts(currentUserId, feedMode); }, [currentUserId, feedMode]);

  useEffect(() => {
    const handleInsert = (payload: any) => {
      const uid = currentUserIdRef.current;
      if (!uid) return;

      const newUserId = payload.new?.user_id;

      // If the change was made by the current user, refresh immediately
      if (newUserId === uid) {
        fetchPosts(uid, feedModeRef.current);
        return;
      }

      // For others' posts, show a refresh hint instantly
      setNewPostsAvailable(true);
    };
    const handleDeleteEvent = (payload: any) => {
      const uid = currentUserIdRef.current;
      if (!uid) return;
      if (payload.old?.user_id === uid) fetchPosts(uid, feedModeRef.current);
    };
    const channel = supabase.channel("posts-feed-" + Date.now())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, handleInsert)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "scout_posts" }, handleInsert)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "posts" }, handleDeleteEvent)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "scout_posts" }, handleDeleteEvent)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleDelete = async (postId: string) => {
    const deletedAt = new Date().toISOString();
    const [postsRes, scoutPostsRes] = await Promise.all([
      (supabase as any).from("posts").update({ deleted_at: deletedAt }).eq("id", postId).select("id"),
      (supabase as any).from("scout_posts").update({ deleted_at: deletedAt }).eq("id", postId).select("id"),
    ]);
    // The post lives in exactly one of the two tables, so one call always
    // affects 0 rows — only treat this as a failure if neither call
    // actually updated a row.
    const succeeded = (postsRes.data?.length ?? 0) > 0 || (scoutPostsRes.data?.length ?? 0) > 0;
    if (!succeeded) { toast.error(lang === "ro" ? "Eroare la ștergere" : "Failed to delete"); return; }
    if (currentUserId) fetchPosts(currentUserId, feedMode);
  };

  const handleUnfollow = async (userId: string) => {
    if (!currentUserId) return;
    const { error } = await supabase.from("follows").delete().eq("follower_id", currentUserId).eq("following_id", userId);
    if (error) { toast.error(lang === "ro" ? "Eroare" : "Error"); }
    else { toast.success(lang === "ro" ? "Nu mai urmărești acest utilizator" : "Unfollowed successfully"); fetchPosts(currentUserId, feedMode); }
  };

  const handleViewProfile = (userId: string, role: string) => { setViewingProfileId(userId); setViewingProfileRole(role); };

  const handleViewSinglePost = async (postId: string) => {
    setLoadingSinglePost(true);
    setViewingSinglePostId(postId);
    const [postRes, scoutPostRes] = await Promise.all([
      supabase.from("posts").select("*").eq("id", postId).maybeSingle(),
      (supabase as any).from("scout_posts").select("*").eq("id", postId).maybeSingle(),
    ]);
    const rawPost = postRes.data || (scoutPostRes.data ? { ...scoutPostRes.data, post_type: "scout", video_url: null } : null);
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
        <Button variant="ghost" size="sm" className="gap-2 text-gray-900 hover:bg-gray-100" onClick={() => { setViewingSinglePostId(null); setSinglePost(null); }}>
          <ArrowLeft className="h-4 w-4" />
          {lang === "ro" ? "Înapoi la activitate" : "Back to activity"}
        </Button>
        {loadingSinglePost ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>
        ) : singlePost ? (
          <PostCard
            post={{ id: singlePost.id, user_id: singlePost.user_id, content: singlePost.content, image_url: singlePost.image_url, video_url: (singlePost as any).video_url || null, post_type: singlePost.post_type, created_at: singlePost.created_at, comments_disabled: (singlePost as any).comments_disabled || false }}
            author={{ user_id: singlePost.user_id, name: singlePost.author_name, photo: singlePost.author_photo, role: singlePost.author_role, title: singlePost.author_title }}
            currentUserId={currentUserId}
            onDelete={handleDelete}
            onViewProfile={handleViewProfile}
            hideLikeCounts={hideLikeCounts}
            simplifiedMenu
          />
        ) : (
          <div className="text-center py-12 text-gray-500">
            {lang === "ro" ? "Postarea nu a fost găsită." : "Post not found."}
          </div>
        )}

        <Dialog open={!!viewingProfileId} onOpenChange={(open) => !open && setViewingProfileId(null)}>
          <DialogContent className="max-w-[100vw] sm:max-w-4xl w-[100vw] sm:w-[95vw] h-[100dvh] sm:h-auto sm:max-h-[90vh] p-0 gap-0 bg-white border-0 sm:border sm:border-gray-200 rounded-none sm:rounded-xl fixed inset-0 sm:inset-auto sm:left-[50%] sm:top-[50%] !translate-x-0 !translate-y-0 sm:!translate-x-[-50%] sm:!translate-y-[-50%]" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
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
    <div className="space-y-6 relative isolate">
      <h2 className="font-display text-2xl text-gray-900">{lang === "ro" ? "Activitate" : "Activity"}</h2>

      {/* Decorative geometric shapes above the page content */}
      <div className="relative h-0 overflow-visible">
        <div
          className="absolute -z-10 pointer-events-none w-[100px] h-[100px] -top-16 right-6 lg:w-[170px] lg:h-[170px] lg:-top-[150px] lg:right-[60px]"
          style={{
            background: "linear-gradient(135deg, #f97316, #fb923c)",
            clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
            opacity: 0.9,
          }}
        />
        <div
          className="absolute -z-10 pointer-events-none w-[70px] h-[70px] -top-10 -left-4 lg:w-[120px] lg:h-[120px] lg:-top-[100px] lg:-left-10"
          style={{
            background: "linear-gradient(135deg, #7c3aed, #a855f7)",
            clipPath: "polygon(0 0, 100% 0, 0 100%)",
            opacity: 0.9,
          }}
        />
        <div
          className="absolute -z-10 pointer-events-none hidden lg:block lg:w-[110px] lg:h-[110px] lg:-top-[220px] lg:left-[40%]"
          style={{
            background: "#a3e635",
            clipPath: "polygon(0 0, 100% 0, 0 100%)",
            opacity: 0.9,
          }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)_360px] gap-4 items-start">
        {/* Left: sticky personal info */}
        <div className="hidden lg:block lg:sticky lg:top-6">
          <div className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <button type="button" onClick={() => onNavigateToProfile?.()} className="flex justify-center w-full cursor-pointer">
              {myRole === "player" ? (
                <FifaPlayerCard form={myProfile || {}} profile={myProfile} photoSrc={myPhoto} userId={currentUserId || undefined} mini />
              ) : (
                <Avatar className="h-24 w-24">
                  {myPhoto ? <AvatarImage src={myPhoto} /> : null}
                  <AvatarFallback className="bg-gray-100 text-gray-500 text-2xl">{myName.charAt(0).toUpperCase() || "?"}</AvatarFallback>
                </Avatar>
              )}
            </button>
            {myRole === "player" ? (
              (myProfile?.position || myProfile?.current_team) && (
                <p className="text-xs text-gray-500 mt-3">
                  {[myProfile?.position, myProfile?.current_team].filter(Boolean).join(" · ")}
                </p>
              )
            ) : (
              <>
                {myName && <p className="text-sm font-semibold text-gray-900 mt-3">{myName}</p>}
                {myTitle && <p className="text-xs text-gray-500 mt-0.5">{myTitle}</p>}
              </>
            )}
            <div className="border-t border-gray-200 mt-4 pt-3 flex items-center justify-center gap-1.5 text-sm">
              <Users className="h-4 w-4 text-primary" />
              <span className="font-semibold text-gray-900">{followerCount}</span>
              <span className="text-gray-500">{lang === "ro" ? "urmăritori" : "followers"}</span>
            </div>
          </div>
        </div>

        {/* Center: feed */}
        <div className="min-w-0 space-y-4 -mx-4 lg:mx-0 w-[calc(100%+2rem)] lg:w-auto">
          {/* Feed mode toggle */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-none lg:rounded-lg p-1 w-full lg:w-fit lg:mx-0">
            <button
              type="button"
              onClick={() => setFeedMode("following")}
              className={`w-1/2 lg:w-auto lg:flex-none px-4 py-2 rounded-md text-sm font-medium font-body text-center whitespace-nowrap transition-colors ${
                feedMode === "following" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {lang === "ro" ? "Urmăritorii mei" : "People I follow"}
            </button>
            <button
              type="button"
              onClick={() => setFeedMode("mine")}
              className={`w-1/2 lg:w-auto lg:flex-none px-4 py-2 rounded-md text-sm font-medium font-body text-center whitespace-nowrap transition-colors ${
                feedMode === "mine" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-900"
              }`}
            >
              {lang === "ro" ? "Postările mele" : "My posts"}
            </button>
          </div>

          {currentUserId && (
            <div className="mx-4 lg:mx-0">
              <NewPostComposer currentUserId={currentUserId} myPhoto={myPhoto} myRole={myRole} onPosted={() => fetchPosts(currentUserId, feedMode)} />
            </div>
          )}

          {/* Decorative geometric shape between composer and feed */}
          <div className="relative h-0 overflow-visible">
            <div
              className="absolute -z-10 pointer-events-none w-[100px] h-[100px] -top-4 right-4 lg:w-[180px] lg:h-[180px] lg:-top-[30px] lg:-right-4"
              style={{
                background: "linear-gradient(135deg, #f97316, #fb923c)",
                clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
                opacity: 0.9,
              }}
            />
          </div>

          {/* New posts banner */}
          {newPostsAvailable && (
            <button
              onClick={() => {
                setNewPostsAvailable(false);
                if (currentUserId) fetchPosts(currentUserId, feedMode);
              }}
              className="w-[calc(100%-2rem)] mx-4 lg:w-full lg:mx-0 py-2.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-600 text-sm font-medium hover:bg-orange-100 transition-colors"
            >
              {lang === "ro" ? "🔄 Sunt postări noi. Apasă pentru a le vedea." : "🔄 New posts available. Tap to refresh."}
            </button>
          )}

          {/* Feed */}
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16 text-gray-500 px-4 lg:px-0">
              {feedMode === "mine"
                ? (lang === "ro" ? "Nu ai nicio postare încă. Publică ceva pentru a începe!" : "You haven't posted anything yet. Share something to get started!")
                : (lang === "ro" ? "Nicio postare încă. Urmărește persoane sau publică ceva pentru a începe!" : "No posts yet. Follow people or share something to get started!")}
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post, idx) => (
                <Fragment key={post.id}>
                  <PostCard
                    post={{ id: post.id, user_id: post.user_id, content: post.content, image_url: post.image_url, video_url: (post as any).video_url || null, post_type: post.post_type, created_at: post.created_at, comments_disabled: (post as any).comments_disabled || false }}
                    author={{ user_id: post.user_id, name: post.author_name, photo: post.author_photo, role: post.author_role, title: post.author_title }}
                    currentUserId={currentUserId}
                    onDelete={handleDelete}
                    onViewProfile={handleViewProfile}
                    hideLikeCounts={hideLikeCounts}
                    simplifiedMenu
                  />
                  {idx < posts.length - 1 && <FeedDivider index={idx} />}
                </Fragment>
              ))}
            </div>
          )}

          {/* Decorative geometric shapes below the feed */}
          <div className="relative h-0 overflow-visible">
            <div
              className="absolute -z-10 pointer-events-none w-[90px] h-[90px] -top-3 right-4 lg:w-[160px] lg:h-[160px] lg:-top-5 lg:right-0"
              style={{
                background: "#a3e635",
                clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
                opacity: 0.9,
              }}
            />
            <div
              className="absolute -z-10 pointer-events-none w-[75px] h-[75px] top-3 left-4 lg:w-[130px] lg:h-[130px] lg:top-5 lg:-left-4"
              style={{
                background: "linear-gradient(135deg, #7c3aed, #a855f7)",
                clipPath: "polygon(0 0, 100% 0, 0 100%)",
                opacity: 0.9,
              }}
            />
          </div>
        </div>

        {/* Right: news & announcements */}
        <div className="hidden lg:block lg:sticky lg:top-6 relative">
          <div
            className="absolute -z-10 pointer-events-none"
            style={{
              top: "-30px",
              right: "-20px",
              width: "140px",
              height: "140px",
              background: "#a3e635",
              clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
              opacity: 0.9,
            }}
          />
          <div
            className="absolute -z-10 pointer-events-none"
            style={{
              bottom: "-24px",
              left: "-16px",
              width: "110px",
              height: "110px",
              background: "linear-gradient(135deg, #f97316, #fb923c)",
              clipPath: "polygon(0 100%, 100% 100%, 0 0)",
              opacity: 0.9,
            }}
          />
          <NewsAnnouncementsPanel />
        </div>
      </div>

      {/* Decorative geometric shapes below the page content */}
      <div className="relative h-0 overflow-visible">
        <div
          className="absolute -z-10 pointer-events-none w-[90px] h-[90px] top-6 right-4 lg:w-[150px] lg:h-[150px] lg:top-10 lg:right-20"
          style={{
            background: "#a3e635",
            clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
            opacity: 0.9,
          }}
        />
        <div
          className="absolute -z-10 pointer-events-none w-[70px] h-[70px] top-16 left-2 lg:w-[120px] lg:h-[120px] lg:top-[100px] lg:left-10"
          style={{
            background: "linear-gradient(135deg, #f97316, #fb923c)",
            clipPath: "polygon(0 100%, 100% 100%, 0 0)",
            opacity: 0.9,
          }}
        />
        <div
          className="absolute -z-10 pointer-events-none hidden lg:block lg:w-[110px] lg:h-[110px] lg:top-[260px] lg:right-[260px]"
          style={{
            background: "linear-gradient(135deg, #7c3aed, #a855f7)",
            clipPath: "polygon(0 0, 100% 0, 0 100%)",
            opacity: 0.9,
          }}
        />
        <div
          className="absolute -z-10 pointer-events-none hidden lg:block lg:w-[100px] lg:h-[100px] lg:top-[320px] lg:left-[220px]"
          style={{
            background: "#a3e635",
            clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
            opacity: 0.9,
          }}
        />
      </div>

      {/* Profile View Dialog */}
      <Dialog open={!!viewingProfileId} onOpenChange={(open) => !open && setViewingProfileId(null)}>
        <DialogContent className="max-w-[100vw] sm:max-w-4xl w-[100vw] sm:w-[95vw] h-[100dvh] sm:h-auto sm:max-h-[90vh] p-0 gap-0 bg-white border-0 sm:border sm:border-gray-200 rounded-none sm:rounded-xl fixed inset-0 sm:inset-auto sm:left-[50%] sm:top-[50%] !translate-x-0 !translate-y-0 sm:!translate-x-[-50%] sm:!translate-y-[-50%]" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
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
