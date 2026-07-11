import { useState, useEffect } from "react";
import { ArrowLeft, ChevronRight, CalendarDays, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface AboutSectionProps {
  userId: string;
  onBack: () => void;
}

// ── About your account sub-page ───────────────────────────────────────────────
function AboutAccountPage({ userId, lang, onBack }: { userId: string; lang: string; onBack: () => void }) {
  const { toast } = useToast();
  const [username, setUsername]     = useState("");
  const [photo, setPhoto]           = useState<string | null>(null);
  const [dateJoined, setDateJoined] = useState("");
  const [country, setCountry]       = useState("");

  useEffect(() => {
    const load = async () => {
      // Get auth user for created_at
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.created_at) {
        const d = new Date(user.created_at);
        setDateJoined(d.toLocaleDateString(lang === "ro" ? "ro-RO" : "en-US", { month: "long", year: "numeric" }));
      }

      // Try player profile first, then scout
      const { data: player } = await (supabase as any)
        .from("player_profiles")
        .select("username, photo_url, nationality")
        .eq("user_id", userId)
        .maybeSingle();

      if (player) {
        setUsername(player.username ?? "");
        setPhoto(player.photo_url ?? null);
        setCountry(player.nationality ?? "");
        return;
      }

      const { data: scout } = await (supabase as any)
        .from("scout_profiles")
        .select("username, photo_url, nationality")
        .eq("user_id", userId)
        .maybeSingle();

      if (scout) {
        setUsername(scout.username ?? "");
        setPhoto(scout.photo_url ?? null);
        setCountry(scout.nationality ?? "");
      }
    };
    load();
  }, [userId, lang]);

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground whitespace-nowrap">
          {lang === "ro" ? "Despre profilul tău" : "About your profile"}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Avatar + username + description */}
        <div className="flex flex-col items-center px-8 pt-8 pb-6 text-center">
          <Avatar className="h-20 w-20 mb-3">
            <AvatarImage src={photo ?? undefined} />
            <AvatarFallback>{(username || "?")[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          {username && (
            <p className="text-sm font-semibold font-body text-foreground mb-3">{username}</p>
          )}
          <p className="text-sm text-muted-foreground font-body leading-relaxed">
            {lang === "ro"
              ? "Pentru a menține comunitatea autentică, afișăm informații despre profiluri pe SportRise. Oamenii pot vedea acest lucru apăsând pe "
              : "To help keep our community authentic, we're showing information about profiles on SportRise. People can see this by tapping on the "}
            <span className="font-semibold">···</span>
            {lang === "ro"
              ? " din profilul tău și alegând Despre acest cont."
              : " on your profile and choosing About this account."}
          </p>
        </div>

        {/* Info rows */}
        <div className="bg-card border-y border-border divide-y divide-border">
          {dateJoined && (
            <div className="flex items-center gap-4 px-5 py-4">
              <CalendarDays className="h-5 w-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-sm font-semibold font-body text-foreground">
                  {lang === "ro" ? "Data înscrierii" : "Date joined"}
                </p>
                <p className="text-sm text-muted-foreground font-body">{dateJoined}</p>
              </div>
            </div>
          )}

          <button
            onClick={() => toast({ title: lang === "ro" ? "Funcționalitate în curând." : "Coming soon." })}
            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors text-left"
          >
            <MapPin className="h-5 w-5 text-muted-foreground shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-semibold font-body text-foreground">
                {lang === "ro" ? "Contul este bazat în" : "Account based in"}
              </p>
              <p className="text-sm text-muted-foreground font-body">{country || "—"}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main About section ────────────────────────────────────────────────────────
export default function AboutSection({ userId, onBack }: AboutSectionProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [subPage, setSubPage] = useState<"about-account" | null>(null);

  if (subPage === "about-account") {
    return <AboutAccountPage userId={userId} lang={lang} onBack={() => setSubPage(null)} />;
  }

  const soon = () => toast({ title: lang === "ro" ? "Funcționalitate în curând." : "Coming soon." });

  const rows = [
    { labelRo: "Despre contul tău",            labelEn: "About your account",     chevron: true,  action: () => setSubPage("about-account") },
    { labelRo: "Politica de confidențialitate", labelEn: "Privacy Policy",         chevron: true,  action: soon },
    { labelRo: "Termeni de utilizare",          labelEn: "Terms of Use",           chevron: true,  action: soon },
    { labelRo: "Biblioteci open-source",        labelEn: "Open-source libraries",  chevron: true,  action: soon },
    { labelRo: "Regulamentul UE 2021/1232",     labelEn: "EU regulation 2021/1232", chevron: false, action: soon },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground">
          {lang === "ro" ? "Despre" : "About"}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="bg-card border-y border-border divide-y divide-border mt-4">
          {rows.map((row) => (
            <button
              key={row.labelEn}
              onClick={row.action}
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors text-left"
            >
              <span className="text-sm font-body text-foreground">
                {lang === "ro" ? row.labelRo : row.labelEn}
              </span>
              {row.chevron && <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
