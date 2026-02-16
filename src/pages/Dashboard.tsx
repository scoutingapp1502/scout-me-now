import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import PersonalProfile from "@/components/dashboard/PersonalProfile";
import PlaceholderSection from "@/components/dashboard/PlaceholderSection";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [activeSection, setActiveSection] = useState("profile");
  const [playerName, setPlayerName] = useState("");

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) navigate("/auth?tab=login");
      else setUser(session.user);
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) navigate("/auth?tab=login");
      else setUser(session.user);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("player_profiles")
      .select("first_name, last_name")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setPlayerName(`${data.first_name} ${data.last_name}`.trim());
      });
  }, [user]);

  if (!user) return null;

  const renderSection = () => {
    switch (activeSection) {
      case "profile": return <PersonalProfile userId={user.id} />;
      case "players": return <PlaceholderSection title="PLAYERS" />;
      case "stats": return <PlaceholderSection title="STATS" />;
      case "scouters": return <PlaceholderSection title="SCOUTERS" />;
      case "agents": return <PlaceholderSection title="AGENTS" />;
      case "clubs": return <PlaceholderSection title="CLUBS" />;
      default: return <PersonalProfile userId={user.id} />;
    }
  };

  return (
    <div className="flex min-h-screen bg-background dark">
      <DashboardSidebar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        playerName={playerName}
      />
      <main className="flex-1 p-8 overflow-y-auto">
        {renderSection()}
      </main>
    </div>
  );
};

export default Dashboard;
