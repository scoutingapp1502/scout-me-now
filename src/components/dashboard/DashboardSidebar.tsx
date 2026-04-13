import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Users, Search, Briefcase, Building2, LogOut, MessageCircle, Newspaper } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";
import { useActivityNotifications } from "@/hooks/useActivityNotifications";

interface DashboardSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  playerName?: string;
  playerSport?: string;
  profileLabel?: string;
  userRole?: "player" | "scout" | "agent" | null;
  userId?: string | null;
}

const DashboardSidebar = ({ activeSection, onSectionChange, playerName, playerSport, profileLabel, userRole, userId }: DashboardSidebarProps) => {
  const navigate = useNavigate();
  const { t, lang } = useLanguage();
  const [unreadCount, setUnreadCount] = useState(0);
  const { count: activityCount } = useActivityNotifications(userId ?? null);

  useEffect(() => {
    let userId: string | null = null;

    const fetchUnread = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      userId = user.id;

      // Get all conversation IDs for this user
      const { data: convs } = await supabase
        .from("conversations")
        .select("id")
        .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`);

      if (!convs || convs.length === 0) { setUnreadCount(0); return; }

      const convIds = convs.map(c => c.id);

      const { count } = await supabase
        .from("messages")
        .select("*", { count: "exact", head: true })
        .in("conversation_id", convIds)
        .eq("read", false)
        .neq("sender_id", user.id);

      setUnreadCount(count || 0);
    };

    fetchUnread();

    // Realtime: listen for new messages
    const channel = supabase
      .channel("sidebar-unread")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "messages" },
        () => { fetchUnread(); }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
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

  const sections = [
    { id: "profile", label: profileLabel || t.dashboard.sidebar.personalProfile, icon: User },
    { id: "activity", label: lang === "ro" ? "Activitate" : "Activity", icon: Newspaper },
    { id: "messages", label: lang === "ro" ? "Mesaje" : "Messages", icon: MessageCircle },
    { id: "players", label: t.dashboard.sidebar.players, icon: Users },
    { id: "scouters", label: t.dashboard.sidebar.scouters, icon: Search },
    { id: "agents", label: t.dashboard.sidebar.agents, icon: Briefcase },
    { id: "clubs", label: t.dashboard.sidebar.clubs, icon: Building2 },
  ];

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <aside className="w-64 min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="p-6 border-b border-sidebar-border">
        <span className="font-display text-2xl text-primary">{(userRole === "scout" || userRole === "agent") ? "" : "⚽ "}SPORTRISE</span>
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
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {sections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          const showBadge = section.id === "messages" && unreadCount > 0 && !isActive;
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
                  <span className="text-[10px] text-white font-bold">{unreadCount > 99 ? "99+" : unreadCount}</span>
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-2">
        <div className="flex justify-center">
          <LanguageToggle />
        </div>
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
