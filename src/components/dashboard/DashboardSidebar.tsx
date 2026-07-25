import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, LogOut, MessageCircle, Newspaper, Bell, Sparkles, ClipboardList, Settings } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";
import { useActivityNotifications } from "@/hooks/useActivityNotifications";
import { useNotificationCount } from "@/hooks/useNotificationCount";

interface DashboardSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  playerName?: string;
  playerSport?: string;
  profileLabel?: string;
  userRole?: "player" | "scout" | "agent" | "club_rep" | "cauta_jucator" | null;
  userId?: string | null;
}

const DashboardSidebar = ({ activeSection, onSectionChange, playerName, playerSport, profileLabel, userRole, userId }: DashboardSidebarProps) => {
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const [unreadCount, setUnreadCount] = useState(0);
  const { count: activityCount } = useActivityNotifications(userId ?? null);
  const notifCount = useNotificationCount(userId ?? null);

  useEffect(() => {
    let cancelled = false;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const fetchUnread = async (uid: string) => {
      // Get all conversation IDs for this user
      const { data: convs } = await supabase
        .from("conversations")
        .select("id")
        .or(`user1_id.eq.${uid},user2_id.eq.${uid}`);

      if (cancelled) return;
      if (!convs || convs.length === 0) { setUnreadCount(0); return; }

      const convIds = convs.map(c => c.id);

      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("conversation_id", convIds)
        .eq("read", false)
        .neq("sender_id", uid);

      if (!cancelled) setUnreadCount(count || 0);
    };

    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return;
      fetchUnread(user.id);

      // Realtime: listen for new messages. There's no recipient column on
      // messages to filter by precisely (only sender_id + conversation_id),
      // so we scope out our own sends and debounce bursts of unrelated
      // messages between other users instead of refetching on every event.
      channel = supabase
        .channel(`sidebar-unread-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "messages", filter: `sender_id=neq.${user.id}` },
          () => {
            if (debounceTimer) clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => fetchUnread(user.id), 500);
          }
        )
        .subscribe();
    }).catch((err) => console.error("Failed to get current user:", err));

    return () => {
      cancelled = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  // Reset unread when viewing messages
  useEffect(() => {
    if (activeSection === "messages") {
      // Small delay to let messages be marked as read
      const timer = setTimeout(() => {
        const refetch = async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;
          const { data: convs } = await supabase
            .from("conversations")
            .select("id")
            .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);
          if (!convs || convs.length === 0) { setUnreadCount(0); return; }
          const { count } = await supabase
            .from("messages")
            .select("*", { count: "exact", head: true })
            .in("conversation_id", convs.map(c => c.id))
            .eq("read", false)
            .neq("sender_id", user.id);
          setUnreadCount(count || 0);
        };
        refetch();
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [activeSection]);

  const showPlayerNotes = userRole === "scout" || userRole === "club_rep" || userRole === "cauta_jucator";
  const mySpaceSections = [
    { id: "profile", label: profileLabel || t.dashboard.sidebar.personalProfile, icon: User },
    { id: "messages", label: (t as any).dashboard?.sidebar?.messages ?? "Messages", icon: MessageCircle },
    { id: "notifications", label: (t as any).dashboard?.sidebar?.notifications ?? "Notifications", icon: Bell },
    { id: "activity", label: (t as any).dashboard?.sidebar?.activity ?? "Activity", icon: Newspaper },
    ...(showPlayerNotes ? [{ id: "player-notes", label: (t as any).dashboard?.sidebar?.scoutActions ?? "Actions", icon: ClipboardList }] : []),
  ];
  const discoverSections = [
    { id: "community", label: (t as any).dashboard?.sidebar?.community ?? "Community", icon: Sparkles },
  ];
  const sections = [...mySpaceSections, ...discoverSections];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <aside className="w-64 min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="p-6 border-b border-sidebar-border">
        <span className="font-display text-2xl text-primary">{(userRole === "scout" || userRole === "agent" || userRole === "club_rep" || userRole === "cauta_jucator") ? "" : "⚽ "}SPORTRISE</span>
        {playerName && (
          <p className="text-sm text-sidebar-foreground/60 font-body mt-1 truncate">
            {playerName}{userRole === "player" && playerSport ? ` · ${playerSport.charAt(0).toUpperCase() + playerSport.slice(1)}` : ""}
          </p>
        )}
        {userRole === "scout" && (
          <p className="text-xs text-primary/80 font-semibold font-body mt-0.5 tracking-wider">SCOUTER</p>
        )}
        {userRole === "agent" && (
          <p className="text-xs text-primary/80 font-semibold font-body mt-0.5 tracking-wider">AGENT</p>
        )}
        {userRole === "club_rep" && (
          <p className="text-xs text-primary/80 font-semibold font-body mt-0.5 tracking-wider">CLUB REPRESENTATIVE</p>
        )}
        {userRole === "cauta_jucator" && (
          <p className="text-xs text-primary/80 font-semibold font-body mt-0.5 tracking-wider">CAUTĂ JUCĂTOR</p>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-4 overflow-y-auto">
        {[
          { label: (t as any).dashboard?.sidebar?.mySpace ?? "MY SPACE", items: mySpaceSections },
          { label: (t as any).dashboard?.sidebar?.discover ?? "DISCOVER", items: discoverSections },
        ].map((group) => (
          <div key={group.label} className="space-y-1">
            <p className="px-4 text-[10px] font-body font-semibold text-sidebar-foreground/40 uppercase tracking-wider">
              {group.label}
            </p>
            {group.items.map((section) => {
              const Icon = section.icon;
              const isActive = activeSection === section.id;
              const showBadge = (section.id === "messages" && unreadCount > 0 && !isActive) ||
                (section.id === "activity" && activityCount > 0 && !isActive) ||
                (section.id === "notifications" && notifCount > 0 && !isActive);
              const badgeCount = section.id === "messages" ? unreadCount : section.id === "notifications" ? notifCount : activityCount;
              return (
                <button
                  key={section.id}
                  onClick={() => onSectionChange(section.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-body text-sm transition-all relative ${
                    isActive
                      ? "bg-primary text-primary-foreground shadow-lg"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  {section.label}
                  {showBadge && (
                    <span className="ml-auto w-5 h-5 rounded-full bg-destructive flex items-center justify-center shrink-0">
                      <span className="text-[10px] text-white font-bold">{badgeCount > 99 ? "99+" : badgeCount}</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-2">
        <div className="flex justify-center">
          <LanguageToggle />
        </div>
        <button
          onClick={() => onSectionChange("settings")}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-body text-sm transition-all ${
            activeSection === "settings"
              ? "bg-primary text-primary-foreground shadow-lg"
              : "text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          }`}
        >
          <Settings className="h-5 w-5" />
          {(t as any).dashboard?.sidebar?.settings ?? "Settings"}
        </button>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground/60 hover:text-destructive hover:bg-sidebar-accent font-body text-sm transition-all"
        >
          <LogOut className="h-5 w-5" />
          {t.dashboard.sidebar.logout}
        </button>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
