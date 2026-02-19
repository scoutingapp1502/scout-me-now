import { useState, useEffect } from "react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";

const Auth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [tab, setTab] = useState<"login" | "register">(
    searchParams.get("tab") === "login" ? "login" : "register"
  );
  const [role, setRole] = useState<"player" | "scout">(
    searchParams.get("role") === "scout" ? "scout" : "player"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate("/dashboard");
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard");
    });
    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin, data: { full_name: fullName, role } },
      });
      if (error) throw error;
      if (data.user) {
        const { error: roleError } = await supabase.from("user_roles").insert({ user_id: data.user.id, role });
        if (roleError) console.error("Role insert error:", roleError);
        await supabase.from("profiles").insert({ user_id: data.user.id, full_name: fullName });
        if (role === "player") {
          await supabase.from("player_profiles").insert({ user_id: data.user.id, first_name: fullName.split(" ")[0] || "", last_name: fullName.split(" ").slice(1).join(" ") || "" });
        } else {
          await supabase.from("scout_profiles").insert({ user_id: data.user.id, first_name: fullName.split(" ")[0] || "", last_name: fullName.split(" ").slice(1).join(" ") || "" });
        }
        toast({ title: t.auth.successTitle, description: t.auth.successDesc });
      }
    } catch (error: any) {
      toast({ title: t.auth.errorRegister, description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (error: any) {
      toast({ title: t.auth.errorLogin, description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-pitch via-pitch/95 to-primary/20 flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `radial-gradient(circle at 2px 2px, hsl(var(--primary)) 1px, transparent 0)`,
        backgroundSize: '40px 40px'
      }} />

      {/* Language toggle top-right */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageToggle />
      </div>

      <div className="relative w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-1 text-primary-foreground/70 hover:text-primary mb-6 font-body text-sm">
          <ArrowLeft className="h-4 w-4" /> {t.auth.back}
        </Link>

        <Card className="bg-card/95 backdrop-blur border-primary/20 shadow-2xl">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto mb-2 w-12 h-12 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground text-2xl">⚽</span>
            </div>
            <CardTitle className="font-display text-3xl text-foreground">
              {tab === "register" ? t.auth.createAccount : t.auth.login}
            </CardTitle>
            <CardDescription className="font-body">
              {tab === "register" ? t.auth.registerDesc : t.auth.loginDesc}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex mb-6 bg-muted rounded-lg p-1">
              <button onClick={() => setTab("register")} className={`flex-1 py-2 rounded-md text-sm font-medium font-body transition-all ${tab === "register" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
                {t.auth.tabRegister}
              </button>
              <button onClick={() => setTab("login")} className={`flex-1 py-2 rounded-md text-sm font-medium font-body transition-all ${tab === "login" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
                {t.auth.tabLogin}
              </button>
            </div>

            <form onSubmit={tab === "register" ? handleRegister : handleLogin} className="space-y-4">
              {tab === "register" && (
                <>
                  <div className="space-y-2">
                    <Label className="font-body text-sm">{t.auth.accountType}</Label>
                    <RadioGroup value={role} onValueChange={(v) => setRole(v as "player" | "scout")} className="flex gap-4">
                      <div className="flex-1">
                        <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${role === "player" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                          <RadioGroupItem value="player" />
                          <div>
                            <p className="font-semibold font-body text-sm">{t.auth.player}</p>
                            <p className="text-xs text-muted-foreground font-body">{t.auth.playerDesc}</p>
                          </div>
                        </label>
                      </div>
                      <div className="flex-1">
                        <label className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${role === "scout" ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                          <RadioGroupItem value="scout" />
                          <div>
                            <p className="font-semibold font-body text-sm">{t.auth.scout}</p>
                            <p className="text-xs text-muted-foreground font-body">{t.auth.scoutDesc}</p>
                          </div>
                        </label>
                      </div>
                    </RadioGroup>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fullName" className="font-body">{t.auth.fullName}</Label>
                    <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t.auth.fullNamePlaceholder} required />
                  </div>
                </>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="font-body">{t.auth.email}</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.auth.emailPlaceholder} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="font-body">{t.auth.password}</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.auth.passwordPlaceholder} required minLength={6} />
              </div>

              <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-5" disabled={loading}>
                {loading ? t.auth.processing : tab === "register" ? t.auth.createBtn : t.auth.loginBtn}
              </Button>
            </form>

            <p className="text-center text-sm text-muted-foreground mt-4 font-body">
              {tab === "register" ? (
                <>{t.auth.hasAccount}{" "}<button onClick={() => setTab("login")} className="text-primary hover:underline font-medium">{t.auth.loginLink}</button></>
              ) : (
                <>{t.auth.noAccount}{" "}<button onClick={() => setTab("register")} className="text-primary hover:underline font-medium">{t.auth.registerLink}</button></>
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
