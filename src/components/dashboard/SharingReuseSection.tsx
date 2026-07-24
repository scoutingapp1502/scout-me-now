import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";

interface Config {
  storyShares: boolean;
}

const DEFAULT_CONFIG: Config = { storyShares: true };

interface SharingReuseSectionProps {
  userId: string;
  onBack: () => void;
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

export default function SharingReuseSection({ userId, onBack }: SharingReuseSectionProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase as any)
        .from("user_privacy_settings")
        .select("story_shares_enabled")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) {
        setConfig({ storyShares: data.story_shares_enabled ?? true });
      }
    };
    load();
  }, [userId]);

  const save = async (patch: Partial<Config>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    setSaving(true);
    const { error } = await (supabase as any)
      .from("user_privacy_settings")
      .upsert({
        user_id: userId,
        story_shares_enabled: next.storyShares,
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
          {lang === "ro" ? "Distribuire și reutilizare" : "Sharing and reuse"}
        </h2>
        {saving && <div className="ml-auto w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />}
      </div>

      <div className="flex-1 overflow-y-auto">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 pt-5 pb-2 font-body">
          {lang === "ro" ? "Permite distribuirea story-urilor tale" : "Allow people to share your stories"}
        </p>
        <div className="bg-card border-y border-border divide-y divide-border">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-sm font-body text-foreground">
              {lang === "ro" ? "Distribuiri story" : "Story shares"}
            </span>
            <Toggle on={config.storyShares} onToggle={() => save({ storyShares: !config.storyShares })} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground font-body px-5 py-3 leading-relaxed">
          {lang === "ro"
            ? "Când este activat, persoanele pot trimite story-urile tale în mesaje."
            : "When this is on, people can send your stories in messages."}
        </p>

        <div className="pb-10" />
      </div>
    </div>
  );
}
