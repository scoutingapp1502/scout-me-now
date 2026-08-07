import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Users, XCircle } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const PENDING_INVITE_KEY = "pending-group-invite-token";

export default function JoinGroup() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { lang } = useLanguage();
  const [status, setStatus] = useState<"checking" | "joined" | "invalid">("checking");

  useEffect(() => {
    if (!token) { setStatus("invalid"); return; }

    const run = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        sessionStorage.setItem(PENDING_INVITE_KEY, token);
        navigate("/auth?tab=login");
        return;
      }

      const { data: groupId, error } = await (supabase as any).rpc("join_group_via_invite", { _token: token });
      if (error || !groupId) {
        setStatus("invalid");
        return;
      }
      sessionStorage.removeItem(PENDING_INVITE_KEY);
      setStatus("joined");
    };
    run();
  }, [token, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-sm w-full text-center space-y-4">
        {status === "checking" && (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-muted-foreground font-body">
              {lang === "ro" ? "Se verifică link-ul de invitație..." : "Checking invite link..."}
            </p>
          </>
        )}
        {status === "joined" && (
          <>
            <div className="w-16 h-16 rounded-full bg-primary/15 border-2 border-primary flex items-center justify-center mx-auto">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <h1 className="font-display text-xl text-foreground">
              {lang === "ro" ? "Te-ai alăturat grupului!" : "You joined the group!"}
            </h1>
            <p className="text-sm text-muted-foreground font-body">
              {lang === "ro" ? "Deschide secțiunea Mesaje pentru a vedea conversația." : "Open the Messages section to see the conversation."}
            </p>
            <Button onClick={() => navigate("/dashboard?section=messages")} className="w-full">
              {lang === "ro" ? "Mergi la Mesaje" : "Go to Messages"}
            </Button>
          </>
        )}
        {status === "invalid" && (
          <>
            <div className="w-16 h-16 rounded-full bg-destructive/15 border-2 border-destructive flex items-center justify-center mx-auto">
              <XCircle className="h-8 w-8 text-destructive" />
            </div>
            <h1 className="font-display text-xl text-foreground">
              {lang === "ro" ? "Link invalid sau expirat" : "Invalid or expired link"}
            </h1>
            <Button variant="outline" onClick={() => navigate("/dashboard")} className="w-full">
              {lang === "ro" ? "Înapoi la aplicație" : "Back to app"}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
