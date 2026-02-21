import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import PersonalProfile from "@/components/dashboard/PersonalProfile";
import ScoutPersonalProfile from "@/components/dashboard/ScoutPersonalProfile";
import PlaceholderSection from "@/components/dashboard/PlaceholderSection";
import PlayersSection from "@/components/dashboard/PlayersSection";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Menu, Loader2 } from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [activeSection, setActiveSection] = useState("profile");
  const [playerName, setPlayerName] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState<"player" | "scout" | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const isMobile = useIsMobile();

  useEffect(() => {
    let isMounted = true;

    const fetchRole = async (userId: string) => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();
      if (isMounted && data) {
        setUserRole(data.role as "player" | "scout");
      }
      if (isMounted) setRoleLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth?tab=login");
      } else {
        setUser(session.user);
        fetchRole(session.user.id);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth?tab=login");
      } else {
        setUser(session.user);
        fetchRole(session.user.id);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  // Fetch display name based on role
  useEffect(() => {
    if (!user || !userRole) return;
    const table = userRole === "scout" ? "scout_profiles" : "player_profiles";
    supabase
      .from(table)
      .select("first_name, last_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPlayerName(`${data.first_name} ${data.last_name}`.trim());
      });
  }, [user, userRole]);

  if (!user || roleLoading) {
    return (
      <div className="flex min-h-screen bg-background dark items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSectionChange = (section: string) => {
    setActiveSection(section);
    if (isMobile) setSidebarOpen(false);
  };

  const renderSection = () => {
    switch (activeSection) {
      case "profile":
        return userRole === "scout"
          ? <ScoutPersonalProfile userId={user.id} />
          : <PersonalProfile userId={user.id} />;
      case "players": return <PlayersSection />;
      case "scouters": return <PlaceholderSection title="SCOUTERS" />;
      case "agents": return <PlaceholderSection title="AGENTS" />;
      case "clubs": return <PlaceholderSection title="CLUBS" />;
      default:
        return userRole === "scout"
          ? <ScoutPersonalProfile userId={user.id} />
          : <PersonalProfile userId={user.id} />;
    }
  };

  const sidebarFirstLabel = userRole === "scout" ? "Personal Area" : undefined;

  return (
    <div className="flex min-h-screen bg-background dark">
      {isMobile ? (
        <>
          <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
            <SheetContent side="left" className="p-0 w-64 bg-sidebar border-sidebar-border">
              <DashboardSidebar
                activeSection={activeSection}
                onSectionChange={handleSectionChange}
                playerName={playerName}
                profileLabel={sidebarFirstLabel}
              />
            </SheetContent>
          </Sheet>
          <div className="flex-1 flex flex-col">
            <header className="flex items-center gap-3 p-4 border-b border-border">
              <button onClick={() => setSidebarOpen(true)} className="text-foreground">
                <Menu className="h-6 w-6" />
              </button>
              <span className="font-display text-xl text-primary">⚽ FOOTBALLSCOUT</span>
            </header>
            <main className="flex-1 p-4 overflow-y-auto">
              {renderSection()}
            </main>
          </div>
        </>
      ) : (
        <>
          <DashboardSidebar
            activeSection={activeSection}
            onSectionChange={setActiveSection}
            playerName={playerName}
            profileLabel={sidebarFirstLabel}
          />
          <main className="flex-1 p-8 overflow-y-auto">
            {renderSection()}
          </main>
        </>
      )}
    </div>
  );
};

export default Dashboard;
