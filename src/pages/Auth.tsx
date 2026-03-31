import { useState, useEffect } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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

  const [tab, setTab] = useState<"login" | "register" | "forgot">(
    searchParams.get("tab") === "login" ? "login" : "register"
  );
  const [role, setRole] = useState<"player" | "scout" | "agent">(
    searchParams.get("role") === "scout" ? "scout" : searchParams.get("role") === "agent" ? "agent" : "player"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [sport, setSport] = useState("football");
  const [gender, setGender] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

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
    if (password !== confirmPassword) {
      toast({ title: t.auth.errorRegister, description: t.auth.passwordsMismatch, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin, data: { full_name: fullName, role, gender, sport } },
      });
      if (error) throw error;
      if (data.user) {
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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast({ title: t.auth.resetSent, description: t.auth.resetSentDesc });
    } catch (error: any) {
      toast({ title: t.auth.passwordResetError, description: error.message, variant: "destructive" });
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
              {tab === "register" ? t.auth.createAccount : tab === "forgot" ? t.auth.forgotPasswordTitle : t.auth.login}
            </CardTitle>
            <CardDescription className="font-body">
              {tab === "register" ? t.auth.registerDesc : tab === "forgot" ? t.auth.forgotPasswordDesc : t.auth.loginDesc}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tab !== "forgot" && (
              <div className="flex mb-6 bg-muted rounded-lg p-1">
                <button onClick={() => setTab("register")} className={`flex-1 py-2 rounded-md text-sm font-medium font-body transition-all ${tab === "register" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
                  {t.auth.tabRegister}
                </button>
                <button onClick={() => setTab("login")} className={`flex-1 py-2 rounded-md text-sm font-medium font-body transition-all ${tab === "login" ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"}`}>
                  {t.auth.tabLogin}
                </button>
              </div>
            )}

            {tab === "forgot" ? (
              <form onSubmit={handleForgotPassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-body">{t.auth.email}</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.auth.emailPlaceholder} required />
                </div>
                <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold py-5" disabled={loading}>
                  {loading ? t.auth.processing : t.auth.sendResetLink}
                </Button>
                <p className="text-center text-sm text-muted-foreground mt-4 font-body">
                  <button onClick={() => setTab("login")} className="text-primary hover:underline font-medium">{t.auth.backToLogin}</button>
                </p>
              </form>
            ) : (
              <>
                <form onSubmit={tab === "register" ? handleRegister : handleLogin} className="space-y-4">
                  {tab === "register" && (
                    <>
                      <div className="space-y-2">
                        <Label className="font-body text-sm">{t.auth.accountType}</Label>
                        <RadioGroup value={role} onValueChange={(v) => setRole(v as "player" | "scout" | "agent")} className="grid grid-cols-3 gap-3">
                          {([
                            { value: "player", label: t.auth.player, desc: t.auth.playerDesc },
                            { value: "scout", label: t.auth.scout, desc: t.auth.scoutDesc },
                            { value: "agent", label: t.auth.agent, desc: t.auth.agentDesc },
                          ] as const).map((item) => (
                            <label key={item.value} className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all h-full ${role === item.value ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                              <RadioGroupItem value={item.value} />
                              <div className="min-w-0">
                                <p className="font-semibold font-body text-sm">{item.label}</p>
                                <p className="text-xs text-muted-foreground font-body">{item.desc}</p>
                              </div>
                            </label>
                          ))}
                        </RadioGroup>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fullName" className="font-body">{t.auth.fullName}</Label>
                        <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t.auth.fullNamePlaceholder} required />
                      </div>
                      {role === "player" && (
                        <div className="space-y-2">
                          <Label className="font-body text-sm">{t.auth.gender}</Label>
                          <Select value={gender} onValueChange={setGender}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={t.auth.selectGender} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="male">{t.auth.genderMale}</SelectItem>
                              <SelectItem value="female">{t.auth.genderFemale}</SelectItem>
                              <SelectItem value="prefer_not_to_say">{t.auth.genderPreferNotToSay}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {role === "player" && (
                        <div className="space-y-2">
                          <Label className="font-body text-sm">{t.auth.sport}</Label>
                          <Select value={sport} onValueChange={setSport}>
                            <SelectTrigger className="w-full">
                              <SelectValue placeholder={t.auth.selectSport} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="football">{t.auth.sportFootball}</SelectItem>
                              <SelectItem value="basketball">{t.auth.sportBasketball}</SelectItem>
                              <SelectItem value="tennis">{t.auth.sportTennis}</SelectItem>
                              <SelectItem value="handball">{t.auth.sportHandball}</SelectItem>
                              <SelectItem value="volleyball">{t.auth.sportVolleyball}</SelectItem>
                              <SelectItem value="rugby">{t.auth.sportRugby}</SelectItem>
                              <SelectItem value="swimming">{t.auth.sportSwimming}</SelectItem>
                              <SelectItem value="athletics">{t.auth.sportAthletics}</SelectItem>
                              <SelectItem value="other">{t.auth.sportOther}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor="email" className="font-body">{t.auth.email}</Label>
                    <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t.auth.emailPlaceholder} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="font-body">{t.auth.password}</Label>
                    <div className="relative">
                      <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.auth.passwordPlaceholder} required minLength={6} className="pr-10" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                   </div>

                   {tab === "register" && (
                     <div className="space-y-2">
                       <Label htmlFor="confirmPassword" className="font-body">{t.resetPassword.confirmPassword}</Label>
                       <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t.auth.passwordPlaceholder} required minLength={6} />
                     </div>
                   )}

                   {tab === "login" && (
                    <div className="text-right">
                      <button type="button" onClick={() => setTab("forgot")} className="text-sm text-primary hover:underline font-body">
                        {t.auth.forgotPassword}
                      </button>
                    </div>
                  )}

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
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Auth;
