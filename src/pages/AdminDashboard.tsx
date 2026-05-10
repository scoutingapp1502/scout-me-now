import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { LogOut, Video, LayoutDashboard, Shield } from "lucide-react";
import AdminVideoReview from "@/pages/AdminVideoReview";
import { Loader2 } from "lucide-react";

const adminSections = [
  { id: "overview", label: "Dashboard", icon: LayoutDashboard },
  { id: "video-review", label: "Verificare Videouri", icon: Video },
];

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState("video-review");

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  if (loading || !isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background dark overflow-hidden">
      {/* Sidebar */}
      <aside className="w-64 min-h-screen bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="p-6 border-b border-sidebar-border">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-display text-2xl text-primary">ADMIN</span>
          </div>
          <p className="text-xs text-sidebar-foreground/60 font-body mt-1">SportRise Admin Panel</p>
        </div>

        <nav className="flex-1 p-4 space-y-1">
          {adminSections.map((section) => {
            const Icon = section.icon;
            const isActive = activeSection === section.id;
            return (
              <button
                key={section.id}
                onClick={() => setActiveSection(section.id)}
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

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {activeSection === "overview" && (
          <div className="max-w-4xl mx-auto p-6">
            <h1 className="text-2xl font-heading font-bold mb-4">Dashboard Admin</h1>
            <p className="text-muted-foreground">Bine ai venit în panoul de administrare SportRise.</p>
          </div>
        )}
        {activeSection === "video-review" && (
          <AdminVideoReview embedded />
        )}
      </main>
    </div>
  );
}
