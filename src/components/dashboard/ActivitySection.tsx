import { Fragment, useCallback, useEffect, useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useFollowers } from "@/hooks/useFollowers";
import { Loader2, ArrowLeft, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import PostCard from "./PostCard";
import { moderationBadgeLabel } from "@/lib/moderationBadge";
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
  comments_disabled?: boolean;
  // Only ever set on myRecentPosts entries (the author's own just-published
  // posts, pinned client-side) — get_activity_feed already filters everyone
  // else's posts to moderation_status='approved' server-side, so this is
  // never needed for the rest of the feed.
  moderation_status?: string;
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

const FEED_PAGE_SIZE = 20;
const OWN_POST_PIN_DURATION_MS = 10 * 60 * 1000;

const ActivitySection = ({ onNavigateToChat, onNavigateToProfile }: { onNavigateToChat?: (userId: string) => void; onNavigateToProfile?: () => void }) => {
  const { lang } = useLanguage();
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
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
  const { count: followerCount } = useFollowers(currentUserId);
  // The feed permanently excludes the viewer's own posts server-side, but
  // right after posting we still want a brief "yes, it went through"
  // confirmation — so a just-created own post is pinned to the top for
  // OWN_POST_PIN_DURATION_MS, tracked purely client-side (never sent to the
  // RPC), then dropped from view entirely (it remains visible on the
  // profile's own Posts tab regardless). This is a list, not a single slot —
  // publishing a second post within the 10-minute window must not cut the
  // first one's remaining time short; each pinned post carries its own
  // expiry and is cleared independently. Persisted to localStorage (keyed
  // per user) because ActivitySection unmounts on navigation — plain
  // useState would silently lose the pins the moment the user left and came
  // back to Activity within the window.
  const [myRecentPosts, setMyRecentPosts] = useState<Post[]>([]);
  const myRecentPostTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const RECENT_POSTS_STORAGE_KEY = (uid: string) => `activity-recent-own-posts-${uid}`;

  const persistRecentPosts = (uid: string, entries: { post: Post; expiresAt: number }[]) => {
    try {
      if (entries.length > 0) localStorage.setItem(RECENT_POSTS_STORAGE_KEY(uid), JSON.stringify(entries));
      else localStorage.removeItem(RECENT_POSTS_STORAGE_KEY(uid));
    } catch (err) {
      console.error("Failed to persist recent own posts:", err);
    }
  };

  const removeExpiredRecentPost = (uid: string, postId: string) => {
    myRecentPostTimersRef.current.delete(postId);
    setMyRecentPosts((prev) => {
      const next = prev.filter((p) => p.id !== postId);
      try {
        const raw = localStorage.getItem(RECENT_POSTS_STORAGE_KEY(uid));
        const entries: { post: Post; expiresAt: number }[] = raw ? JSON.parse(raw) : [];
        persistRecentPosts(uid, entries.filter((e) => e.post.id !== postId));
      } catch (err) {
        console.error("Failed to update persisted recent own posts:", err);
      }
      return next;
    });
  };

  const scheduleRecentPostClear = (uid: string, postId: string, msRemaining: number) => {
    const existing = myRecentPostTimersRef.current.get(postId);
    if (existing) clearTimeout(existing);
    const timer = setTimeout(() => removeExpiredRecentPost(uid, postId), msRemaining);
    myRecentPostTimersRef.current.set(postId, timer);
  };

  // Pins a just-created own post to the top of Activity for
  // OWN_POST_PIN_DURATION_MS. Shared by the NewPostComposer instance
  // embedded here AND by the realtime INSERT listener below — the latter is
  // what makes this work for a post created from anywhere else (e.g. the
  // Personal Profile's own composer), since this component has no other way
  // to learn about it.
  const pinOwnPost = (uid: string, recentPost: Post & { video_url: string | null }) => {
    if (myRecentPostTimersRef.current.has(recentPost.id)) return; // already pinned
    const expiresAt = Date.now() + OWN_POST_PIN_DURATION_MS;
    setMyRecentPosts((prev) => [recentPost, ...prev]);
    try {
      const raw = localStorage.getItem(RECENT_POSTS_STORAGE_KEY(uid));
      const entries: { post: Post; expiresAt: number }[] = raw ? JSON.parse(raw) : [];
      persistRecentPosts(uid, [{ post: recentPost, expiresAt }, ...entries]);
    } catch (err) {
      console.error("Failed to persist new recent own post:", err);
    }
    scheduleRecentPostClear(uid, recentPost.id, OWN_POST_PIN_DURATION_MS);
  };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setCurrentUserId(user.id);
        loadMyProfile(user.id);
        (supabase as any).from("user_privacy_settings").select("hide_like_share_counts").eq("user_id", user.id).maybeSingle()
          .then(({ data }: any) => { if (data) setHideLikeCounts(data.hide_like_share_counts ?? false); })
          .catch((err: unknown) => console.error("Failed to load privacy settings:", err));

        try {
          const raw = localStorage.getItem(RECENT_POSTS_STORAGE_KEY(user.id));
          if (raw) {
            const entries: { post: Post; expiresAt: number }[] = JSON.parse(raw);
            const now = Date.now();
            const stillValid = entries.filter((e) => e.expiresAt > now);
            if (stillValid.length !== entries.length) persistRecentPosts(user.id, stillValid);
            setMyRecentPosts(stillValid.map((e) => e.post));
            stillValid.forEach((e) => scheduleRecentPostClear(user.id, e.post.id, e.expiresAt - now));

            // The stored moderation_status is a snapshot from when the post
            // was made — a page reload/revisit must not keep showing a
            // stale "pending"/"flagged" badge for something an admin
            // already approved while the tab was closed. Re-fetch the
            // current status for each still-pinned post.
            const ids = stillValid.map((e) => e.post.id);
            if (ids.length > 0) {
              supabase.from("posts").select("id, moderation_status, image_url, video_url").in("id", ids)
                .then(({ data }) => {
                  if (!data) return;
                  const byId = new Map(data.map((p: any) => [p.id, p]));
                  setMyRecentPosts((prev) => prev.map((p) => {
                    const fresh = byId.get(p.id);
                    return fresh ? { ...p, moderation_status: fresh.moderation_status, image_url: fresh.image_url, video_url: fresh.video_url } : p;
                  }));
                })
                .catch((err) => console.error("Failed to refresh recent own posts' moderation status:", err));
            }
          }
        } catch (err) {
          console.error("Failed to restore recent own posts:", err);
        }
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

  const fetchSportrisePosts = async (): Promise<Post[]> => {
    const { data } = await (supabase as any).from("sportrise_posts").select("*").is("deleted_at", null).eq("is_archived", false).order("created_at", { ascending: false }).limit(20);
    return (data || []).map((p: any) => ({
      id: p.id,
      user_id: "sportrise",
      content: p.content,
      image_url: p.image_url,
      post_type: "sportrise",
      created_at: p.created_at,
      author_name: "SportRise",
      author_photo: null,
      author_role: "sportrise",
      author_title: "",
      comments_disabled: p.comments_disabled,
    }));
  };

  const fetchFeedPage = async (userId: string, offset: number): Promise<Post[]> => {
    const { data, error } = await (supabase as any).rpc("get_activity_feed", {
      p_user_id: userId,
      p_limit: FEED_PAGE_SIZE,
      p_offset: offset,
    });
    if (error) { console.error("Failed to load activity feed:", error); return []; }
    return (data || []).map((p: any) => ({
      id: p.id,
      user_id: p.user_id,
      content: p.content,
      image_url: p.image_url,
      video_url: p.video_url,
      post_type: p.post_type,
      created_at: p.created_at,
      author_name: p.author_name || (lang === "ro" ? "Utilizator" : "User"),
      author_photo: p.author_photo,
      author_role: p.author_role,
      author_title: p.author_title || "",
      comments_disabled: p.comments_disabled,
    }));
  };

  const fetchPosts = async (userId: string) => {
    setLoading(true);
    setHasMore(true);
    const [sportrisePosts, feedPage] = await Promise.all([
      fetchSportrisePosts(),
      fetchFeedPage(userId, 0),
    ]);
    setPosts([...sportrisePosts, ...feedPage]);
    setHasMore(feedPage.length === FEED_PAGE_SIZE);
    setLoading(false);
  };

  const loadMorePosts = useCallback(async () => {
    if (loadingMore || !hasMore || loading || !currentUserId) return;
    setLoadingMore(true);
    // Only posts/scout_posts are paginated — sportrise_posts were already
    // fetched in full (capped at 20) on the initial load, so the offset only
    // needs to count the paginated portion of what's currently shown.
    const paginatedCount = posts.filter(p => p.author_role !== "sportrise").length;
    const nextPage = await fetchFeedPage(currentUserId, paginatedCount);
    setPosts(prev => [...prev, ...nextPage]);
    setHasMore(nextPage.length === FEED_PAGE_SIZE);
    setLoadingMore(false);
  }, [loadingMore, hasMore, loading, currentUserId, posts]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMorePosts();
    }, { rootMargin: "400px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMorePosts]);

  const currentUserIdRef = useRef<string | null>(null);
  currentUserIdRef.current = currentUserId;
  // Kept in refs (not read from state directly) because the realtime
  // listener below is set up once ([] deps) — it needs the latest author
  // info at the moment a post comes in, not whatever it was when the
  // channel was first subscribed.
  const myAuthorInfoRef = useRef({ name: "", photo: null as string | null, role: "player" as "player" | "cauta_jucator", title: "" });
  myAuthorInfoRef.current = {
    name: myName || (lang === "ro" ? "Tu" : "You"),
    photo: myPhoto,
    role: myRole || "player",
    title: myRole === "player" ? [myProfile?.position, myProfile?.current_team].filter(Boolean).join(" · ") : myTitle,
  };

  useEffect(() => { if (currentUserId) fetchPosts(currentUserId); }, [currentUserId]);

  useEffect(() => {
    return () => { myRecentPostTimersRef.current.forEach((t) => clearTimeout(t)); };
  }, []);

  useEffect(() => {
    const handleInsert = (payload: any) => {
      const uid = currentUserIdRef.current;
      if (!uid) return;

      const newUserId = payload.new?.user_id;

      // A post of mine, created from anywhere (Activity's own composer
      // already pins it directly via onPosted — this is what covers every
      // OTHER place a post can be created, e.g. the Personal Profile tab's
      // composer, which has no way to reach this component directly).
      if (newUserId === uid && payload.new?.id) {
        const p = payload.new;
        const author = myAuthorInfoRef.current;
        pinOwnPost(uid, {
          id: p.id, user_id: uid, content: p.content ?? "",
          image_url: p.image_url ?? null, video_url: p.video_url ?? null,
          post_type: p.post_type ?? "general", created_at: p.created_at ?? new Date().toISOString(),
          author_name: author.name, author_photo: author.photo, author_role: author.role, author_title: author.title,
          moderation_status: p.moderation_status ?? "pending",
        });
        return;
      }

      // Otherwise: someone else's post — excluded from this feed anyway
      // (only other people's posts show here via get_activity_feed), just
      // show the refresh hint like any other new post.
      setNewPostsAvailable(true);
    };
    const handleDeleteEvent = (payload: any) => {
      const uid = currentUserIdRef.current;
      if (!uid) return;
      fetchPosts(uid);
    };
    // myRecentPosts entries capture moderation_status at the moment they
    // were created and never re-fetch — without this, an admin approving or
    // rejecting a post later has no way to reach the author's already-open
    // Activity tab, and the badge (and hidden media, if still pending) would
    // stay stuck showing the stale status indefinitely. Also covers a
    // soft-delete (deleted_at set from the Personal Profile's own composer,
    // or anywhere else) — an own post deleted while still pinned must
    // disappear from here immediately, not linger until its 10-minute
    // window naturally expires.
    const handleUpdate = (payload: any) => {
      const uid = currentUserIdRef.current;
      if (!uid || payload.new?.user_id !== uid) return;
      if (payload.new?.deleted_at) {
        const timer = myRecentPostTimersRef.current.get(payload.new.id);
        if (timer) clearTimeout(timer);
        removeExpiredRecentPost(uid, payload.new.id);
        return;
      }
      setMyRecentPosts((prev) => prev.map((p) =>
        p.id === payload.new.id
          ? { ...p, moderation_status: payload.new.moderation_status, image_url: payload.new.image_url, video_url: payload.new.video_url }
          : p
      ));
    };
    const channel = supabase.channel("posts-feed-" + Date.now())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "posts" }, handleInsert)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "scout_posts" }, handleInsert)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sportrise_posts" }, handleInsert)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "posts" }, handleUpdate)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "posts" }, handleDeleteEvent)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "scout_posts" }, handleDeleteEvent)
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "sportrise_posts" }, handleDeleteEvent)
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
    if (currentUserId && myRecentPosts.some((p) => p.id === postId)) {
      const timer = myRecentPostTimersRef.current.get(postId);
      if (timer) clearTimeout(timer);
      removeExpiredRecentPost(currentUserId, postId);
    }
    if (currentUserId) fetchPosts(currentUserId);
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
          <DialogContent className="max-w-[100vw] sm:max-w-4xl w-[100vw] sm:w-[95vw] h-[100dvh] sm:h-auto sm:max-h-[90vh] p-0 gap-0 bg-white border-0 sm:border sm:border-gray-200 rounded-none sm:rounded-xl fixed inset-0 sm:inset-auto sm:left-[50%] sm:top-[50%] !translate-x-0 !translate-y-0 sm:!translate-x-[-50%] sm:!translate-y-[-50%] overflow-hidden" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
            <DialogTitle className="sr-only">{lang === "ro" ? "Profil" : "Profile"}</DialogTitle>
            <div className="overflow-y-auto overflow-x-hidden h-full sm:max-h-[90vh] p-4 lg:p-8">
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
          {currentUserId && (
            <div className="mx-4 lg:mx-0">
              <NewPostComposer
                currentUserId={currentUserId}
                myPhoto={myPhoto}
                myRole={myRole}
                onPosted={(post) => {
                  fetchPosts(currentUserId);
                  if (!post) return;
                  // myRecentPost only ever exists in the author's own
                  // browser state — it's never sent to, or seen by, any
                  // other user (everyone else's feed comes from
                  // get_activity_feed, which already filters strictly to
                  // moderation_status='approved' server-side). So the
                  // author can safely see their own image/video here right
                  // away, with the badge below showing it isn't public
                  // yet, instead of hiding it from them too.
                  pinOwnPost(currentUserId, {
                    id: post.id,
                    user_id: currentUserId,
                    content: post.content,
                    image_url: post.image_url,
                    video_url: post.video_url,
                    post_type: post.post_type,
                    created_at: post.created_at,
                    author_name: myName || (lang === "ro" ? "Tu" : "You"),
                    author_photo: myPhoto,
                    author_role: myRole || "player",
                    author_title: myRole === "player" ? [myProfile?.position, myProfile?.current_team].filter(Boolean).join(" · ") : myTitle,
                    moderation_status: post.moderation_status,
                  });
                }}
              />
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
                if (currentUserId) fetchPosts(currentUserId);
              }}
              className="w-[calc(100%-2rem)] mx-4 lg:w-full lg:mx-0 py-2.5 rounded-lg bg-orange-50 border border-orange-200 text-orange-600 text-sm font-medium hover:bg-orange-100 transition-colors"
            >
              {lang === "ro" ? "🔄 Sunt postări noi. Apasă pentru a le vedea." : "🔄 New posts available. Tap to refresh."}
            </button>
          )}

          {/* Feed */}
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-orange-500" /></div>
          ) : posts.length === 0 && myRecentPosts.length === 0 ? (
            <div className="text-center py-16 text-gray-500 px-4 lg:px-0">
              {lang === "ro" ? "Nicio postare încă. Urmărește persoane pentru a vedea activitatea lor aici!" : "No posts yet. Follow people to see their activity here!"}
            </div>
          ) : (
            <div className="space-y-4">
              {myRecentPosts.map((recentPost, idx) => (
                <Fragment key={recentPost.id}>
                  <div className="relative">
                    {/* Own just-published posts, each pinned client-side for
                        OWN_POST_PIN_DURATION_MS from its own publish time —
                        publishing a new one does not cut short an earlier
                        one still within its window. Image/video is shown to
                        the author right away (see onPosted) even while
                        moderation_status isn't 'approved' — this badge is
                        what tells them it isn't visible to anyone else yet.
                        Never shown to anyone else (myRecentPosts only ever
                        exists in the poster's own session/browser state). */}
                    {(() => {
                      const badge = moderationBadgeLabel(recentPost.moderation_status, lang);
                      return badge ? (
                        <span className={`absolute top-3 right-3 z-10 text-[11px] font-semibold px-2 py-1 rounded-full ${badge.className}`}>
                          {badge.label}
                        </span>
                      ) : null;
                    })()}
                    <PostCard
                      post={{ id: recentPost.id, user_id: recentPost.user_id, content: recentPost.content, image_url: recentPost.image_url, video_url: (recentPost as any).video_url || null, post_type: recentPost.post_type, created_at: recentPost.created_at, comments_disabled: false }}
                      author={{ user_id: recentPost.user_id, name: recentPost.author_name, photo: recentPost.author_photo, role: recentPost.author_role, title: recentPost.author_title }}
                      currentUserId={currentUserId}
                      onDelete={handleDelete}
                      onViewProfile={handleViewProfile}
                      hideLikeCounts={hideLikeCounts}
                      simplifiedMenu
                    />
                  </div>
                  {(idx < myRecentPosts.length - 1 || posts.length > 0) && <FeedDivider index={idx} />}
                </Fragment>
              ))}
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
              <div ref={sentinelRef} className="h-1" />
              {loadingMore && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
                </div>
              )}
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
        <DialogContent className="max-w-[100vw] sm:max-w-4xl w-[100vw] sm:w-[95vw] h-[100dvh] sm:h-auto sm:max-h-[90vh] p-0 gap-0 bg-white border-0 sm:border sm:border-gray-200 rounded-none sm:rounded-xl fixed inset-0 sm:inset-auto sm:left-[50%] sm:top-[50%] !translate-x-0 !translate-y-0 sm:!translate-x-[-50%] sm:!translate-y-[-50%] overflow-hidden" onPointerDownOutside={(e) => e.preventDefault()} onInteractOutside={(e) => e.preventDefault()}>
          <DialogTitle className="sr-only">{lang === "ro" ? "Profil" : "Profile"}</DialogTitle>
          <div className="overflow-y-auto overflow-x-hidden h-full sm:max-h-[90vh] p-4 lg:p-8">
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
