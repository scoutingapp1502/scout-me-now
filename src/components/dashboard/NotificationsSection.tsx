import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { UserPlus, ArrowLeft, CheckCheck, Handshake, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import PersonalProfile from "./PersonalProfile";
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
  follower_role: "player" | "scout" | "agent";
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

type Notification = FollowNotification | CollabNotification;

const NotificationsSection = ({ onNavigateToChat }: { onNavigateToChat?: (userId: string) => void }) => {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [viewProfileUserId, setViewProfileUserId] = useState<string | null>(null);
  const [viewProfileRole, setViewProfileRole] = useState<"player" | "scout" | "agent" | null>(null);

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    // Get user role
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();
    const userRole = roleData?.role || "player";
    setCurrentUserRole(userRole);

    // Fetch follow notifications
    const [incomingFollowsRes, outgoingRespondedFollowsRes] = await Promise.all([
      supabase
        .from("follows")
        .select("id, follower_id, created_at, responded_at, status")
        .eq("following_id", user.id)
        .in("status", ["pending", "accepted", "rejected"])
        .order("responded_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
      supabase
        .from("follows")
        .select("id, following_id, created_at, responded_at, status")
        .eq("follower_id", user.id)
        .in("status", ["accepted", "rejected"])
        .order("responded_at", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false }),
    ]);

    const follows = incomingFollowsRes.data;
    const respondedSentFollows = outgoingRespondedFollowsRes.data;

    let followNotifs: FollowNotification[] = [];

    const profileIds = new Set<string>();
    follows?.forEach(f => profileIds.add(f.follower_id));
    respondedSentFollows?.forEach(f => profileIds.add(f.following_id));

    if (profileIds.size > 0) {
      const followerIds = [...profileIds];

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", followerIds);

      const roleMap: Record<string, string> = {};
      roles?.forEach(r => { roleMap[r.user_id] = r.role; });

      const playerIds = followerIds.filter(id => roleMap[id] === "player");
      const scoutIds = followerIds.filter(id => roleMap[id] === "scout" || roleMap[id] === "agent");

      let playerMap: Record<string, { name: string; photo: string | null }> = {};
      let scoutMap: Record<string, { name: string; photo: string | null }> = {};

      if (playerIds.length > 0) {
        const { data: players } = await supabase
          .from("player_profiles")
          .select("user_id, first_name, last_name, photo_url")
          .in("user_id", playerIds);
        players?.forEach(p => {
          playerMap[p.user_id] = { name: `${p.first_name} ${p.last_name}`.trim(), photo: p.photo_url };
        });
      }

      if (scoutIds.length > 0) {
        const { data: scouts } = await supabase
          .from("scout_profiles")
          .select("user_id, first_name, last_name, photo_url")
          .in("user_id", scoutIds);
        scouts?.forEach(s => {
          scoutMap[s.user_id] = { name: `${s.first_name} ${s.last_name}`.trim(), photo: s.photo_url };
        });
      }

      followNotifs = [
        ...(follows || []).map(f => {
          const role = (roleMap[f.follower_id] || "player") as "player" | "scout" | "agent";
          const info = role === "player" ? playerMap[f.follower_id] : scoutMap[f.follower_id];
          return {
            id: f.id,
            type: "follow" as const,
            follower_id: f.follower_id,
            created_at: f.responded_at || f.created_at,
            responded_at: f.responded_at,
            status: f.status as "pending" | "accepted" | "rejected",
            follower_name: info?.name || (lang === "ro" ? "Utilizator necunoscut" : "Unknown user"),
            follower_photo: info?.photo || null,
            follower_role: role,
            isRead: isNotificationRead(user.id, f.id),
            direction: "incoming" as const,
          };
        }),
        ...(respondedSentFollows || []).map(f => {
          const role = (roleMap[f.following_id] || "player") as "player" | "scout" | "agent";
          const info = role === "player" ? playerMap[f.following_id] : scoutMap[f.following_id];
          return {
            id: `${f.id}-response`,
            type: "follow" as const,
            follower_id: f.following_id,
            created_at: f.responded_at || f.created_at,
            responded_at: f.responded_at,
            status: f.status as "accepted" | "rejected",
            follower_name: info?.name || (lang === "ro" ? "Utilizator necunoscut" : "Unknown user"),
            follower_photo: info?.photo || null,
            follower_role: role,
            isRead: isNotificationRead(user.id, `${f.id}-response`),
            direction: "outgoing" as const,
          };
        }),
      ];
    }

    // Fetch collaboration requests
    let collabNotifs: CollabNotification[] = [];

    // For agents: all collaboration requests involving them
    if (userRole === "agent" || userRole === "scout") {
      const { data: collabRequests } = await supabase
        .from("agent_collaboration_requests")
        .select("*")
        .eq("agent_user_id", user.id)
        .order("created_at", { ascending: false });

      if (collabRequests && collabRequests.length > 0) {
        const pIds = collabRequests.map(r => r.player_user_id);
        const { data: players } = await supabase
          .from("player_profiles")
          .select("user_id, first_name, last_name, photo_url")
          .in("user_id", pIds);

        const pMap: Record<string, { name: string; photo: string | null }> = {};
        players?.forEach(p => {
          pMap[p.user_id] = { name: `${p.first_name} ${p.last_name}`.trim(), photo: p.photo_url };
        });

        collabRequests.forEach(r => {
          const initiatedBy = (r as any).initiated_by || "player";
          const playerName = pMap[r.player_user_id]?.name || (lang === "ro" ? "Jucător necunoscut" : "Unknown player");
          const playerPhoto = pMap[r.player_user_id]?.photo || null;

          if (initiatedBy === "agent") {
            // Agent sent this - show as confirmation
            collabNotifs.push({
              id: `${r.id}-sent`,
              type: "collab_request",
              other_user_id: r.player_user_id,
              created_at: r.created_at,
              other_name: playerName,
              other_photo: playerPhoto,
              status: "sent",
              perspective: "agent",
              initiated_by: "agent",
              isRead: true,
            });
            if (r.status === "accepted" || r.status === "rejected") {
              collabNotifs.push({
                id: `${r.id}-response`,
                type: "collab_request",
                other_user_id: r.player_user_id,
                created_at: r.updated_at || r.created_at,
                other_name: playerName,
                other_photo: playerPhoto,
                status: r.status,
                perspective: "agent",
                initiated_by: "agent",
                isRead: isNotificationRead(user.id, `${r.id}-response`),
              });
            }
          } else {
            // Player sent this - agent can accept/reject
            collabNotifs.push({
              id: r.id,
              type: "collab_request",
              other_user_id: r.player_user_id,
              created_at: r.created_at,
              other_name: playerName,
              other_photo: playerPhoto,
              status: r.status,
              perspective: "agent",
              initiated_by: "player",
              isRead: r.status !== "pending" || isNotificationRead(user.id, r.id),
            });
          }
        });
      }
    }

    // For players: all collaboration requests involving them
    if (userRole === "player") {
      const { data: playerRequests } = await supabase
        .from("agent_collaboration_requests")
        .select("*")
        .eq("player_user_id", user.id)
        .order("created_at", { ascending: false });

      if (playerRequests && playerRequests.length > 0) {
        const agentIds = playerRequests.map(r => r.agent_user_id);
        const { data: agents } = await supabase
          .from("scout_profiles")
          .select("user_id, first_name, last_name, photo_url")
          .in("user_id", agentIds);

        const aMap: Record<string, { name: string; photo: string | null }> = {};
        agents?.forEach(a => {
          aMap[a.user_id] = { name: `${a.first_name} ${a.last_name}`.trim(), photo: a.photo_url };
        });

        playerRequests.forEach(r => {
          const initiatedBy = (r as any).initiated_by || "player";
          const agentName = aMap[r.agent_user_id]?.name || (lang === "ro" ? "Agent necunoscut" : "Unknown agent");
          const agentPhoto = aMap[r.agent_user_id]?.photo || null;

          if (initiatedBy === "agent") {
            // Agent initiated - player can accept/reject
            collabNotifs.push({
              id: r.id,
              type: "collab_request",
              other_user_id: r.agent_user_id,
              created_at: r.created_at,
              other_name: agentName,
              other_photo: agentPhoto,
              status: r.status,
              perspective: "player",
              initiated_by: "agent",
              isRead: r.status !== "pending" || isNotificationRead(user.id, r.id),
            });
          } else {
            // Player initiated - show confirmation and response
            collabNotifs.push({
              id: `${r.id}-sent`,
              type: "collab_request",
              other_user_id: r.agent_user_id,
              created_at: r.created_at,
              other_name: agentName,
              other_photo: agentPhoto,
              status: "sent",
              perspective: "player",
              initiated_by: "player",
              isRead: true,
            });
            if (r.status === "accepted" || r.status === "rejected") {
              collabNotifs.push({
                id: `${r.id}-response`,
                type: "collab_request",
                other_user_id: r.agent_user_id,
                created_at: r.updated_at || r.created_at,
                other_name: agentName,
                other_photo: agentPhoto,
                status: r.status,
                perspective: "player",
                initiated_by: "player",
                isRead: isNotificationRead(user.id, `${r.id}-response`),
              });
            }
          }
        });
      }
    }

    // Merge and sort by date
    const allNotifs: Notification[] = [...followNotifs, ...collabNotifs]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    setNotifications(allNotifs);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel("notifications-all")
      .on("postgres_changes", { event: "*", schema: "public", table: "follows" }, () => {
        fetchNotifications();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_collaboration_requests" }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

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
    setViewProfileRole(n.perspective === "agent" ? "player" : "agent");
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
    if (role === "scout") return "Scouter";
    return "Agent";
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  if (viewProfileUserId && viewProfileRole) {
    return (
      <div>
        <Button
          variant="ghost"
          size="sm"
          className="mb-4 gap-2"
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
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-display text-foreground">
          {lang === "ro" ? "Notificări" : "Notifications"}
        </h2>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead} className="gap-2 font-body">
            <CheckCheck className="h-4 w-4" />
            {lang === "ro" ? "Marchează toate ca citite" : "Mark all as read"}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="text-muted-foreground text-center py-12">
          {lang === "ro" ? "Se încarcă..." : "Loading..."}
        </div>
      ) : notifications.length === 0 ? (
        <div className="text-muted-foreground text-center py-12">
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
                  if (fn.status === "accepted") return lang === "ro" ? "ai acceptat cererea de urmărire ✅" : "you accepted the follow request ✅";
                  return lang === "ro" ? "ai refuzat cererea de urmărire" : "you rejected the follow request";
                }

                if (fn.status === "accepted") return lang === "ro" ? "ți-a acceptat cererea de urmărire ✅" : "accepted your follow request ✅";
                return lang === "ro" ? "ți-a refuzat cererea de urmărire" : "rejected your follow request";
              };

              return (
                <button
                  key={fn.id}
                  onClick={() => handleClickFollowNotification(fn)}
                  className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-all text-left ${
                    fn.isRead
                      ? "bg-card border-border hover:bg-accent/50"
                      : "bg-primary/5 border-primary/30 hover:bg-primary/10"
                  }`}
                >
                  <div className="shrink-0 w-2.5 flex items-center justify-center">
                    {!fn.isRead && (
                      <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                    )}
                  </div>
                  <Avatar className="h-10 w-10">
                    {fn.follower_photo ? <AvatarImage src={fn.follower_photo} /> : null}
                    <AvatarFallback className="bg-primary/20 text-primary text-sm">
                      {fn.follower_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm ${fn.isRead ? "text-foreground" : "text-foreground font-semibold"}`}>
                      <span className="font-semibold">{fn.follower_name}</span>{" "}
                      <span className={fn.isRead ? "text-muted-foreground" : "text-foreground/80"}>
                        {followMessage()}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
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
                    <UserPlus className={`h-4 w-4 shrink-0 ${fn.status === "accepted" ? "text-green-500" : fn.isRead ? "text-primary/50" : "text-primary"}`} />
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
                if (cn.status === "accepted") return lang === "ro" ? "– colaborare acceptată ✅" : "– collaboration accepted ✅";
                return lang === "ro" ? "– cerere respinsă" : "– request rejected";
              };

              const roleText = cn.perspective === "agent"
                ? (lang === "ro" ? "Jucător" : "Player")
                : "Agent";

              return (
                <div
                  key={cn.id}
                  className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-all ${
                    cn.isRead
                      ? "bg-card border-border"
                      : "bg-primary/5 border-primary/30"
                  }`}
                >
                  <div className="shrink-0 w-2.5 flex items-center justify-center">
                    {!cn.isRead && (
                      <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                    )}
                  </div>
                  <Avatar className="h-10 w-10 cursor-pointer" onClick={() => handleClickCollabNotification(cn)}>
                    {cn.other_photo ? <AvatarImage src={cn.other_photo} /> : null}
                    <AvatarFallback className="bg-primary/20 text-primary text-sm">
                      {cn.other_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleClickCollabNotification(cn)}>
                    <p className={`text-sm ${cn.isRead ? "text-foreground" : "text-foreground font-semibold"}`}>
                      <span className="font-semibold">{cn.other_name}</span>{" "}
                      <span className={cn.isRead ? "text-muted-foreground" : "text-foreground/80"}>
                        {collabMessage()}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
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
                    <Handshake className={`h-4 w-4 shrink-0 ${cn.status === "accepted" ? "text-green-500" : cn.status === "pending" ? "text-yellow-500" : "text-muted-foreground"}`} />
                  )}
                </div>
              );
            }

            return null;
          })}
        </div>
      )}
    </div>
  );
};

export default NotificationsSection;
