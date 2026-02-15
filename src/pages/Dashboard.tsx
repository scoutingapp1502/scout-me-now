import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";

const Dashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);

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

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-pitch border-b border-primary/20">
        <div className="container mx-auto flex items-center justify-between h-16 px-4">
          <span className="font-display text-2xl text-primary-foreground">⚽ FOOTBALLSCOUT</span>
          <Button variant="ghost" onClick={handleLogout} className="text-primary-foreground hover:text-primary">
            <LogOut className="h-4 w-4 mr-2" /> Deconectare
          </Button>
        </div>
      </nav>
      <div className="container mx-auto px-4 py-12 text-center">
        <h1 className="font-display text-4xl text-foreground mb-4">BINE AI VENIT!</h1>
        <p className="text-muted-foreground font-body">
          Ești autentificat ca {user.email}. Dashboard-ul complet va fi implementat în curând.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;
