import { useState, useEffect, useRef } from "react";
import { Eye, EyeOff, ArrowLeft, ChevronDown, Upload, FileCheck, Info } from "lucide-react";
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
import SportriseWordmark from "@/components/SportriseWordmark";
import { MINIMUM_AGE, PARENTAL_CONSENT_AGE, SCOUT_MINIMUM_AGE, isAtLeastAge, latestDateOfBirthForAge } from "@/lib/age";
import { TERMS_VERSION, PRIVACY_VERSION } from "@/lib/legalVersions";

// Roles that must upload a verification document at signup and stay
// gated (dashboard visible, actions disabled) until an admin approves it.
const REQUIRES_VERIFICATION = ["cauta_jucator"];

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
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [sport, setSport] = useState("football");
  const [gender, setGender] = useState("");
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [inviteCode, setInviteCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const [scoutDocument, setScoutDocument] = useState<File | null>(null);
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [parentalConsent, setParentalConsent] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 13 and 14 are old enough to register but still need a parent/guardian
  // to confirm they know about it — a self-declared checkbox, not a
  // verified adult signature. Never applies to a Descoperitor account —
  // that role requires being an adult outright (SCOUT_MINIMUM_AGE), so
  // there's no minor range to gate with a consent checkbox in the first
  // place.
  const needsParentalConsent =
    role !== "cauta_jucator" &&
    !!dateOfBirth &&
    isAtLeastAge(dateOfBirth, MINIMUM_AGE) &&
    !isAtLeastAge(dateOfBirth, PARENTAL_CONSENT_AGE);

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
    const missingRequiredField =
      !fullName.trim() ||
      !dateOfBirth ||
      !email.trim() ||
      !password ||
      !confirmPassword ||
      (role === "player" && (!sport || !gender)) ||
      (role === "cauta_jucator" && selectedSports.length === 0);
    if (missingRequiredField) {
      toast({ title: t.auth.errorRegister, description: t.auth.requiredFieldsError, variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: t.auth.errorRegister, description: t.auth.passwordsMismatch, variant: "destructive" });
      return;
    }
    if (!isAtLeastAge(dateOfBirth, MINIMUM_AGE)) {
      toast({ title: t.auth.errorRegister, description: t.auth.minAgeError, variant: "destructive" });
      return;
    }
    if (role === "cauta_jucator" && !isAtLeastAge(dateOfBirth, SCOUT_MINIMUM_AGE)) {
      toast({ title: t.auth.errorRegister, description: (t as any).auth?.minAgeErrorScout ?? "You must be at least 18 years old to create a Scout account.", variant: "destructive" });
      return;
    }
    if (needsParentalConsent && !parentalConsent) {
      toast({ title: t.auth.errorRegister, description: t.auth.parentalConsentRequired, variant: "destructive" });
      return;
    }
    if (REQUIRES_VERIFICATION.includes(role) && !scoutDocument) {
      toast({ title: "Document lipsă", description: "Încarcă un document de verificare pentru acest tip de cont.", variant: "destructive" });
      return;
    }
    if (!agreedToTerms) {
      toast({ title: t.auth.errorRegister, description: t.auth.agreeTermsRequired, variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const metadata: Record<string, any> = {
        full_name: fullName, role, gender, sport, date_of_birth: dateOfBirth,
        terms_version: TERMS_VERSION, privacy_version: PRIVACY_VERSION,
        parental_consent: needsParentalConsent && parentalConsent,
      };
      const trimmedInviteCode = inviteCode.trim().toUpperCase();
      if (role === "player" && trimmedInviteCode) {
        metadata.invite_code = trimmedInviteCode;
      }
      if (role === "cauta_jucator") {
        metadata.sports = selectedSports;
      }
      const { data, error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin, data: metadata },
      });
      if (error) throw error;
      // NOTE: not gated on `data.user` — with email confirmation enabled,
      // Supabase's /signup response has no session, and the installed
      // @supabase/supabase-js (2.106.1) only reads a nested `data.user`
      // key from the raw response, with no fallback for the case where
      // GoTrue returns the user fields unwrapped (which is what it does
      // whenever no session is issued). That makes data.user always null
      // here, even on a successful signup. A null `error` after signUp is
      // otherwise a reliable enough success signal on its own.
      if (REQUIRES_VERIFICATION.includes(role) && scoutDocument) {
        try {
          const fileBase64 = await toBase64(scoutDocument);
          const { error: fnError } = await supabase.functions.invoke("submit-scout-document", {
            body: {
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
      // Goes through an Edge Function so the "is this the admin's email"
      // decision (admin password is only ever changed from the Supabase
      // dashboard) happens server-side and can't be probed from here.
      const { error } = await supabase.functions.invoke("request-password-reset", {
        body: { email, redirectTo: `${window.location.origin}/reset-password` },
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
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50 flex items-center justify-center p-4">
        <div className="absolute inset-0 opacity-5" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, #f97316 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }} />
        <div className="relative w-full max-w-md">
          <Card className="bg-white/95 backdrop-blur border-gray-200 shadow-2xl">
            <CardContent className="pt-8 pb-8 flex flex-col items-center text-center gap-5">
              <div className="w-16 h-16 rounded-full bg-orange-100 border-2 border-orange-500 flex items-center justify-center">
                {isScout ? (
                  <FileCheck className="h-8 w-8 text-orange-500" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                )}
              </div>
              {isScout ? (
                <>
                  <div className="space-y-2">
                    <h2 className="font-body text-xl font-bold tracking-tight text-gray-900">Cerere trimisă</h2>
                    <p className="text-gray-500 font-body text-sm leading-relaxed">
                      Vei fi notificat după verificarea documentului de către echipa SportRise.
                    </p>
                  </div>
                  <div className="bg-gray-100/50 rounded-lg p-4 text-left space-y-2 w-full">
                    <p className="text-sm font-body text-gray-900 font-semibold">Ce urmează:</p>
                    <ol className="text-sm font-body text-gray-500 space-y-1.5 list-decimal list-inside">
                      <li>Confirmă adresa de email <span className="text-gray-900 break-all">{registeredEmail}</span></li>
                      <li>Echipa SportRise verifică documentul tău</li>
                      <li>După aprobare vei primi acces complet</li>
                    </ol>
                  </div>
                </>
              ) : (
                <>
                  <div className="space-y-2">
                    <h2 className="font-body text-xl font-bold tracking-tight text-gray-900">Verifică-ți adresa de email</h2>
                    <p className="text-gray-500 font-body text-sm leading-relaxed">
                      Am trimis un email de confirmare la:
                    </p>
                    <p className="font-semibold text-orange-500 font-body text-sm break-all">{registeredEmail}</p>
                  </div>
                  <div className="bg-gray-100/50 rounded-lg p-4 text-left space-y-2 w-full">
                    <p className="text-sm font-body text-gray-900 font-semibold">Ce trebuie să faci:</p>
                    <ol className="text-sm font-body text-gray-500 space-y-1.5 list-decimal list-inside">
                      <li>Deschide aplicația de email</li>
                      <li>Caută un email de la <span className="text-gray-900">SportRise</span></li>
                      <li>Apasă pe linkul de confirmare</li>
                      <li>Vei fi redirecționat automat în aplicație</li>
                    </ol>
                  </div>
                </>
              )}
              <p className="text-xs text-gray-500 font-body">
                Nu ai primit emailul? Verifică folderul <span className="font-semibold">Spam / Junk</span> sau{" "}
                <button
                  onClick={() => setRegisteredEmail(null)}
                  className="text-orange-500 underline underline-offset-2 hover:text-orange-600 transition-colors"
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-5" style={{
        backgroundImage: `radial-gradient(circle at 2px 2px, #f97316 1px, transparent 0)`,
        backgroundSize: '40px 40px'
      }} />

      {/* Language toggle top-right */}
      <div className="absolute top-4 right-4 z-10">
        <LanguageToggle light />
      </div>

      <div className="relative w-full max-w-md">
        <Link to="/" className="inline-flex items-center gap-1 text-gray-500 hover:text-orange-500 mb-6 font-body text-sm">
          <ArrowLeft className="h-4 w-4" /> {t.auth.back}
        </Link>

        <Card className="bg-white/95 backdrop-blur border-gray-200 shadow-2xl">
          <CardHeader className="text-center pb-2">
            <SportriseWordmark className="mx-auto mb-3 text-lg" />
            <CardTitle className="font-body text-2xl font-bold tracking-tight text-gray-900">
              {tab === "register" ? t.auth.createAccount : tab === "forgot" ? t.auth.forgotPasswordTitle : t.auth.login}
            </CardTitle>
            <CardDescription className="font-body">
              {tab === "register" ? t.auth.registerDesc : tab === "forgot" ? t.auth.forgotPasswordDesc : t.auth.loginDesc}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {tab !== "forgot" && (
              <div className="flex mb-6 bg-gray-100 rounded-lg p-1">
                <button onClick={() => setTab("register")} className={`flex-1 py-2 rounded-md text-sm font-medium font-body transition-all ${tab === "register" ? "bg-orange-500 text-white shadow" : "text-gray-500 hover:text-gray-900"}`}>
                  {t.auth.tabRegister}
                </button>
                <button onClick={() => setTab("login")} className={`flex-1 py-2 rounded-md text-sm font-medium font-body transition-all ${tab === "login" ? "bg-orange-500 text-white shadow" : "text-gray-500 hover:text-gray-900"}`}>
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
                <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-5" disabled={loading}>
                  {loading ? t.auth.processing : t.auth.sendResetLink}
                </Button>
                <p className="text-center text-sm text-gray-500 mt-4 font-body">
                  <button onClick={() => setTab("login")} className="text-orange-500 hover:underline font-medium">{t.auth.backToLogin}</button>
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
                                <span className="text-xs text-gray-500">{t.auth.playerDesc}</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="cauta_jucator" className="pr-8 [&>span]:flex-1">
                              <div className="flex flex-col items-center text-center w-full">
                                <span className="font-semibold text-sm">{t.auth.cautaJucator}</span>
                                <span className="text-xs text-gray-500">{t.auth.cautaJucatorDesc}</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="fullName" className="font-body">{t.auth.fullName}</Label>
                        <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t.auth.fullNamePlaceholder} required />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dateOfBirth" className="font-body">{t.auth.dateOfBirth}</Label>
                        <Input
                          id="dateOfBirth"
                          type="date"
                          value={dateOfBirth}
                          onChange={(e) => setDateOfBirth(e.target.value)}
                          max={latestDateOfBirthForAge(role === "cauta_jucator" ? SCOUT_MINIMUM_AGE : MINIMUM_AGE)}
                          required
                        />
                        <p className="text-xs text-gray-500 font-body">
                          {role === "cauta_jucator"
                            ? ((t as any).auth?.dateOfBirthHintScout ?? "You must be at least 18 years old to create a Scout account.")
                            : t.auth.dateOfBirthHint}
                        </p>
                      </div>
                      {needsParentalConsent && (
                        <div className="flex items-start gap-2 bg-orange-50 border border-orange-200 rounded-lg p-3">
                          <Checkbox
                            id="parentalConsent"
                            checked={parentalConsent}
                            onCheckedChange={(v) => setParentalConsent(v === true)}
                            className="mt-0.5"
                          />
                          <Label htmlFor="parentalConsent" className="font-body text-sm text-gray-700 leading-snug cursor-pointer">
                            {t.auth.parentalConsentLabel}
                          </Label>
                        </div>
                      )}
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
                            Cod invitație <span className="text-gray-500 font-normal">(opțional)</span>
                          </Label>
                          <Input
                            id="inviteCode"
                            value={inviteCode}
                            onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                            placeholder="SPORT-XXXXX"
                            maxLength={11}
                            className="font-mono tracking-widest"
                          />
                          <p className="text-[11px] text-gray-500 font-body leading-snug">
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
                                  <label key={item.value} className="flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer transition-all text-sm font-body hover:bg-gray-100">
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
                      <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={t.auth.passwordPlaceholder} required minLength={8} className="pr-10" />
                      <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 transition-colors">
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                   </div>

                   {tab === "register" && (
                     <div className="space-y-2">
                       <Label htmlFor="confirmPassword" className="font-body">{t.auth.confirmPassword}</Label>
                       <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder={t.auth.passwordPlaceholder} required minLength={8} />
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
                               className="p-1 -m-1 text-gray-500 hover:text-orange-500 transition-colors rounded-full"
                             >
                               <Info className="h-3.5 w-3.5" />
                             </button>
                           </PopoverTrigger>
                           <PopoverContent side="top" align="start" className="w-72 text-sm">
                             <p className="font-semibold mb-2">Ce documente sunt acceptate?</p>
                             <p className="text-gray-500 mb-2">
                               Orice document care dovedește implicarea ta reală în scouting sau recrutarea de jucători, de exemplu:
                             </p>
                             <ul className="text-gray-500 list-disc list-inside space-y-1">
                               <li>Legitimație sau card de scouter/impresar</li>
                               <li>Licență de agent de jucători (FIFA/FRF sau federație locală)</li>
                               <li>Contract sau adeverință de colaborare cu un club/academie</li>
                               <li>Certificat de la un curs de scouting</li>
                               <li>Extras Registrul Comerțului, dacă activezi printr-o firmă de scouting</li>
                             </ul>
                             <p className="text-gray-500 mt-2">
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
                             ? "border-orange-500 bg-orange-50 text-gray-900"
                             : "border-gray-200 hover:border-orange-300 text-gray-500"
                         }`}
                       >
                         {scoutDocument ? (
                           <><FileCheck className="h-4 w-4 text-orange-500 shrink-0" /><span className="truncate">{scoutDocument.name}</span></>
                         ) : (
                           <><Upload className="h-4 w-4 shrink-0" /><span>Badge, certificat, legitimație scouter...</span></>
                         )}
                       </button>
                       <p className="text-[11px] text-gray-500 font-body leading-snug">
                         Contul va fi activat după ce administratorul verifică documentul. Formate acceptate: PDF, JPG, PNG (max 10MB).
                       </p>
                     </div>
                   )}

                   {tab === "login" && (
                    <div className="text-right">
                      <button type="button" onClick={() => setTab("forgot")} className="text-sm text-orange-500 hover:underline font-body">
                        {t.auth.forgotPassword}
                      </button>
                    </div>
                  )}

                  {tab === "register" && (
                    <label className="flex items-start gap-2.5 cursor-pointer">
                      <Checkbox
                        checked={agreedToTerms}
                        onCheckedChange={(checked) => setAgreedToTerms(checked === true)}
                        className="mt-0.5"
                      />
                      <span className="text-sm text-gray-600 font-body leading-snug">
                        {t.auth.agreeTermsPrefix}{" "}
                        <a href="/terms" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-orange-500 hover:underline font-medium">
                          {t.auth.termsOfUse}
                        </a>{" "}
                        {t.auth.and}{" "}
                        <a href="/privacy" target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-orange-500 hover:underline font-medium">
                          {t.auth.privacyPolicy}
                        </a>
                      </span>
                    </label>
                  )}

                  <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold py-5" disabled={loading || (tab === "register" && !agreedToTerms)}>
                    {loading ? t.auth.processing : tab === "register" ? t.auth.createBtn : t.auth.loginBtn}
                  </Button>
                </form>

                <p className="text-center text-sm text-gray-500 mt-4 font-body">
                  {tab === "register" ? (
                    <>{t.auth.hasAccount}{" "}<button onClick={() => setTab("login")} className="text-orange-500 hover:underline font-medium">{t.auth.loginLink}</button></>
                  ) : (
                    <>{t.auth.noAccount}{" "}<button onClick={() => setTab("register")} className="text-orange-500 hover:underline font-medium">{t.auth.registerLink}</button></>
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
