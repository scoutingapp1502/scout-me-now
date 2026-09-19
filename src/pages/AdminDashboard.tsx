import { useEffect, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Video, LayoutDashboard, Shield, UserCheck, Film, MessageSquareWarning, Image, Megaphone, Menu, Rocket, Wrench, ShieldAlert, FlaskConical, Ban } from "lucide-react";
import AdminVideoReview from "@/pages/AdminVideoReview";
import AdminContentModeration from "@/pages/AdminContentModeration";
import AdminUsersAtRisk from "@/pages/AdminUsersAtRisk";
import AdminScoutVerification from "@/pages/AdminScoutVerification";
import AdminTestVideos from "@/pages/AdminTestVideos";
import AdminSupportTickets from "@/pages/AdminSupportTickets";
import AdminClubLogos from "@/pages/AdminClubLogos";
import AdminAnnouncements from "@/pages/AdminAnnouncements";
import AdminSportrisePosts from "@/pages/AdminSportrisePosts";
import AdminMaintenanceMode from "@/pages/AdminMaintenanceMode";
import { Loader2 } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Sheet, SheetContent } from "@/components/ui/sheet";

// Dev-only test panel: dynamic import() behind a literal
// `import.meta.env.DEV` check lets Vite/Rollup statically eliminate this
// branch (and everything AdminModerationTestPanel.tsx pulls in) from a
// `vite build` output entirely — not merely hide it at runtime. A
// production bundle contains none of this module's code.
const AdminModerationTestPanel = import.meta.env.DEV
  ? lazy(() => import("@/pages/AdminModerationTestPanel"))
  : null;

