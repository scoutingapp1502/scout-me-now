import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import DashboardSidebar from "@/components/dashboard/DashboardSidebar";
import SportriseWordmark from "@/components/SportriseWordmark";
import MessagesSection from "@/components/dashboard/MessagesSection";
import ActivitySection from "@/components/dashboard/ActivitySection";
import PersonalProfile from "@/components/dashboard/PersonalProfile";
import ScoutPersonalProfile from "@/components/dashboard/ScoutPersonalProfile";
import PlaceholderSection from "@/components/dashboard/PlaceholderSection";
import NotificationsSection from "@/components/dashboard/NotificationsSection";
import CommunitySection from "@/components/dashboard/CommunitySection";
import ScoutActionsSection from "@/components/dashboard/ScoutActionsSection";
import SettingsSection from "@/components/dashboard/SettingsSection";
import SavedSection from "@/components/dashboard/SavedSection";
import ArchiveSection from "@/components/dashboard/ArchiveSection";
import YourActivitySection from "@/components/dashboard/YourActivitySection";
import RecentlyDeletedSection from "@/components/dashboard/RecentlyDeletedSection";
import LikesActivitySection from "@/components/dashboard/LikesActivitySection";
import TimeManagementSection from "@/components/dashboard/TimeManagementSection";
import NotificationSettingsSection from "@/components/dashboard/NotificationSettingsSection";
import SleepModeSection from "@/components/dashboard/SleepModeSection";
import BlockedSection from "@/components/dashboard/BlockedSection";
import AccountPrivacySection from "@/components/dashboard/AccountPrivacySection";
import MessagesRepliesSection from "@/components/dashboard/MessagesRepliesSection";
import CommentsSection from "@/components/dashboard/CommentsSection";
import SharingReuseSection from "@/components/dashboard/SharingReuseSection";
import FollowInviteSection from "@/components/dashboard/FollowInviteSection";
import FavouritesSection from "@/components/dashboard/FavouritesSection";
import LikeShareCountsSection from "@/components/dashboard/LikeShareCountsSection";
import LanguageSection from "@/components/dashboard/LanguageSection";
import AboutSection from "@/components/dashboard/AboutSection";
import HelpSection from "@/components/dashboard/HelpSection";
import TermsSection from "@/components/dashboard/TermsSection";
import PrivacyPolicySection from "@/components/dashboard/PrivacyPolicySection";
import OnboardingWizard from "@/components/dashboard/OnboardingWizard";
import WelcomeTour from "@/components/dashboard/WelcomeTour";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import { markFollowingSeen, markMineSeen } from "@/hooks/useActivityNotifications";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Menu, Loader2 } from "lucide-react";
import StreakNotificationModal from "@/components/dashboard/StreakNotificationModal";
import { useTestUnlocks } from "@/hooks/useTestUnlocks";
import { useTimeTracking } from "@/hooks/useTimeTracking";
import { getTechnicalTestsBySport, getTestLabelByKey } from "@/components/dashboard/PersonalProfile";
import { useLanguage } from "@/i18n/LanguageContext";

