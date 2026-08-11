import { useState, useEffect, useRef } from "react";
import { Eye, EyeOff, ArrowLeft, ChevronDown, Upload, FileCheck, Star, Info } from "lucide-react";
import { useSearchParams, useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";

// Roles that must upload a verification document at signup and stay
// gated (dashboard visible, actions disabled) until an admin approves it.
const REQUIRES_VERIFICATION = ["cauta_jucator"];

const SportriseWordmark = ({ className = "" }: { className?: string }) => (
  <div className={`font-display inline-flex items-end justify-center leading-none tracking-wide ${className}`}>
    <span className="text-white">SPORT</span>
    <span className="text-primary">R</span>
    <span className="relative inline-block h-[1em] w-[0.32em] mx-[0.02em]">
      <Star className="absolute left-1/2 -translate-x-1/2 -top-[0.4em] h-[0.55em] w-[0.55em] fill-electric text-electric" />
      <span className="absolute left-1/2 -translate-x-1/2 bottom-0 w-[0.16em] h-[0.72em] bg-primary rounded-[0.02em]" />
    </span>
    <span className="text-primary">SE</span>
  </div>
);

const Auth = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { t } = useLanguage();

  const [tab, setTab] = useState<"login" | "register" | "forgot">(
    searchParams.get("tab") === "login" ? "login" : "register"
  );
  const [role, setRole] = useState<"player" | "cauta_jucator">(
    searchParams.get("role") === "cauta_jucator" ? "cauta_jucator" : "player"
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [sport, setSport] = useState("football");
  const [gender, setGender] = useState("");
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [scoutDocument, setScoutDocument] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session) navigate("/dashboard");
    });
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) navigate("/dashboard");
    }).catch((err) => console.error("Failed to get session:", err));
    return () => subscription.unsubscribe();
  }, [navigate]);

  const toBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve((reader.result as string).split(",")[1]);
      reader.onerror = reject;
    });

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: t.auth.errorRegister, description: t.auth.passwordsMismatch, variant: "destructive" });
      return;
    }
    if (REQUIRES_VERIFICATION.includes(role) && !scoutDocument) {
      toast({ title: "Document lipsă", description: "Încarcă un document de verificare pentru acest tip de cont.", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const metadata: Record<string, any> = { full_name: fullName, role, gender, sport };
      if (role === "cauta_jucator") {
        metadata.sports = selectedSports;
      }
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin, data: metadata },
      });
      if (error) throw error;
      if (data.user) {
        // Process invite code if provided (players only)
        const trimmedCode = inviteCode.trim().toUpperCase();
        if (trimmedCode && role === "player") {
          const { data: codeRow } = await (supabase as any)
            .from("user_invite_codes")
            .select("user_id")
            .eq("code", trimmedCode)
            .maybeSingle();
          if (codeRow?.user_id && codeRow.user_id !== data.user.id) {
            const { error: inviteErr } = await (supabase as any)
              .from("invite_uses")
              .upsert(
                { inviter_id: codeRow.user_id, invitee_id: data.user.id },
                { onConflict: "invitee_id" }
              );
            if (inviteErr) console.error("invite_uses insert failed:", inviteErr);
          }
        }
        // Upload verification document if provided
        if (REQUIRES_VERIFICATION.includes(role) && scoutDocument && data.user) {
          try {
            const fileBase64 = await toBase64(scoutDocument);
            const { error: fnError } = await supabase.functions.invoke("submit-scout-document", {
              body: {
                userId: data.user.id,
                fileName: scoutDocument.name,
                fileBase64,
                mimeType: scoutDocument.type,
              },
            });
            if (fnError) console.error("Document upload failed:", fnError);
          } catch (docErr) {
            console.error("Document upload failed:", docErr);
          }
        }
        setRegisteredEmail(email);
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

  if (registeredEmail) {
    const isScout = REQUIRES_VERIFICATION.includes(role);
    return (
      <div className="min-h-screen bg-gradient-to-br from-pitch via-pitch/95 to-primary/20 flex items-center justify-center p-4">
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, hsl(var(--primary)) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }} />
        <div className="relative w-full max-w-md">
          <Card className="bg-card/95 backdrop-blur border-primary/20 shadow-2xl">
            <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-5">
              <div className="w-16 h-16 rounded-full bg-primary/15 border-2 border-primary flex items-center justify-center">
                {isScout ? (
                  <FileCheck className="h-8 w-8 text-primary" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              {isScout ? (
                <>
                  <div className="space-y-2">
                    <h2 className="font-display text-2xl text-foreground">Cerere trimisă</h2>
                    <p className="text-muted-foreground font-body text-sm leading-relaxed">
                      Vei fi notificat după verificarea documentului de către echipa SportRise.
                    </p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2 w-full">
                    <p className="text-sm font-body text-foreground font-semibold">Ce urmează:</p>
                    <ol className="text-sm font-body text-muted-foreground space-y-1.5 list-decimal list-inside">
                      <li>Confirmă adresa de email <span className="text-foreground break-all">{registeredEmail}</span></li>
                      <li>Echipa SportRise verifică documentul tău</li>
                      <li>După aprobare vei primi acces complet</li>
                    </ol>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <h2 className="font-display text-2xl text-foreground">Verifică-ți adresa de email</h2>
                    <p className="text-muted-foreground font-body text-sm leading-relaxed">
                      Am trimis un email de confirmare la:
                    </p>
                    <p className="font-semibold text-primary font-body text-sm break-all">{registeredEmail}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-4 text-left space-y-2 w-full">
                    <p className="text-sm font-body text-foreground font-semibold">Ce trebuie să faci:</p>
                    <ol className="text-sm font-body text-muted-foreground space-y-1.5 list-decimal list-inside">
                      <li>Deschide aplicația de email</li>
                      <li>Caută un email de la <span className="text-foreground">SportRise</span></li>
                      <li>Apasă pe linkul de confirmare</li>
                      <li>Vei fi redirecționat automat în aplicație</li>
                    </ol>
                  </div>
                </>
              )}
              <p className="text-xs text-muted-foreground font-body">
                Nu ai primit emailul? Verifică folderul <span className="font-semibold">Spam / Junk</span> sau{" "}
                <button
                  onClick={() => setRegisteredEmail(null)}
                  className="text-primary underline underline-offset-2 hover:text-primary/80 transition-colors"
                >
                  încearcă din nou
                </button>.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
            <SportriseWordmark className="mx-auto mb-3 text-4xl" />
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
                        <Select value={role} onValueChange={(v) => setRole(v as "player" | "cauta_jucator")}>
                          <SelectTrigger className="w-full [&>span]:flex-1">
                            <SelectValue placeholder={t.auth.selectAccountType} />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="player" className="pr-8 [&>span]:flex-1">
                              <div className="flex flex-col items-center text-center w-full">
                                <span className="font-semibold text-sm">{t.auth.player}</span>
                                <span className="text-xs text-muted-foreground">{t.auth.playerDesc}</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="cauta_jucator" className="pr-8 [&>span]:flex-1">
                              <div className="flex flex-col items-center text-center w-full">
                                <span className="font-semibold text-sm">{t.auth.cautaJucator}</span>
                                <span className="text-xs text-muted-foreground">{t.auth.cautaJucatorDesc}</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fullName" className="font-body">{t.auth.fullName}</Label>
                        <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t.auth.fullNamePlaceholder} required />
                      </div>
                      {role === "player" && (
                        <>
                          <div className="space-y-2">
                            <Label className="font-body text-sm">{t.auth.sport}</Label>
                            <Select value={sport} onValueChange={setSport}>
                              <SelectTrigger className="w-full">
                                <SelectValue placeholder={t.auth.selectSport} />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="football">{t.auth.sportFootball}</SelectItem>
                                <SelectItem value="basketball">{t.auth.sportBasketball}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
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
                        </>
                      )}
                      {role === "player" && (
                        <div className="space-y-2">
                          <Label htmlFor="inviteCode" className="font-body text-sm">
                            Cod invitație <span className="text-muted-foreground font-normal">(opțional)</span>
                          </Label>
                          <Input
                            id="inviteCode"
                            value={inviteCode}
                            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                            placeholder="SPORT-XXXXX"
                            maxLength={11}
                            className="font-mono tracking-widest"
                          />
                          <p className="text-[11px] text-muted-foreground font-body leading-snug">
                            Ai primit un cod de la un prieten? Introdu-l aici.
                          </p>
                        </div>
                      )}
                      {role === "cauta_jucator" && (
                        <div className="space-y-2">
                          <Label className="font-body text-sm">{t.auth.sportsInterest}</Label>
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="w-full justify-between font-normal text-sm font-body h-10">
                                {selectedSports.length > 0
                                  ? `${selectedSports.length} ${t.auth.sportsSelected}`
                                  : t.auth.selectSports}
                                <ChevronDown className="h-4 w-4 opacity-50" />
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-2" align="start">
                              <div className="space-y-1">
                                {([
                                  { value: "football", label: t.auth.sportFootball },
                                  { value: "basketball", label: t.auth.sportBasketball },
                                ]).map((item) => (
                                  <label key={item.value} className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-all text-sm font-body hover:bg-muted">
                                    <Checkbox
                                      checked={selectedSports.includes(item.value)}
                                      onCheckedChange={(checked) => {
                                        setSelectedSports(prev =>
                                          checked ? [...prev, item.value] : prev.filter(s => s !== item.value)
                                        );
                                      }}
                                    />
                                    <span>{item.label}</span>
                                  </label>
                                ))}
                              </div>
                            </PopoverContent>
                          </Popover>
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
                       <Label htmlFor="confirmPassword" className="font-body">{t.auth.confirmPassword}</Label>
                       <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t.auth.passwordPlaceholder} required minLength={6} />
                     </div>
                   )}

                   {tab === "register" && REQUIRES_VERIFICATION.includes(role) && (
                     <div className="space-y-2">
                       <div className="flex items-center gap-1.5">
                         <Label className="font-body text-sm">
                           Document de verificare <span className="text-destructive">*</span>
                         </Label>
                         <Popover>
                           <PopoverTrigger asChild>
                             <button
                               type="button"
                               onClick={(e) => e.stopPropagation()}
                               className="p-1 -m-1 text-muted-foreground hover:text-primary transition-colors rounded-full"
                             >
                               <Info className="h-3.5 w-3.5" />
                             </button>
                           </PopoverTrigger>
                           <PopoverContent side="top" align="start" className="w-72 text-sm">
                             <p className="font-semibold mb-2">Ce documente sunt acceptate?</p>
                             <p className="text-muted-foreground mb-2">
                               Orice document care dovedește implicarea ta reală în scouting sau recrutarea de jucători, de exemplu:
                             </p>
                             <ul className="text-muted-foreground list-disc list-inside space-y-1">
                               <li>Legitimație sau card de scouter/impresar</li>
                               <li>Licență de agent de jucători (FIFA/FRF sau federație locală)</li>
                               <li>Contract sau adeverință de colaborare cu un club/academie</li>
                               <li>Certificat de la un curs de scouting</li>
                               <li>Extras Registrul Comerțului, dacă activezi printr-o firmă de scouting</li>
                             </ul>
                             <p className="text-muted-foreground mt-2">
                               Un administrator revizuiește manual documentul înainte de aprobare.
                             </p>
                           </PopoverContent>
                         </Popover>
                       </div>
                       <input
                         ref={fileInputRef}
                         type="file"
                         accept=".pdf,.jpg,.jpeg,.png,.webp"
                         className="hidden"
                         onChange={(e) => setScoutDocument(e.target.files?.[0] ?? null)}
                       />
                       <button
                         type="button"
                         onClick={() => fileInputRef.current?.click()}
                         className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border-2 border-dashed transition-colors text-sm font-body ${
                           scoutDocument
                             ? "border-primary bg-primary/5 text-foreground"
                             : "border-border hover:border-primary/50 text-muted-foreground"
                         }`}
                       >
                         {scoutDocument ? (
                           <><FileCheck className="h-4 w-4 text-primary shrink-0" /><span className="truncate">{scoutDocument.name}</span></>
                         ) : (
                           <><Upload className="h-4 w-4 shrink-0" /><span>Badge, certificat, legitimație scouter...</span></>
                         )}
                       </button>
                       <p className="text-[11px] text-muted-foreground font-body leading-snug">
                         Contul va fi activat după ce administratorul verifică documentul. Formate acceptate: PDF, JPG, PNG (max 10MB).
                       </p>
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
