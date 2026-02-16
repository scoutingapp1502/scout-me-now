import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Users, BarChart3, Search, Briefcase, Building2, LogOut } from "lucide-react";

interface DashboardSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  playerName?: string;
}

const sections = [
  { id: "profile", label: "Personal Profile", icon: User },
  { id: "players", label: "Players", icon: Users },
  { id: "stats", label: "Stats", icon: BarChart3 },
  { id: "scouters", label: "Scouters", icon: Search },
  { id: "agents", label: "Agents", icon: Briefcase },
  { id: "clubs", label: "Clubs", icon: Building2 },
];

const DashboardSidebar = ({ activeSection, onSectionChange, playerName }: DashboardSidebarProps) => {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <aside className="w-64 min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
      <div className="p-6 border-b border-sidebar-border">
        <span className="font-display text-2xl text-primary">⚽ FOOTBALLSCOUT</span>
        {playerName && (
          <p className="text-sm text-sidebar-foreground/60 font-body mt-1 truncate">{playerName}</p>
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

      <div className="p-4 border-t border-sidebar-border">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sidebar-foreground/60 hover:text-destructive hover:bg-sidebar-accent font-body text-sm transition-all"
        >
          <LogOut className="h-5 w-5" />
          Deconectare
        </button>
      </div>
    </aside>
  );
};

export default DashboardSidebar;