const adminSections = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "video-review", label: "Verificare Videouri", icon: Video },
  { id: "content-moderation", label: "Moderare Conținut", icon: ShieldAlert },
  { id: "users-at-risk", label: "Useri cu risc de blocare", icon: Ban },
  ...(import.meta.env.DEV ? [{ id: "moderation-test", label: "Test Moderare (dev)", icon: FlaskConical }] : []),
  { id: "test-videos", label: "Video-uri Exemplu Teste", icon: Film },
  { id: "club-logos", label: "Logo-uri Cluburi", icon: Image },
  { id: "announcements", label: "Știri și Anunțuri", icon: Megaphone },
  { id: "sportrise-posts", label: "Postări SportRise", icon: Rocket },
  { id: "maintenance-mode", label: "Mentenanță", icon: Wrench },
  { id: "scout-verification", label: "Verificare Documente Înregistrate", icon: UserCheck },
  { id: "support-tickets", label: "Rapoarte Utilizatori", icon: MessageSquareWarning },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("video-review");
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/auth"); return; }

      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);

      const hasAdmin = roles?.some((r: any) => r.role === "admin");
      if (!hasAdmin) {
        navigate("/dashboard");
        toast({ title: "Acces interzis", variant: "destructive" });
        return;
      }
      setIsAdmin(true);
      setLoading(false);
    };
    check();
  }, [navigate, toast]);

  const fetchPendingCounts = async () => {
    const [videos, docs, tickets, moderatedPosts, moderatedSubmissions] = await Promise.all([
      supabase.from("video_submissions").select("*", { count: "exact", head: true }).eq("status", "pending"),
      supabase.from("scout_verification_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
      (supabase as any).from("support_tickets").select("*", { count: "exact", head: true }).neq("status", "resolved"),
      (supabase as any).from("posts").select("*", { count: "exact", head: true }).in("moderation_status", ["pending", "flagged"]),
      (supabase as any).from("video_submissions").select("*", { count: "exact", head: true }).in("moderation_status", ["pending", "flagged"]),
    ]);
    setPendingCounts({
      "video-review": videos.count || 0,
      "scout-verification": docs.count || 0,
      "support-tickets": tickets.count || 0,
      "content-moderation": (moderatedPosts.count || 0) + (moderatedSubmissions.count || 0),
    });
  };

  // Refetch whenever leaving a section so badges update after reviewing
  // items, plus realtime subscriptions so new submissions show up live.
  useEffect(() => {
    if (!isAdmin) return;
    fetchPendingCounts();
  }, [isAdmin, activeSection]);

  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-pending-counts")
      .on("postgres_changes", { event: "*", schema: "public", table: "video_submissions" }, fetchPendingCounts)
      .on("postgres_changes", { event: "*", schema: "public", table: "scout_verification_requests" }, fetchPendingCounts)
      .on("postgres_changes", { event: "*", schema: "public", table: "support_tickets" }, fetchPendingCounts)
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, fetchPendingCounts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen bg-gray-200 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-orange-500" />
      </div>
    );
  }

  const sidebarContent = (
    <>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-orange-500" />
          <span className="font-display text-2xl text-orange-500">ADMIN</span>
        </div>
        <p className="text-xs text-gray-500 font-body mt-1">SportRise Admin Panel</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {adminSections.map((section) => {
          const Icon = section.icon;
          const isActive = activeSection === section.id;
          const badgeCount = pendingCounts[section.id] || 0;
          return (
            <button
              key={section.id}
              onClick={() => { setActiveSection(section.id); if (isMobile) setSidebarOpen(false); }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-body text-sm transition-all relative ${
                isActive
                  ? "bg-orange-500 text-white shadow-lg"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}
            >
              <Icon className="h-5 w-5 shrink-0" />
              <span className="text-left">{section.label}</span>
              {badgeCount > 0 && (
                <span className="ml-auto w-5 h-5 rounded-full bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center justify-center shrink-0">
                  <span className="text-[10px] text-white font-bold">{badgeCount > 99 ? "99+" : badgeCount}</span>
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-gray-200">
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-500 hover:text-destructive hover:bg-gray-100 font-body text-sm transition-all"
        >
          <LogOut className="h-5 w-5" />
          Deconectare
        </button>
      </div>
    </>
  );

  const mainContent = (
    <>
      {activeSection === "overview" && (
        <div className="max-w-4xl mx-auto p-4 sm:p-6">
          <h1 className="text-2xl font-heading font-bold mb-4 text-gray-900">Dashboard Admin</h1>
          <p className="text-gray-500">Bine ai venit în panoul de administrare SportRise.</p>
        </div>
      )}
      {activeSection === "video-review" && (
        <AdminVideoReview embedded />
      )}
      {activeSection === "content-moderation" && (
        <AdminContentModeration embedded />
      )}
      {activeSection === "users-at-risk" && (
        <AdminUsersAtRisk embedded />
      )}
      {activeSection === "moderation-test" && AdminModerationTestPanel && (
        <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-orange-500" /></div>}>
          <AdminModerationTestPanel />
        </Suspense>
      )}
      {activeSection === "test-videos" && (
        <AdminTestVideos embedded />
      )}
      {activeSection === "club-logos" && (
        <AdminClubLogos embedded />
      )}
      {activeSection === "announcements" && (
        <AdminAnnouncements embedded />
      )}
      {activeSection === "sportrise-posts" && (
        <AdminSportrisePosts embedded />
      )}
      {activeSection === "maintenance-mode" && (
        <AdminMaintenanceMode embedded />
      )}
      {activeSection === "scout-verification" && (
        <AdminScoutVerification />
      )}
      {activeSection === "support-tickets" && (
        <AdminSupportTickets />
      )}
    </>
  );

  if (isMobile) {
    return (
      <div className="flex flex-col h-screen bg-gray-200 overflow-hidden">
        <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
          <SheetContent side="left" className="p-0 w-64 bg-white border-gray-200 flex flex-col">
            {sidebarContent}
          </SheetContent>
        </Sheet>
        <header className="flex items-center gap-3 p-4 border-b border-gray-200 bg-white shrink-0">
          <button onClick={() => setSidebarOpen(true)} className="text-gray-900">
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-orange-500" />
            <span className="font-display text-lg text-orange-500">ADMIN</span>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto bg-gray-200">
          {mainContent}
        </main>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-200 overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 min-h-screen bg-white border-r border-gray-200 flex flex-col">
        {sidebarContent}
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto bg-gray-200">
        {mainContent}
      </main>
    </div>
  );
}
