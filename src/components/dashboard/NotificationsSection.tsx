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
  follower_name: string;
  follower_photo: string | null;
  follower_role: "player" | "scout" | "agent";
  isRead: boolean;
}

interface CollabNotification {
  id: string;
  type: "collab_request";
  other_user_id: string;
  created_at: string;
  other_name: string;
  other_photo: string | null;
  status: string;
  perspective: "agent" | "player"; // agent = received request, player = sent request
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
    const { data: follows } = await supabase
      .from("follows")
      .select("id, follower_id, created_at")
      .eq("following_id", user.id)
      .order("created_at", { ascending: false });

    let followNotifs: FollowNotification[] = [];

    if (follows && follows.length > 0) {
      const followerIds = follows.map(f => f.follower_id);

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

      followNotifs = follows.map(f => {
        const role = (roleMap[f.follower_id] || "player") as "player" | "scout" | "agent";
        const info = role === "player" ? playerMap[f.follower_id] : scoutMap[f.follower_id];
        return {
          id: f.id,
          type: "follow" as const,
          follower_id: f.follower_id,
          created_at: f.created_at,
          follower_name: info?.name || (lang === "ro" ? "Utilizator necunoscut" : "Unknown user"),
          follower_photo: info?.photo || null,
          follower_role: role,
          isRead: isNotificationRead(user.id, f.id),
        };
      });
    }

    // Fetch collaboration requests
    let collabNotifs: CollabNotification[] = [];

    // For agents: requests received
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

        collabNotifs.push(...collabRequests.map(r => ({
          id: r.id,
          type: "collab_request" as const,
          other_user_id: r.player_user_id,
          created_at: r.created_at,
          other_name: pMap[r.player_user_id]?.name || (lang === "ro" ? "Jucător necunoscut" : "Unknown player"),
          other_photo: pMap[r.player_user_id]?.photo || null,
          status: r.status,
          perspective: "agent" as const,
          isRead: r.status !== "pending" || isNotificationRead(user.id, r.id),
        })));
      }
    }

    // For players: requests sent (show status updates)
    if (userRole === "player") {
      const { data: sentRequests } = await supabase
        .from("agent_collaboration_requests")
        .select("*")
        .eq("player_user_id", user.id)
        .order("created_at", { ascending: false });

      if (sentRequests && sentRequests.length > 0) {
        const agentIds = sentRequests.map(r => r.agent_user_id);
        const { data: agents } = await supabase
          .from("scout_profiles")
          .select("user_id, first_name, last_name, photo_url")
          .in("user_id", agentIds);

        const aMap: Record<string, { name: string; photo: string | null }> = {};
        agents?.forEach(a => {
          aMap[a.user_id] = { name: `${a.first_name} ${a.last_name}`.trim(), photo: a.photo_url };
        });

        collabNotifs.push(...sentRequests.map(r => ({
          id: r.id,
          type: "collab_request" as const,
          other_user_id: r.agent_user_id,
          created_at: r.updated_at || r.created_at,
          other_name: aMap[r.agent_user_id]?.name || (lang === "ro" ? "Agent necunoscut" : "Unknown agent"),
          other_photo: aMap[r.agent_user_id]?.photo || null,
          status: r.status,
          perspective: "player" as const,
          isRead: r.status === "pending" || isNotificationRead(user.id, r.id),
        })));
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
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "follows" }, () => {
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

  const handleClickCollabNotification = (n: CollabNotification) => {
    handleMarkOneRead(n.id);
    setViewProfileUserId(n.other_user_id);
    setViewProfileRole(n.perspective === "agent" ? "player" : "agent");
  };

  const handleAcceptCollab = async (n: CollabNotification) => {
    try {
      // Update the request status
      const { error } = await supabase
        .from("agent_collaboration_requests")
        .update({ status: "accepted" })
        .eq("id", n.id);
      if (error) throw error;

      // Get agent's info to fill in the player's profile
      if (!currentUserId) return;
      const { data: agentProfile } = await supabase
        .from("scout_profiles")
        .select("first_name, last_name")
        .eq("user_id", currentUserId)
        .maybeSingle();

      const { data: { user } } = await supabase.auth.getUser();
      const agentEmail = user?.email || "";
      const agentName = agentProfile ? `${agentProfile.first_name} ${agentProfile.last_name}`.trim() : "";

      // Update the player's profile with agent info
      await supabase
        .from("player_profiles")
        .update({
          agent_name: agentName,
          agent_email: agentEmail,
        })
        .eq("user_id", n.other_user_id);

      handleMarkOneRead(n.id);
      toast({
        title: lang === "ro" ? "Colaborare acceptată!" : "Collaboration accepted!",
        description: lang === "ro"
          ? `Datele tale de contact au fost adăugate pe profilul lui ${n.player_name}`
          : `Your contact info has been added to ${n.player_name}'s profile`,
      });
      fetchNotifications();
    } catch (err) {
      console.error(err);
      toast({ title: lang === "ro" ? "Eroare" : "Error", variant: "destructive" });
    }
  };

  const handleRejectCollab = async (n: CollabNotification) => {
    try {
      const { error } = await supabase
        .from("agent_collaboration_requests")
        .update({ status: "rejected" })
        .eq("id", n.id);
      if (error) throw error;

      handleMarkOneRead(n.id);
      toast({ title: lang === "ro" ? "Cerere respinsă" : "Request rejected" });
      fetchNotifications();
    } catch (err) {
      console.error(err);
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
                        {lang === "ro" ? "a început să te urmărească" : "started following you"}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {roleLabel(fn.follower_role)} · {timeAgo(fn.created_at)}
                    </p>
                  </div>
                  <UserPlus className={`h-4 w-4 shrink-0 ${fn.isRead ? "text-primary/50" : "text-primary"}`} />
                </button>
              );
            }

            if (n.type === "collab_request") {
              const cn = n as CollabNotification;
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
                    {cn.player_photo ? <AvatarImage src={cn.player_photo} /> : null}
                    <AvatarFallback className="bg-primary/20 text-primary text-sm">
                      {cn.player_name.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 cursor-pointer" onClick={() => handleClickCollabNotification(cn)}>
                    <p className={`text-sm ${cn.isRead ? "text-foreground" : "text-foreground font-semibold"}`}>
                      <span className="font-semibold">{cn.player_name}</span>{" "}
                      <span className={cn.isRead ? "text-muted-foreground" : "text-foreground/80"}>
                        {cn.status === "pending"
                          ? (lang === "ro" ? "vrea să colaboreze cu tine" : "wants to collaborate with you")
                          : cn.status === "accepted"
                            ? (lang === "ro" ? "– colaborare acceptată" : "– collaboration accepted")
                            : (lang === "ro" ? "– cerere respinsă" : "– request rejected")}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {lang === "ro" ? "Jucător" : "Player"} · {timeAgo(cn.created_at)}
                    </p>
                  </div>
                  {cn.status === "pending" ? (
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
                    <Handshake className={`h-4 w-4 shrink-0 ${cn.status === "accepted" ? "text-green-500" : "text-muted-foreground"}`} />
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
