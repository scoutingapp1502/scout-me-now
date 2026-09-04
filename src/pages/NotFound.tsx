import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Compass, Loader2 } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [checkingSession, setCheckingSession] = useState(true);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    console.error("404 Error: User attempted to access non-existent route:", location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (cancelled) return;
      setIsLoggedIn(!!session);
      setCheckingSession(false);
    });
    return () => { cancelled = true; };
  }, []);

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted px-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-background p-8 text-center shadow-sm">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
          <Compass className="h-7 w-7 text-primary" />
        </div>
        <h1 className="mb-2 text-3xl font-bold">{t.notFound.title}</h1>
        <p className="mb-6 text-muted-foreground">
          {isLoggedIn ? t.notFound.messageLoggedIn : t.notFound.message}
        </p>
        <Button
          onClick={() => navigate(isLoggedIn ? "/dashboard" : "/")}
          className="w-full"
        >
          {isLoggedIn ? t.notFound.backToDashboard : t.notFound.back}
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
