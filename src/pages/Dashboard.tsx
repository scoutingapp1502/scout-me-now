import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import PersonalProfile from "@/components/dashboard/PersonalProfile";
import ScoutPersonalProfile from "@/components/dashboard/ScoutPersonalProfile";
import PlaceholderSection from "@/components/dashboard/PlaceholderSection";
import ScoutersSection from "@/components/dashboard/ScoutersSection";
import PlayersSection from "@/components/dashboard/PlayersSection";
import ProfileCompletionBar from "@/components/dashboard/ProfileCompletionBar";
import OnboardingWizard from "@/components/dashboard/OnboardingWizard";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
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
  const [showWizard, setShowWizard] = useState(false);
  const isMobile = useIsMobile();
  const { sections, percentage, loading: completionLoading } = useProfileCompletion(user?.id ?? null, userRole);

  useEffect(() => {
    let isMounted = true;

    const ensureRoleAndProfile = async (userId: string, userMeta: any) => {
      // Check if role exists
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .maybeSingle();

      if (roleData) {
        if (isMounted) {
          setUserRole(roleData.role as "player" | "scout");
          setRoleLoading(false);
        }
        return;
      }

      // Role missing — create from user metadata (set during registration)
      const metaRole = userMeta?.role as "player" | "scout" | undefined;
      if (!metaRole) {
        if (isMounted) setRoleLoading(false);
        return;
      }

      // Insert role
      await supabase.from("user_roles").insert({ user_id: userId, role: metaRole });

      // Insert profile if missing
      const fullName = (userMeta?.full_name as string) || "";
      const firstName = fullName.split(" ")[0] || "";
      const lastName = fullName.split(" ").slice(1).join(" ") || "";

      await supabase.from("profiles").upsert(
        { user_id: userId, full_name: fullName },
        { onConflict: "user_id" }
      );

      if (metaRole === "player") {
        await supabase.from("player_profiles").upsert(
          { user_id: userId, first_name: firstName, last_name: lastName },
          { onConflict: "user_id" }
        );
      } else {
        await supabase.from("scout_profiles").upsert(
          { user_id: userId, first_name: firstName, last_name: lastName },
          { onConflict: "user_id" }
        );
      }

      if (isMounted) {
        setUserRole(metaRole);
        setRoleLoading(false);
      }
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate("/auth?tab=login");
      } else {
        setUser(session.user);
        ensureRoleAndProfile(session.user.id, session.user.user_metadata);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate("/auth?tab=login");
      } else {
        setUser(session.user);
        ensureRoleAndProfile(session.user.id, session.user.user_metadata);
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

  // Show wizard for new users (percentage < 100 on first load)
  useEffect(() => {
    if (!completionLoading && percentage < 100 && userRole) {
      const wizardDismissed = sessionStorage.getItem(`wizard-dismissed-${user?.id}`);
      if (!wizardDismissed) {
        setShowWizard(true);
      }
    }
  }, [completionLoading, percentage, userRole, user?.id]);

  const handleWizardDismiss = () => {
    setShowWizard(false);
    if (user?.id) sessionStorage.setItem(`wizard-dismissed-${user.id}`, "true");
  };

  const handleWizardGoToSection = (sectionKey: string) => {
    setActiveSection("profile");
  };

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

  const completionBar = !completionLoading && percentage < 100 ? (
    <ProfileCompletionBar
      percentage={percentage}
      sections={sections}
      onSectionClick={handleWizardGoToSection}
    />
  ) : null;

  const renderSection = () => {
    switch (activeSection) {
      case "profile":
        return (
          <>
            {completionBar}
            {userRole === "scout"
              ? <ScoutPersonalProfile userId={user.id} />
              : <PersonalProfile userId={user.id} />}
          </>
        );
      case "players": return <PlayersSection />;
      case "scouters": return <ScoutersSection />;
      case "agents": return <PlaceholderSection title="AGENTS" />;
      case "clubs": return <PlaceholderSection title="CLUBS" />;
      default:
        return (
          <>
            {completionBar}
            {userRole === "scout"
              ? <ScoutPersonalProfile userId={user.id} />
              : <PersonalProfile userId={user.id} />}
          </>
        );
    }
  };

  const sidebarFirstLabel = userRole === "scout" ? "Personal Area" : undefined;

  return (
    <div className="flex min-h-screen bg-background dark">
      {showWizard && userRole && (
        <OnboardingWizard
          sections={sections}
          percentage={percentage}
          role={userRole}
          onGoToSection={handleWizardGoToSection}
          onDismiss={handleWizardDismiss}
        />
      )}
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
              <span className="font-display text-xl text-primary">⚽ SPORTRISE</span>
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
            {!completionLoading && percentage < 100 && (
              <ProfileCompletionBar
                percentage={percentage}
                sections={sections}
                onSectionClick={handleWizardGoToSection}
              />
            )}
            {renderSection()}
          </main>
        </>
      )}
    </div>
  );
};

export default Dashboard;
