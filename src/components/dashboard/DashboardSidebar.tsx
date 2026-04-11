import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Users, Search, Briefcase, Building2, LogOut, MessageCircle } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";

interface DashboardSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  playerName?: string;
  playerSport?: string;
  profileLabel?: string;
  userRole?: "player" | "scout" | "agent" | null;
}

const DashboardSidebar = ({ activeSection, onSectionChange, playerName, playerSport, profileLabel, userRole }: DashboardSidebarProps) => {
  const navigate = useNavigate();
  const { t, lang } = useLanguage();

  const sections = [
    { id: "profile", label: profileLabel || t.dashboard.sidebar.personalProfile, icon: User },
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
          return (
            <button
              key={section.id}
              onClick={() => onSectionChange(section.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-body text-sm transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-lg"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              {section.label}
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
