import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { UserPlus, ArrowLeft, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import PersonalProfile from "./PersonalProfile";
import ScoutPersonalProfile from "./ScoutPersonalProfile";
import { markNotificationRead, markAllNotificationsRead, isNotificationRead } from "@/hooks/useNotificationCount";

interface FollowNotification {
  id: string;
  follower_id: string;
  created_at: string;
  follower_name: string;
  follower_photo: string | null;
  follower_role: "player" | "scout" | "agent";
  isRead: boolean;
}

const NotificationsSection = ({ onNavigateToChat }: { onNavigateToChat?: (userId: string) => void }) => {
  const { lang } = useLanguage();
  const [notifications, setNotifications] = useState<FollowNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [viewProfileUserId, setViewProfileUserId] = useState<string | null>(null);
  const [viewProfileRole, setViewProfileRole] = useState<"player" | "scout" | "agent" | null>(null);

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setCurrentUserId(user.id);

    const { data: follows } = await supabase
      .from("follows")
      .select("id, follower_id, created_at")
      .eq("following_id", user.id)
      .order("created_at", { ascending: false });

    if (!follows || follows.length === 0) {
      setNotifications([]);
      setLoading(false);
      return;
    }

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

    const mapped: FollowNotification[] = follows.map(f => {
      const role = (roleMap[f.follower_id] || "player") as "player" | "scout" | "agent";
      const info = role === "player" ? playerMap[f.follower_id] : scoutMap[f.follower_id];
      return {
        id: f.id,
        follower_id: f.follower_id,
        created_at: f.created_at,
        follower_name: info?.name || (lang === "ro" ? "Utilizator necunoscut" : "Unknown user"),
        follower_photo: info?.photo || null,
        follower_role: role,
        isRead: isNotificationRead(user.id, f.id),
      };
    });

    setNotifications(mapped);
    setLoading(false);
  };

  useEffect(() => {
    fetchNotifications();

    const channel = supabase
      .channel("notifications-follows")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "follows" }, () => {
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

  const handleClickNotification = (n: FollowNotification) => {
    handleMarkOneRead(n.id);
    setViewProfileUserId(n.follower_id);
    setViewProfileRole(n.follower_role);
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
          {notifications.map(n => (
            <button
              key={n.id}
              onClick={() => handleClickNotification(n)}
              className={`w-full flex items-center gap-3 p-4 rounded-lg border transition-all text-left ${
                n.isRead
                  ? "bg-card border-border hover:bg-accent/50"
                  : "bg-primary/5 border-primary/30 hover:bg-primary/10"
              }`}
            >
              {/* Unread dot */}
              <div className="shrink-0 w-2.5 flex items-center justify-center">
                {!n.isRead && (
                  <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
                )}
              </div>
              <Avatar className="h-10 w-10">
                {n.follower_photo ? <AvatarImage src={n.follower_photo} /> : null}
                <AvatarFallback className="bg-primary/20 text-primary text-sm">
                  {n.follower_name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${n.isRead ? "text-foreground" : "text-foreground font-semibold"}`}>
                  <span className="font-semibold">{n.follower_name}</span>{" "}
                  <span className={n.isRead ? "text-muted-foreground" : "text-foreground/80"}>
                    {lang === "ro" ? "a început să te urmărească" : "started following you"}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {roleLabel(n.follower_role)} · {timeAgo(n.created_at)}
                </p>
              </div>
              <UserPlus className={`h-4 w-4 shrink-0 ${n.isRead ? "text-primary/50" : "text-primary"}`} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default NotificationsSection;
