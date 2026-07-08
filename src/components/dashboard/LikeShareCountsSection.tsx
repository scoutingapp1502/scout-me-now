import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";

interface LikeShareCountsSectionProps {
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

export default function LikeShareCountsSection({ userId, onBack }: LikeShareCountsSectionProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [hideCounts, setHideCounts] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase as any)
        .from("user_privacy_settings")
        .select("hide_like_share_counts")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) setHideCounts(data.hide_like_share_counts ?? false);
    };
    load();
  }, [userId]);

  const save = async (value: boolean) => {
    setHideCounts(value);
    setSaving(true);
    const { error } = await (supabase as any)
      .from("user_privacy_settings")
      .upsert({ user_id: userId, hide_like_share_counts: value, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) toast({ title: lang === "ro" ? "Eroare la salvare." : "Save error.", variant: "destructive" });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground whitespace-nowrap">
          {lang === "ro" ? "Aprecieri și distribuiri" : "Like and share counts"}
        </h2>
        {saving && <div className="ml-auto w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="bg-card border-y border-border">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-sm font-body text-foreground flex-1 pr-4">
              {lang === "ro" ? "Ascunde aprecierile și distribuirile" : "Hide like and share counts"}
            </span>
            <Toggle on={hideCounts} onToggle={() => save(!hideCounts)} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground font-body px-5 py-3 leading-relaxed">
          {lang === "ro"
            ? "Pe SportRise, numărul de aprecieri și distribuiri la postările și reels-urile altor conturi va fi ascuns. Poți ascunde numărul de aprecieri și distribuiri la propriile postări și reels din Setări avansate înainte de publicare."
            : "On SportRise, the number of likes and shares on posts and reels from other accounts will be hidden. You can hide the number of likes and shares on your own posts and reels by going to Advanced settings before sharing."}
        </p>
      </div>
    </div>
  );
}
