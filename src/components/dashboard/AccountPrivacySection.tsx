import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";

interface AccountPrivacySectionProps {
  userId: string;
  onBack: () => void;
}

interface PrivacyConfig {
  isPrivate: boolean;
  allowPicExpansion: boolean;
}

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${on ? "bg-primary" : "bg-muted-foreground/30"}`}
    >
      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${on ? "translate-x-6" : "translate-x-0.5"}`} />
    </button>
  );
}

export default function AccountPrivacySection({ userId, onBack }: AccountPrivacySectionProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [config, setConfig] = useState<PrivacyConfig>({ isPrivate: false, allowPicExpansion: false });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await (supabase as any)
        .from("user_privacy_settings")
        .select("is_private_account, allow_profile_pic_expansion")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) {
        setConfig({
          isPrivate: data.is_private_account ?? false,
          allowPicExpansion: data.allow_profile_pic_expansion ?? false,
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
        is_private_account: next.isPrivate,
        allow_profile_pic_expansion: next.allowPicExpansion,
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
        {/* Private account */}
        <div className="py-5 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold font-body text-foreground">
              {lang === "ro" ? "Cont privat" : "Private account"}
            </span>
            <Toggle on={config.isPrivate} onToggle={() => save({ isPrivate: !config.isPrivate })} />
          </div>
          {!config.isPrivate ? (
            <p className="text-sm text-muted-foreground font-body leading-relaxed">
              {lang === "ro"
                ? "Când contul tău este public, profilul și postările tale pot fi văzute de oricine, indiferent dacă are sau nu un cont SportRise."
                : "When your account is public, your profile and posts can be seen by anyone, on or off SportRise, even if they don't have a SportRise account."}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground font-body leading-relaxed">
              {lang === "ro"
                ? "Când contul tău este privat, numai urmăritorii pe care îi aprobi pot vedea ce distribui, inclusiv fotografiile sau videoclipurile tale, și listele tale de urmăritori și urmăriri. Anumite informații din profilul tău, cum ar fi poza de profil și numele de utilizator, sunt vizibile pentru toată lumea."
                : "When your account is private, only the followers that you approve can see what you share, including your photos or videos, and your followers and following lists. Certain info on your profile, such as your profile picture and username, is visible to everyone."}
            </p>
          )}
        </div>

        {/* Allow profile picture expansion */}
        <div className="py-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold font-body text-foreground">
              {lang === "ro" ? "Permite extinderea pozei de profil" : "Allow profile picture expansion"}
            </span>
            <Toggle on={config.allowPicExpansion} onToggle={() => save({ allowPicExpansion: !config.allowPicExpansion })} />
          </div>
          <p className="text-sm text-muted-foreground font-body leading-relaxed">
            {lang === "ro"
              ? "Permite oamenilor să vadă o versiune mai mare a pozei tale de profil pentru a te recunoaște mai ușor. Poza ta de profil va fi întotdeauna vizibilă pentru toată lumea."
              : "Let people see a larger version of your profile picture to help them know that it's you. Your profile picture will always be visible to everyone."}
          </p>
        </div>
      </div>
    </div>
  );
}
