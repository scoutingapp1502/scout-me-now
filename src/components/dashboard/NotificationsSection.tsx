import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { UserPlus, ArrowLeft, CheckCheck, Handshake, Check, X, Star, Video, Heart, Loader2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import PersonalProfile, { getTestLabelByKey } from "./PersonalProfile";
import ScoutPersonalProfile from "./ScoutPersonalProfile";
import { markNotificationRead, markAllNotificationsRead, isNotificationRead } from "@/hooks/useNotificationCount";
import { useToast } from "@/hooks/use-toast";

interface FollowNotification {
  id: string;
  type: "follow";
  follower_id: string;
  created_at: string;
  responded_at?: string | null;
  status: "pending" | "accepted" | "rejected";
  follower_name: string;
  follower_photo: string | null;
  follower_role: "player" | "cauta_jucator";
  isRead: boolean;
  direction: "incoming" | "outgoing";
}

interface CollabNotification {
  id: string;
  type: "collab_request";
  other_user_id: string;
  created_at: string;
  other_name: string;
  other_photo: string | null;
  status: string;
  perspective: "agent" | "player";
  initiated_by: "agent" | "player";
  isRead: boolean;
}

interface RecommendationNotification {
  id: string;
  type: "recommendation";
  other_user_id: string;
  other_name: string;
  other_photo: string | null;
  other_role: "player" | "cauta_jucator";
  created_at: string;
  status: "pending" | "submitted";
  perspective: "author" | "recipient";
  isRead: boolean;
}

interface VideoNotification {
  id: string;
  type: "video";
  videoType: "highlight" | "test";
  player_id: string;
  player_name: string;
  player_photo: string | null;
  player_sport: string | null;
  test_key: string | null;
  created_at: string;
  isRead: boolean;
}

interface StoryLikeNotification {
  id: string;
  type: "story_like";
  other_user_id: string;
  other_name: string;
  other_photo: string | null;
  other_role: "player" | "cauta_jucator";
  created_at: string;
  isRead: boolean;
}

// Issued by an admin via AdminUsersAtRisk (see
// 20261008090000_user_warnings_as_notifications.sql) — never retracted,
// accumulates permanently, unlike every other notification kind here there
// is no "other person" to attribute it to, it comes from the platform
// itself.
interface WarningNotification {
  id: string;
  type: "warning";
  created_at: string;
  isRead: boolean;
}

// Automatic, generic "your content was removed" notice — fired by
// reject-post/reject-avatar/approve_user_report whenever content is
// actually deleted, whether from the automated moderation pipeline or an
// admin approving another user's report (see
// 20261013090000_content_rejection_notices.sql). Deliberately distinct
// from WarningNotification: this never increments any admin-facing
// counter, it's purely informational.
interface ContentRejectionNotification {
  id: string;
  type: "content_rejection";
  contentType: "post" | "comment" | "avatar";
  created_at: string;
  isRead: boolean;
}

type Notification = FollowNotification | CollabNotification | RecommendationNotification | VideoNotification | StoryLikeNotification | WarningNotification | ContentRejectionNotification;

const NOTIF_PAGE_SIZE = 20;

// Turns one denormalized row from the get_notifications_feed RPC back into
// the discriminated Notification union the rest of this component (and its
// JSX) already knows how to render.
function mapNotifRow(row: any, userId: string): Notification | null {
  switch (row.notif_type) {
    case "follow":
      return {
        id: row.notif_id,
        type: "follow",
        follower_id: row.other_user_id,
        created_at: row.created_at,
        status: row.status,
        follower_name: row.other_name,
        follower_photo: row.other_photo,
        follower_role: row.other_role,
        isRead: isNotificationRead(userId, row.notif_id),
        direction: row.direction,
      };
    case "collab_request":
      return {
        id: row.notif_id,
        type: "collab_request",
        other_user_id: row.other_user_id,
        created_at: row.created_at,
        other_name: row.other_name,
        other_photo: row.other_photo,
        status: row.status,
        perspective: row.perspective,
        initiated_by: row.initiated_by,
        isRead: row.status !== "pending" || isNotificationRead(userId, row.notif_id),
      };
    case "recommendation":
      return {
        id: row.notif_id,
        type: "recommendation",
        other_user_id: row.other_user_id,
        other_name: row.other_name,
        other_photo: row.other_photo,
        other_role: row.other_role,
        created_at: row.created_at,
        status: row.status,
        perspective: row.perspective,
        isRead: isNotificationRead(userId, row.notif_id),
      };
    case "video":
      return {
        id: row.notif_id,
        type: "video",
        videoType: row.video_type,
        player_id: row.other_user_id,
        player_name: row.other_name,
        player_photo: row.other_photo,
        player_sport: row.player_sport,
        test_key: row.test_key,
        created_at: row.created_at,
        isRead: isNotificationRead(userId, row.notif_id),
      };
    case "story_like":
      return {
        id: row.notif_id,
        type: "story_like",
        other_user_id: row.other_user_id,
        other_name: row.other_name,
        other_photo: row.other_photo,
        other_role: row.other_role,
        created_at: row.created_at,
        isRead: isNotificationRead(userId, row.notif_id),
      };
    case "warning":
      return {
        id: row.notif_id,
        type: "warning",
        created_at: row.created_at,
        isRead: isNotificationRead(userId, row.notif_id),
      };
    case "content_rejection":
      return {
        id: row.notif_id,
        type: "content_rejection",
        // Carried in the player_sport slot — see this row shape's other
        // type-specific reuses (e.g. video's test_key) for the same
        // no-dedicated-column convention.
        contentType: row.player_sport,
        created_at: row.created_at,
        isRead: isNotificationRead(userId, row.notif_id),
      };
    default:
      return null;
  }
}

const NotificationsSection = ({ onNavigateToChat, onNavigateToProfile }: { onNavigateToChat?: (userId: string) => void; onNavigateToProfile?: () => void }) => {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [viewProfileUserId, setViewProfileUserId] = useState<string | null>(null);
  const [viewProfileRole, setViewProfileRole] = useState<"player" | "cauta_jucator" | null>(null);

  const fetchNotificationsPage = async (userId: string, role: string, offset: number): Promise<Notification[]> => {
    const { data, error } = await (supabase as any).rpc("get_notifications_feed", {
      p_user_id: userId,
      p_role: role,
      p_limit: NOTIF_PAGE_SIZE,
      p_offset: offset,
    });
    if (error) { console.error("Failed to load notifications:", error); return []; }
    return (data || [])
      .map((row: any) => mapNotifRow(row, userId))
      .filter((n: Notification | null): n is Notification => n !== null);
  };

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);
    setLoading(true);
    setHasMore(true);

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const userRole = roleData?.role || "player";
    setCurrentUserRole(userRole);

    const page = await fetchNotificationsPage(user.id, userRole, 0);
    setNotifications(page);
    setHasMore(page.length === NOTIF_PAGE_SIZE);
    setLoading(false);
  };

  const loadMoreNotifications = useCallback(async () => {
    if (loadingMore || !hasMore || loading || !currentUserId || !currentUserRole) return;
    setLoadingMore(true);
    const nextPage = await fetchNotificationsPage(currentUserId, currentUserRole, notifications.length);
    setNotifications(prev => [...prev, ...nextPage]);
    setHasMore(nextPage.length === NOTIF_PAGE_SIZE);
    setLoadingMore(false);
  }, [loadingMore, hasMore, loading, currentUserId, currentUserRole, notifications.length]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) loadMoreNotifications();
    }, { rootMargin: "400px" });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [loadMoreNotifications]);

  useEffect(() => {
    fetchNotifications();
  }, []);

  // Realtime subscription is scoped to the current user's rows, so it can
  // only be set up once we know currentUserId (resolved by fetchNotifications).
  useEffect(() => {
    if (!currentUserId) return;

    const channel = supabase
      .channel(`notifications-all-${currentUserId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "follows", filter: `following_id=eq.${currentUserId}` }, () => {
        fetchNotifications();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "follows", filter: `follower_id=eq.${currentUserId}` }, () => {
        fetchNotifications();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_collaboration_requests", filter: `agent_user_id=eq.${currentUserId}` }, () => {
        fetchNotifications();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_collaboration_requests", filter: `player_user_id=eq.${currentUserId}` }, () => {
        fetchNotifications();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "recommendations", filter: `author_user_id=eq.${currentUserId}` }, () => {
        fetchNotifications();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "recommendations", filter: `recipient_user_id=eq.${currentUserId}` }, () => {
        fetchNotifications();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "player_video_notifications" }, () => {
        fetchNotifications();
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "story_likes" }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId]);

  const handleMarkOneRead = (notifId: string) => {
    if (!currentUserId) return;
    markNotificationRead(currentUserId, notifId);
    setNotifications(prev => prev.map(n => n.id === notifId ? { ...n, isRead: true } : n));
  };

  const handleMarkAllRead = () => {
    if (!currentUserId) return;
    const allIds = notifications.map(n => n.id);
    markAllNotificationsRead(currentUserId, allIds);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const handleClickFollowNotification = (n: FollowNotification) => {
    handleMarkOneRead(n.id);
    setViewProfileUserId(n.follower_id);
    setViewProfileRole(n.follower_role);
  };

  const handleAcceptFollow = async (n: FollowNotification) => {
    try {
      const { error } = await supabase.rpc("accept_follow_request", { _follow_id: n.id });
      if (error) throw error;
      handleMarkOneRead(n.id);
      toast({ title: lang === "ro" ? "Cerere de urmărire acceptată" : "Follow request accepted" });
      fetchNotifications();
    } catch (err: any) {
      toast({ title: lang === "ro" ? "Eroare" : "Error", description: err?.message, variant: "destructive" });
    }
  };

  const handleRejectFollow = async (n: FollowNotification) => {
    try {
      const { error } = await supabase.rpc("reject_follow_request", { _follow_id: n.id });
      if (error) throw error;
      handleMarkOneRead(n.id);
      toast({ title: lang === "ro" ? "Cerere respinsă" : "Request rejected" });
      fetchNotifications();
    } catch (err: any) {
      toast({ title: lang === "ro" ? "Eroare" : "Error", description: err?.message, variant: "destructive" });
    }
  };

  const handleClickCollabNotification = (n: CollabNotification) => {
    handleMarkOneRead(n.id);
    setViewProfileUserId(n.other_user_id);
    setViewProfileRole(n.perspective === "agent" ? "player" : "cauta_jucator");
  };

  const handleAcceptCollab = async (n: CollabNotification) => {
    try {
      const { error } = await supabase.rpc("accept_collaboration_request", { _request_id: n.id });
      if (error) throw error;

      handleMarkOneRead(n.id);
      toast({
        title: lang === "ro" ? "Colaborare acceptată!" : "Collaboration accepted!",
      });
      fetchNotifications();
    } catch (err: any) {
      console.error(err);
      toast({ title: lang === "ro" ? "Eroare" : "Error", description: err?.message, variant: "destructive" });
    }
  };

  const handleRejectCollab = async (n: CollabNotification) => {
    try {
      const { error } = await supabase.rpc("reject_collaboration_request", { _request_id: n.id });
      if (error) throw error;

      handleMarkOneRead(n.id);
      toast({ title: lang === "ro" ? "Cerere respinsă" : "Request rejected" });
      fetchNotifications();
    } catch (err: any) {
      console.error(err);
      toast({ title: lang === "ro" ? "Eroare" : "Error", description: err?.message, variant: "destructive" });
    }
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return lang === "ro" ? "acum" : "just now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  const roleLabel = (role: string) => {
    if (role === "player") return lang === "ro" ? "Jucător" : "Player";
    return lang === "ro" ? "Descoperitor" : "Discoverer";
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (viewProfileUserId && viewProfileRole) {
    return (
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 gap-2 text-gray-900 hover:bg-gray-100"
          onClick={() => { setViewProfileUserId(null); setViewProfileRole(null); }}
        >
          <ArrowLeft className="h-4 w-4" />
          {lang === "ro" ? "Înapoi la notificări" : "Back to notifications"}
        </Button>
        {viewProfileRole === "player"
          ? <PersonalProfile userId={viewProfileUserId} readOnly onNavigateToChat={onNavigateToChat} />
          : <ScoutPersonalProfile userId={viewProfileUserId} readOnly onNavigateToChat={onNavigateToChat} />}
      </div>
    );
  }

  return (
    <div className="max-w-2xl lg:mx-auto relative isolate flex flex-col h-full min-h-0 -m-4 lg:-m-8 overflow-x-hidden">
      <div className="flex items-center justify-between mb-6 pt-4 lg:pt-8 px-4 lg:px-8 shrink-0 sticky top-0 z-10 bg-gray-200">
        <h2 className="text-2xl font-display text-gray-900">
          {lang === "ro" ? "Notificări" : "Notifications"}
        </h2>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="gap-2 font-body bg-orange-500 border-orange-500 text-white hover:bg-orange-600 hover:text-white">
            <CheckCheck className="h-4 w-4" />
            {lang === "ro" ? "Marchează toate ca citite" : "Mark all as read"}
          </Button>
        )}
      </div>

      {/* Decorative geometric shape above the list */}
      <div className="relative h-0 overflow-visible shrink-0">
        <div
          className="absolute -z-10 pointer-events-none"
          style={{
            top: "-24px",
            right: "-28px",
            width: "170px",
            height: "170px",
            background: "linear-gradient(135deg, #f97316, #fb923c)",
            clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
            opacity: 0.9,
          }}
        />
      </div>

      <div className="flex-1 overflow-y-auto pb-4 lg:pb-8 px-0 lg:px-8">
      {loading ? (
        <div className="text-gray-500 text-center py-12 px-4 lg:px-0">
          {lang === "ro" ? "Se încarcă..." : "Loading..."}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-gray-500 text-center py-12 px-4 lg:px-0">
          {lang === "ro" ? "Nu ai notificări încă." : "No notifications yet."}
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map(n => {
            if (n.type === "follow") {
              const fn = n as FollowNotification;
              const isIncomingRequest = fn.direction === "incoming" && fn.status === "pending";
              const followMessage = () => {
                if (fn.direction === "incoming") {
                  if (fn.status === "pending") return lang === "ro" ? "vrea să te urmărească" : "wants to follow you";
                  if (fn.status === "accepted") return lang === "ro" ? "ai acceptat cererea de urmărire" : "you accepted the follow request";
                  return lang === "ro" ? "ai refuzat cererea de urmărire" : "you rejected the follow request";
                }

                if (fn.status === "accepted") return lang === "ro" ? "ți-a acceptat cererea de urmărire" : "accepted your follow request";
                return lang === "ro" ? "ți-a refuzat cererea de urmărire" : "rejected your follow request";
              };

              return (
                <button
                  key={fn.id}
                  onClick={() => handleClickFollowNotification(fn)}
                  className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-all text-left ${
                    fn.isRead
                      ? "bg-white border-gray-200 hover:bg-gray-50"
                      : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="shrink-0 w-2.5 flex items-center justify-center">
                    {!fn.isRead && (
                      <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 animate-pulse" />
                    )}
                  </div>
                  <Avatar className="h-10 w-10">
                    {fn.follower_photo ? <AvatarImage src={fn.follower_photo} /> : null}
                    <AvatarFallback className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm">
                      {fn.follower_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${fn.isRead ? "text-gray-900" : "text-gray-900 font-semibold"}`}>
                      <span className="font-semibold">{fn.follower_name}</span>{" "}
                      <span className={fn.isRead ? "text-gray-500" : "text-gray-900/80"}>
                        {followMessage()}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {roleLabel(fn.follower_role)} · {timeAgo(fn.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {isIncomingRequest ? (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-green-500 hover:text-green-400 hover:bg-green-500/10"
                          onClick={(e) => { e.stopPropagation(); handleAcceptFollow(fn); }}
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => { e.stopPropagation(); handleRejectFollow(fn); }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </>
                    ) : null}
                    <UserPlus className={`h-4 w-4 shrink-0 ${fn.status === "accepted" ? "text-green-500" : fn.isRead ? "text-orange-300" : "text-orange-500"}`} />
                  </div>
                </button>
              );
            }

            if (n.type === "collab_request") {
              const cn = n as CollabNotification;

              const collabMessage = () => {
                const isReceiver = (cn.perspective === "agent" && cn.initiated_by === "player") ||
                                   (cn.perspective === "player" && cn.initiated_by === "agent");
                if (cn.status === "sent") return lang === "ro" ? "– cerere de colaborare trimisă" : "– collaboration request sent";
                if (cn.status === "pending" && isReceiver) return lang === "ro" ? "vrea să colaboreze cu tine" : "wants to collaborate with you";
                if (cn.status === "pending") return lang === "ro" ? "– cerere în așteptare" : "– request pending";
                if (cn.status === "accepted") return lang === "ro" ? "– colaborare acceptată" : "– collaboration accepted";
                return lang === "ro" ? "– cerere respinsă" : "– request rejected";
              };

              const roleText = cn.perspective === "agent"
                ? roleLabel("player")
                : roleLabel("cauta_jucator");

              return (
                <div
                  key={cn.id}
                  className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-all ${
                    cn.isRead
                      ? "bg-white border-gray-200"
                      : "bg-white border-gray-200"
                  }`}
                >
                  <div className="shrink-0 w-2.5 flex items-center justify-center">
                    {!cn.isRead && (
                      <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 animate-pulse" />
                    )}
                  </div>
                  <Avatar className="h-10 w-10 cursor-pointer" onClick={() => handleClickCollabNotification(cn)}>
                    {cn.other_photo ? <AvatarImage src={cn.other_photo} /> : null}
                    <AvatarFallback className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm">
                      {cn.other_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleClickCollabNotification(cn)}>
                    <p className={`text-sm ${cn.isRead ? "text-gray-900" : "text-gray-900 font-semibold"}`}>
                      <span className="font-semibold">{cn.other_name}</span>{" "}
                      <span className={cn.isRead ? "text-gray-500" : "text-gray-900/80"}>
                        {collabMessage()}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {roleText} · {timeAgo(cn.created_at)}
                    </p>
                  </div>
                  {cn.status === "pending" && cn.initiated_by !== cn.perspective ? (
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-green-500 hover:text-green-400 hover:bg-green-500/10"
                        onClick={() => handleAcceptCollab(cn)}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRejectCollab(cn)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <Handshake className={`h-4 w-4 shrink-0 ${cn.status === "accepted" ? "text-green-500" : cn.status === "pending" ? "text-yellow-500" : "text-gray-500"}`} />
                  )}
                </div>
              );
            }

            if (n.type === "recommendation") {
              const rn = n as RecommendationNotification;
              const recMessage = rn.perspective === "author"
                ? (lang === "ro" ? "te-a rugat să scrii o recomandare" : "asked you to write a recommendation")
                : (lang === "ro" ? "a scris o recomandare pentru tine" : "wrote a recommendation for you");

              const handleRecClick = () => {
                handleMarkOneRead(rn.id);
                if (rn.perspective === "author") {
                  // Go to requester's profile to write the recommendation
                  setViewProfileUserId(rn.other_user_id);
                  setViewProfileRole(rn.other_role === "player" ? "player" : "cauta_jucator");
                } else {
                  // Go to own profile where the submitted recommendation awaits approval
                  onNavigateToProfile?.();
                }
              };

              return (
                <button
                  key={rn.id}
                  onClick={handleRecClick}
                  className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-all text-left ${
                    rn.isRead ? "bg-white border-gray-200 hover:bg-gray-50" : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="shrink-0 w-2.5 flex items-center justify-center">
                    {!rn.isRead && <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 animate-pulse" />}
                  </div>
                  <Avatar className="h-10 w-10">
                    {rn.other_photo ? <AvatarImage src={rn.other_photo} /> : null}
                    <AvatarFallback className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm">
                      {rn.other_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${rn.isRead ? "text-gray-900" : "text-gray-900 font-semibold"}`}>
                      <span className="font-semibold">{rn.other_name}</span>{" "}
                      <span className={rn.isRead ? "text-gray-500" : "text-gray-900/80"}>
                        {recMessage}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{timeAgo(rn.created_at)}</p>
                  </div>
                  <Star className={`h-4 w-4 shrink-0 ${rn.perspective === "recipient" ? "text-green-500" : rn.isRead ? "text-orange-300" : "text-orange-500"}`} />
                </button>
              );
            }

            if (n.type === "video") {
              const vn = n as VideoNotification;
              const testLabel = vn.test_key && vn.player_sport
                ? getTestLabelByKey(vn.player_sport, vn.test_key, lang)
                : null;
              const msg = vn.videoType === "highlight"
                ? (lang === "ro" ? "a adăugat un nou video highlight" : "added a new highlight video")
                : testLabel
                  ? (lang === "ro" ? `a adăugat un video pentru testul: ${testLabel}` : `added a test video: ${testLabel}`)
                  : (lang === "ro" ? "a adăugat un nou video de test" : "added a new test video");
              const typeLabel = vn.videoType === "highlight" ? "Highlight" : "Test video";

              return (
                <button
                  key={vn.id}
                  onClick={() => {
                    handleMarkOneRead(vn.id);
                    setViewProfileUserId(vn.player_id);
                    setViewProfileRole("player");
                  }}
                  className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-all text-left ${
                    vn.isRead ? "bg-white border-gray-200 hover:bg-gray-50" : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="shrink-0 w-2.5 flex items-center justify-center">
                    {!vn.isRead && <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 animate-pulse" />}
                  </div>
                  <Avatar className="h-10 w-10">
                    {vn.player_photo ? <AvatarImage src={vn.player_photo} /> : null}
                    <AvatarFallback className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm">
                      {vn.player_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${vn.isRead ? "text-gray-900" : "text-gray-900 font-semibold"}`}>
                      <span className="font-semibold">{vn.player_name}</span>{" "}
                      <span className={vn.isRead ? "text-gray-500" : "text-gray-900/80"}>{msg}</span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {typeLabel} · {timeAgo(vn.created_at)}
                    </p>
                  </div>
                  <Video className={`h-4 w-4 shrink-0 ${vn.isRead ? "text-orange-300" : "text-orange-500"}`} />
                </button>
              );
            }

            if (n.type === "story_like") {
              const sn = n as StoryLikeNotification;
              return (
                <button
                  key={sn.id}
                  onClick={() => {
                    handleMarkOneRead(sn.id);
                    setViewProfileUserId(sn.other_user_id);
                    setViewProfileRole(sn.other_role === "player" ? "player" : "cauta_jucator");
                  }}
                  className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-all text-left ${
                    sn.isRead ? "bg-white border-gray-200 hover:bg-gray-50" : "bg-white border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  <div className="shrink-0 w-2.5 flex items-center justify-center">
                    {!sn.isRead && <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 animate-pulse" />}
                  </div>
                  <Avatar className="h-10 w-10">
                    {sn.other_photo ? <AvatarImage src={sn.other_photo} /> : null}
                    <AvatarFallback className="bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-sm">
                      {sn.other_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${sn.isRead ? "text-gray-900" : "text-gray-900 font-semibold"}`}>
                      <span className="font-semibold">{sn.other_name}</span>{" "}
                      <span className={sn.isRead ? "text-gray-500" : "text-gray-900/80"}>
                        {lang === "ro" ? "ți-a apreciat story-ul" : "liked your story"}
                      </span>
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{timeAgo(sn.created_at)}</p>
                  </div>
                  <Heart className={`h-4 w-4 shrink-0 ${sn.isRead ? "text-orange-300" : "text-orange-500"} fill-current`} />
                </button>
              );
            }

            if (n.type === "warning") {
              const wn = n as WarningNotification;
              return (
                <button
                  key={wn.id}
                  onClick={() => handleMarkOneRead(wn.id)}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 transition-all text-left"
                >
                  <div className="shrink-0 w-2.5 flex items-center justify-center">
                    {!wn.isRead && <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 animate-pulse" />}
                  </div>
                  <div className="h-10 w-10 rounded-full bg-red-600 flex items-center justify-center shrink-0">
                    <ShieldAlert className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${wn.isRead ? "text-gray-900" : "text-gray-900 font-semibold"}`}>
                      {lang === "ro"
                        ? "Ai primit un avertisment pentru încălcarea regulilor comunității."
                        : "You've received a warning for violating community guidelines."}
                    </p>
                    <p className={`text-sm mt-0.5 ${wn.isRead ? "text-gray-500" : "text-gray-900/80"}`}>
                      {lang === "ro"
                        ? "Dacă o postare viitoare este respinsă, contul tău poate fi blocat sau închis definitiv."
                        : "If a future post is rejected, your account may be suspended or permanently closed."}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{timeAgo(wn.created_at)}</p>
                  </div>
                </button>
              );
            }

            if (n.type === "content_rejection") {
              const rn = n as ContentRejectionNotification;
              const contentLabel = {
                post: lang === "ro" ? "O postare de-a ta" : "One of your posts",
                comment: lang === "ro" ? "Un comentariu de-al tău" : "One of your comments",
                avatar: lang === "ro" ? "Poza ta de profil" : "Your profile photo",
              }[rn.contentType];
              return (
                <button
                  key={rn.id}
                  onClick={() => handleMarkOneRead(rn.id)}
                  className="w-full flex items-center gap-3 p-4 rounded-lg border border-red-200 bg-red-50 hover:bg-red-100 transition-all text-left"
                >
                  <div className="shrink-0 w-2.5 flex items-center justify-center">
                    {!rn.isRead && <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 animate-pulse" />}
                  </div>
                  <div className="h-10 w-10 rounded-full bg-red-600 flex items-center justify-center shrink-0">
                    <ShieldAlert className="h-5 w-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${rn.isRead ? "text-gray-900" : "text-gray-900 font-semibold"}`}>
                      {lang === "ro"
                        ? `${contentLabel} a fost eliminată pentru încălcarea regulilor comunității.`
                        : `${contentLabel} was removed for violating community guidelines.`}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">{timeAgo(rn.created_at)}</p>
                  </div>
                </button>
              );
            }

            return null;
          })}
          <div ref={sentinelRef} className="h-1" />
          {loadingMore && (
            <div className="flex justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-orange-500" />
            </div>
          )}
        </div>
      )}

      {/* Decorative geometric shapes below the list */}
      <div className="relative h-0 overflow-visible">
        <div
          className="absolute -z-10 pointer-events-none"
          style={{
            top: "120px",
            right: "0px",
            width: "150px",
            height: "150px",
            background: "#a3e635",
            clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
            opacity: 0.9,
          }}
        />
        <div
          className="absolute -z-10 pointer-events-none"
          style={{
            top: "160px",
            left: "-20px",
            width: "120px",
            height: "120px",
            background: "linear-gradient(135deg, #7c3aed, #a855f7)",
            clipPath: "polygon(0 0, 100% 0, 0 100%)",
            opacity: 0.9,
          }}
        />
        <div
          className="absolute -z-10 pointer-events-none"
          style={{
            top: "380px",
            left: "40px",
            width: "130px",
            height: "130px",
            background: "linear-gradient(135deg, #f97316, #fb923c)",
            clipPath: "polygon(0 100%, 100% 100%, 0 0)",
            opacity: 0.9,
          }}
        />
        <div
          className="absolute -z-10 pointer-events-none"
          style={{
            top: "340px",
            right: "60px",
            width: "110px",
            height: "110px",
            background: "linear-gradient(135deg, #7c3aed, #a855f7)",
            clipPath: "polygon(100% 0, 100% 100%, 0 100%)",
            opacity: 0.9,
          }}
        />
        <div
          className="absolute -z-10 pointer-events-none"
          style={{
            top: "480px",
            left: "260px",
            width: "140px",
            height: "140px",
            background: "#a3e635",
            clipPath: "polygon(0 0, 100% 0, 0 100%)",
            opacity: 0.9,
          }}
        />
      </div>
      </div>
    </div>
  );
};

export default NotificationsSection;