const Dashboard = () => {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [activeSection, setActiveSection] = useState(() => searchParams.get("section") || "profile");
  const [prevSection, setPrevSection] = useState("settings");

  const navigateTo = (section: string) => {
    setPrevSection(activeSection);
    setActiveSection(section);
  };
  const [playerName, setPlayerName] = useState("");
  const [playerSport, setPlayerSport] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userRole, setUserRole] = useState<"player" | "cauta_jucator" | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);
  const [showWizard, setShowWizard] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [tourForceTab, setTourForceTab] = useState<string | null>(null);
  // Once the tour has been shown-and-dismissed this session, never show it
  // again even if a later re-fetch races the has_seen_tour write.
  const tourResolvedRef = useRef(false);
  const [pendingChatUserId, setPendingChatUserId] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const { sections, percentage, loading: completionLoading } = useProfileCompletion(user?.id ?? null, userRole);
  useTimeTracking(user?.id ?? null);

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
        if (roleData.role === 'admin') {
          navigate("/admin");
          return;
        }
        if (isMounted) {
          setUserRole(roleData.role as "player" | "cauta_jucator");
          setRoleLoading(false);
        }
        return;
      }

      // Role missing — create from user metadata (set during registration)
      const metaRole = userMeta?.role as "player" | "cauta_jucator" | undefined;
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
        // cauta_jucator uses scout_profiles
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
        return;
      }
      setUser(session.user);
      // Note: some Supabase client versions fire SIGNED_IN (not just
      // INITIAL_SESSION) when a page refresh restores an existing session
      // from storage, not only on an actual fresh login. Clearing the
      // wizard-dismissed flag on SIGNED_IN therefore used to make the
      // profile-completion wizard reappear on every refresh — removed.
      // Dismissal is scoped to the browser tab (sessionStorage) and resets
      // naturally on a genuinely new tab/session.
      // onAuthStateChange already emits an INITIAL_SESSION event as soon as it
      // subscribes, so a separate getSession() call is unnecessary and was
      // causing ensureRoleAndProfile to run twice concurrently on load.
      // TOKEN_REFRESHED/USER_UPDATED fire on the same session repeatedly
      // (e.g. hourly per open tab) and don't need a role/profile re-check.
      if (event === "TOKEN_REFRESHED" || event === "USER_UPDATED") return;
      ensureRoleAndProfile(session.user.id, session.user.user_metadata);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [navigate]);

  // Fetch display name based on role. Keyed on user?.id (not the user object
  // itself) so a TOKEN_REFRESHED auth event — which hands us a new `user`
  // object reference every ~hour for the same logged-in user — doesn't
  // re-trigger this and re-decide whether to show the welcome tour.
  const userId = user?.id;
  useEffect(() => {
    if (!userId || !userRole) return;
    if (userRole === "cauta_jucator") {
      supabase
        .from("scout_profiles")
        .select("first_name, last_name, has_seen_tour")
        .eq("user_id", userId)
        .maybeSingle()
        .then(
          ({ data }) => {
            if (data) {
              setPlayerName(`${data.first_name} ${data.last_name}`.trim());
              if (!(data as any).has_seen_tour && !tourResolvedRef.current) setShowTour(true);
            }
          },
          (err) => console.error("Failed to load scout display name:", err)
        );
    } else {
      supabase
        .from("player_profiles")
        .select("first_name, last_name, sport, has_seen_tour")
        .eq("user_id", userId)
        .maybeSingle()
        .then(
          ({ data }) => {
            if (data) {
              setPlayerName(`${data.first_name} ${data.last_name}`.trim());
              if (data.sport) setPlayerSport(data.sport);
              if (!(data as any).has_seen_tour && !tourResolvedRef.current) setShowTour(true);
            }
          },
          (err) => console.error("Failed to load player display name:", err)
        );
    }
  }, [userId, userRole]);

  const handleTourNavigate = (sectionId: string, tabId?: string) => {
    setActiveSection(sectionId);
    if (tabId) setTourForceTab(tabId);
  };

  const handleTourFinish = async () => {
    setShowTour(false);
    tourResolvedRef.current = true;
    if (!user?.id || !userRole) return;
    const table = userRole === "cauta_jucator" ? "scout_profiles" : "player_profiles";
    const { error } = await supabase.from(table).update({ has_seen_tour: true } as any).eq("user_id", user.id);
    if (error) console.error("Failed to persist has_seen_tour:", error);
  };

  // Finish joining a group via invite link if the user had to log in first
  // (JoinGroup.tsx stashes the token before redirecting to /auth).
  useEffect(() => {
    if (!user?.id) return;
    const pendingToken = sessionStorage.getItem("pending-group-invite-token");
    if (!pendingToken) return;
    (async () => {
      const { data: groupId, error } = await (supabase as any).rpc("join_group_via_invite", { _token: pendingToken });
      sessionStorage.removeItem("pending-group-invite-token");
      if (!error && groupId) setActiveSection("messages");
    })();
  }, [user?.id]);

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
    ? getTestLabelByKey(playerSport, streakState.nextTestPreview, lang)
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

  // Profile completion bar disabled — was reappearing after every section save.
  const completionBar = null;

  const renderSection = () => {
    switch (activeSection) {
      case "profile":
        return (
          <>
            {completionBar}
            {(userRole === "cauta_jucator")
              ? <ScoutPersonalProfile userId={user.id} onNavigate={navigateTo} />
              : <PersonalProfile userId={user.id} forceActiveTab={tourForceTab as any} onForceTabHandled={() => setTourForceTab(null)} onNavigate={navigateTo} />}
          </>
        );
      case "players":
      case "scouters":
      case "agents":
      case "clubs":
      case "community":
        return <CommunitySection onNavigateToChat={handleNavigateToChat} />;
      case "player-notes":
        return (userRole === "cauta_jucator")
          ? <ScoutActionsSection scoutUserId={user.id} userRole={userRole} onNavigateToChat={handleNavigateToChat} />
          : null;
      case "notifications": return <NotificationsSection onNavigateToChat={handleNavigateToChat} onNavigateToProfile={() => setActiveSection("profile")} />;
      case "activity": return <ActivitySection onNavigateToChat={handleNavigateToChat} onNavigateToProfile={() => setActiveSection("profile")} />;
      case "settings": return <SettingsSection userId={user.id} userRole={userRole} onNavigate={navigateTo} />;
      case "saved": return <SavedSection userId={user.id} onBack={() => setActiveSection("settings")} />;
      case "archive": return <ArchiveSection userId={user.id} onBack={() => setActiveSection(prevSection)} />;
      case "your-activity": return <YourActivitySection onBack={() => setActiveSection("settings")} onNavigate={navigateTo} />;
      case "likes-activity": return <LikesActivitySection userId={user.id} onBack={() => setActiveSection("your-activity")} onViewProfile={() => setActiveSection("profile")} />;
      case "recently-deleted": return <RecentlyDeletedSection userId={user.id} onBack={() => setActiveSection("your-activity")} onViewProfile={() => setActiveSection("profile")} />;
      case "time-management": return <TimeManagementSection userId={user.id} onBack={() => setActiveSection(prevSection)} />;
      case "blocked": return <BlockedSection currentUserId={user.id} onBack={() => setActiveSection("settings")} />;
      case "account-privacy": return <AccountPrivacySection userId={user.id} onBack={() => setActiveSection("settings")} />;
      case "messages-replies": return <MessagesRepliesSection userId={user.id} onBack={() => setActiveSection("settings")} />;
      case "comments": return <CommentsSection userId={user.id} onBack={() => setActiveSection("settings")} />;
      case "sharing-reuse": return <SharingReuseSection userId={user.id} onBack={() => setActiveSection("settings")} />;
      case "follow-invite": return <FollowInviteSection userId={user.id} onBack={() => setActiveSection("settings")} />;
      case "favourites": return <FavouritesSection userId={user.id} onBack={() => setActiveSection("settings")} />;
      case "like-share-counts": return <LikeShareCountsSection userId={user.id} onBack={() => setActiveSection("settings")} />;
      case "language": return <LanguageSection userId={user.id} onBack={() => setActiveSection("settings")} />;
      case "about": return <AboutSection userId={user.id} onBack={() => setActiveSection("settings")} />;
      case "help": return <HelpSection userId={user.id} onBack={() => setActiveSection("settings")} />;
      case "terms": return <TermsSection onBack={() => setActiveSection("profile")} />;
      case "privacy-policy": return <PrivacyPolicySection onBack={() => setActiveSection("profile")} />;
      case "notification-settings": return <NotificationSettingsSection onBack={() => setActiveSection("settings")} onNavigateToSleepMode={() => navigateTo("sleep-mode-settings")} />;
      case "sleep-mode-settings": return <SleepModeSection onBack={() => setActiveSection("notification-settings")} />;
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
            {(userRole === "cauta_jucator")
              ? <ScoutPersonalProfile userId={user.id} onNavigate={navigateTo} />
              : <PersonalProfile userId={user.id} forceActiveTab={tourForceTab as any} onForceTabHandled={() => setTourForceTab(null)} onNavigate={navigateTo} />}
          </>
        );
    }
  };

  const sidebarFirstLabel = (userRole === "cauta_jucator") ? "Personal Area" : undefined;
  const communitySections = ["players", "scouters", "agents", "clubs", "community"];
  const settingsSections = [
    "settings", "saved", "archive", "your-activity", "likes-activity", "recently-deleted",
    "time-management", "notification-settings", "sleep-mode-settings", "account-privacy",
    "blocked", "messages-replies", "comments", "sharing-reuse", "follow-invite", "favourites",
    "like-share-counts", "language", "help", "about",
  ];
  const showLightMain = activeSection === "profile" || activeSection === "messages" || activeSection === "notifications" || activeSection === "activity" || activeSection === "player-notes" || communitySections.includes(activeSection) || settingsSections.includes(activeSection);

  return (
    <div className="flex h-screen bg-background dark overflow-hidden">
      {showTour && userRole && (
        <WelcomeTour role={userRole} onNavigate={handleTourNavigate} onFinish={handleTourFinish} />
      )}
      {showWizard && userRole && !showTour && (
        <OnboardingWizard
          sections={sections}
          percentage={percentage}
          role={userRole}
          onGoToSection={handleWizardGoToSection}
          onDismiss={handleWizardDismiss}
        />
      )}
      {showStreakModal && !showWizard && !showTour && (
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
          <div className="flex-1 min-w-0 flex flex-col">
            <header className="flex items-center gap-3 p-4 border-b border-border bg-white">
              <button onClick={() => setSidebarOpen(true)} className="text-gray-900">
                <Menu className="h-6 w-6" />
              </button>
              <span className="text-lg">⚽</span>
              <SportriseWordmark className="text-lg" />
            </header>
            <main className={`flex-1 min-w-0 p-4 overflow-y-auto overflow-x-hidden ${showLightMain ? "bg-gray-200" : "bg-background"}`}>
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
          <main className={`flex-1 p-8 overflow-y-auto ${showLightMain ? "bg-gray-200" : "bg-background"}`}>
            {renderSection()}
          </main>
        </>
      )}
    </div>
  );
};

export default Dashboard;
