import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import MessagesSection from "@/components/dashboard/MessagesSection";
import ActivitySection from "@/components/dashboard/ActivitySection";
import PersonalProfile from "@/components/dashboard/PersonalProfile";
import ScoutPersonalProfile from "@/components/dashboard/ScoutPersonalProfile";
import PlaceholderSection from "@/components/dashboard/PlaceholderSection";
import NotificationsSection from "@/components/dashboard/NotificationsSection";
import CommunitySection from "@/components/dashboard/CommunitySection";
import PlayerNotesSection from "@/components/dashboard/PlayerNotesSection";
import ProfileCompletionBar from "@/components/dashboard/ProfileCompletionBar";
import OnboardingWizard from "@/components/dashboard/OnboardingWizard";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import { markFollowingSeen, markMineSeen } from "@/hooks/useActivityNotifications";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Menu, Loader2 } from "lucide-react";
import StreakNotificationModal from "@/components/dashboard/StreakNotificationModal";
import { useTestUnlocks } from "@/hooks/useTestUnlocks";
import { getTechnicalTestsBySport, getTestLabelByKey } from "@/components/dashboard/PersonalProfile";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [activeSection, setActiveSection] = useState("profile");
  const [playerName, setPlayerName] = useState("");
  const [playerSport, setPlayerSport] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState<"player" | "scout" | "agent" | "club_rep" | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [pendingChatUserId, setPendingChatUserId] = useState<string | null>(null);
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
          setUserRole(roleData.role as "player" | "scout" | "agent" | "club_rep");
          setRoleLoading(false);
        }
        return;
      }

      // Role missing — create from user metadata (set during registration)
      const metaRole = userMeta?.role as "player" | "scout" | "agent" | "club_rep" | undefined;
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
        // Both scout and agent use scout_profiles
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
    if (userRole === "scout" || userRole === "agent" || userRole === "club_rep") {
      supabase
        .from("scout_profiles")
        .select("first_name, last_name")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) setPlayerName(`${data.first_name} ${data.last_name}`.trim());
        });
    } else {
      supabase
        .from("player_profiles")
        .select("first_name, last_name, sport")
        .eq("user_id", user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setPlayerName(`${data.first_name} ${data.last_name}`.trim());
            if (data.sport) setPlayerSport(data.sport);
          }
        });
    }
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

  const handleNavigateToChat = (targetUserId: string) => {
    setPendingChatUserId(targetUserId);
    setActiveSection("messages");
  };

  // Streak notification (doar pentru jucători)
  const isPlayer = userRole === "player";
  const availableTestKeys = isPlayer
    ? getTechnicalTestsBySport(playerSport).map((t) => t.key)
    : [];
  const streakState = useTestUnlocks(
    user?.id || "",
    user?.id || null,
    availableTestKeys,
    Boolean(isPlayer && user?.id),
  );
  const [showStreakModal, setShowStreakModal] = useState(false);

  useEffect(() => {
    if (!isPlayer || !user?.id) return;
    if (showWizard || streakState.loading) return;
    if (streakState.currentStreak <= 0) return;
    if (streakState.daysUntilNextUnlock <= 0) return;
    if (streakState.unlockedTests.length >= availableTestKeys.length) return;

    const today = new Date().toISOString().slice(0, 10);
    const dismissedKey = `streak-modal-${user.id}-${today}`;
    if (sessionStorage.getItem(dismissedKey)) return;
    setShowStreakModal(true);
  }, [
    isPlayer,
    user?.id,
    showWizard,
    streakState.loading,
    streakState.currentStreak,
    streakState.daysUntilNextUnlock,
    streakState.unlockedTests.length,
    availableTestKeys.length,
  ]);

  const handleStreakDismiss = () => {
    setShowStreakModal(false);
    if (user?.id) {
      const today = new Date().toISOString().slice(0, 10);
      sessionStorage.setItem(`streak-modal-${user.id}-${today}`, "true");
    }
  };

  const handleStreakContinue = () => {
    handleStreakDismiss();
    setActiveSection("profile");
  };

  const nextTestLabel = streakState.nextTestPreview
    ? getTestLabelByKey(playerSport, streakState.nextTestPreview)
    : null;

  if (!user || roleLoading) {
    return (
      <div className="flex min-h-screen bg-background dark items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const handleSectionChange = (section: string) => {
    if (section === "activity" && user?.id) {
      markFollowingSeen(user.id);
      markMineSeen(user.id);
    }
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
            {(userRole === "scout" || userRole === "agent" || userRole === "club_rep")
              ? <ScoutPersonalProfile userId={user.id} />
              : <PersonalProfile userId={user.id} />}
          </>
        );
      case "players":
      case "scouters":
      case "agents":
      case "clubs":
      case "community":
        return <CommunitySection onNavigateToChat={handleNavigateToChat} />;
      case "notifications": return <NotificationsSection onNavigateToChat={handleNavigateToChat} />;
      case "activity": return <ActivitySection onNavigateToChat={handleNavigateToChat} />;
      case "messages": return (
        <MessagesSection
          initialChatUserId={pendingChatUserId}
          onInitialChatHandled={() => setPendingChatUserId(null)}
          onNavigateToChat={handleNavigateToChat}
        />
      );
      default:
        return (
          <>
            {completionBar}
            {(userRole === "scout" || userRole === "agent" || userRole === "club_rep")
              ? <ScoutPersonalProfile userId={user.id} />
              : <PersonalProfile userId={user.id} />}
          </>
        );
    }
  };

  const sidebarFirstLabel = (userRole === "scout" || userRole === "agent" || userRole === "club_rep") ? "Personal Area" : undefined;

  return (
    <div className="flex h-screen bg-background dark overflow-hidden">
      {showWizard && userRole && (
        <OnboardingWizard
          sections={sections}
          percentage={percentage}
          role={userRole}
          onGoToSection={handleWizardGoToSection}
          onDismiss={handleWizardDismiss}
        />
      )}
      {showStreakModal && !showWizard && (
        <StreakNotificationModal
          currentStreak={streakState.currentStreak}
          required={streakState.required}
          daysUntilNextUnlock={streakState.daysUntilNextUnlock}
          nextTestPreview={streakState.nextTestPreview}
          nextTestLabel={nextTestLabel}
          onContinue={handleStreakContinue}
          onDismiss={handleStreakDismiss}
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
                playerSport={playerSport}
                profileLabel={sidebarFirstLabel}
                userRole={userRole}
                userId={user?.id}
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
            onSectionChange={handleSectionChange}
            playerName={playerName}
            playerSport={playerSport}
            profileLabel={sidebarFirstLabel}
            userRole={userRole}
            userId={user?.id}
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
