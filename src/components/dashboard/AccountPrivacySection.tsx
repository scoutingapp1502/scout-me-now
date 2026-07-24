import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";

type AccountVisibility = "scouts_only" | "scouts_and_mutual" | "everyone";

interface AccountPrivacySectionProps {
  userId: string;
  onBack: () => void;
}

interface PrivacyConfig {
  visibility: AccountVisibility;
}

function RadioRow({
  value, current, labelRo, labelEn, lang, onSelect,
}: {
  value: AccountVisibility; current: AccountVisibility; labelRo: string; labelEn: string; lang: string; onSelect: (v: AccountVisibility) => void;
}) {
  return (
    <button onClick={() => onSelect(value)} className="w-full flex items-center justify-between py-3.5 hover:bg-muted/20 transition-colors text-left">
      <span className="text-sm font-body text-foreground">{lang === "ro" ? labelRo : labelEn}</span>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${current === value ? "border-foreground" : "border-muted-foreground/40"}`}>
        {current === value && <div className="w-2.5 h-2.5 rounded-full bg-foreground" />}
      </div>
    </button>
  );
}

const DESCRIPTIONS: Record<AccountVisibility, { ro: string; en: string }> = {
  scouts_only: {
    ro: "Profilul și postările tale sunt vizibile doar pentru utilizatorii cu rol de scouter sau agent. Ceilalți jucători nu te pot vedea.",
    en: "Your profile and posts are visible only to users with a scout or agent role. Other players can't see you.",
  },
  scouts_and_mutual: {
    ro: "Vizibil pentru scouteri și agenți, plus urmăritorii cu care ai o relație reciprocă (tu îi urmărești și ei te urmăresc înapoi).",
    en: "Visible to scouts and agents, plus followers you have a mutual relationship with (you follow them and they follow you back).",
  },
  everyone: {
    ro: "Profilul și postările tale sunt vizibile pentru orice utilizator autentificat din aplicație.",
    en: "Your profile and posts are visible to any authenticated user in the app.",
  },
};

export default function AccountPrivacySection({ userId, onBack }: AccountPrivacySectionProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [config, setConfig] = useState<PrivacyConfig>({ visibility: "scouts_only" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await (supabase as any)
        .from("user_privacy_settings")
        .select("account_visibility")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) {
        setConfig({
          visibility: (data.account_visibility as AccountVisibility) ?? "scouts_only",
        });
      }
    };
    fetch();
  }, [userId]);

  const save = async (patch: Partial<PrivacyConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    setSaving(true);
    const { error } = await (supabase as any)
      .from("user_privacy_settings")
      .upsert({
        user_id: userId,
        account_visibility: next.visibility,
        updated_at: new Date().toISOString(),
      });
    setSaving(false);
    if (error) toast({ title: lang === "ro" ? "Eroare la salvare." : "Save error.", variant: "destructive" });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground whitespace-nowrap">
          {lang === "ro" ? "Confidențialitate cont" : "Account privacy"}
        </h2>
        {saving && (
          <div className="ml-auto w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 space-y-0">
        {/* Visibility choice */}
        <div className="py-5 border-b border-border">
          <p className="text-sm font-semibold font-body text-foreground mb-1">
            {lang === "ro" ? "Cine îți poate vedea profilul și postările" : "Who can see your profile and posts"}
          </p>
          <p className="text-xs text-muted-foreground font-body mb-3 leading-relaxed">
            {lang === "ro"
              ? "Alege cine îți poate vedea profilul și postările."
              : "Choose who can see your profile and posts."}
          </p>
          <div className="divide-y divide-border/60">
            <RadioRow
              value="scouts_only"
              current={config.visibility}
              labelRo="Scouteri și agenți"
              labelEn="Scouts and agents"
              lang={lang}
              onSelect={(v) => save({ visibility: v })}
            />
            <RadioRow
              value="scouts_and_mutual"
              current={config.visibility}
              labelRo="Scouteri, agenți și urmăritorii pe care îi urmăresc înapoi"
              labelEn="Scouts, agents and followers who follow me back"
              lang={lang}
              onSelect={(v) => save({ visibility: v })}
            />
            <RadioRow
              value="everyone"
              current={config.visibility}
              labelRo="Toată lumea"
              labelEn="Everyone"
              lang={lang}
              onSelect={(v) => save({ visibility: v })}
            />
          </div>
          <p className="text-sm text-muted-foreground font-body leading-relaxed mt-3">
            {lang === "ro" ? DESCRIPTIONS[config.visibility].ro : DESCRIPTIONS[config.visibility].en}
          </p>
        </div>
      </div>
    </div>
  );
}
