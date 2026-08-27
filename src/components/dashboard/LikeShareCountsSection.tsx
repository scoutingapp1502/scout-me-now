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
      className={`relative w-12 h-6 rounded-full transition-colors shrink-0 ${on ? "bg-orange-500" : "bg-gray-300"}`}
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
    <div className="flex flex-col h-full bg-white">
      <div className="relative flex items-center px-4 py-3 border-b border-gray-200 shrink-0">
        <button onClick={onBack} className="p-1 text-gray-500 hover:text-gray-900">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-gray-900 whitespace-nowrap">
          {lang === "ro" ? "Aprecieri" : "Like counts"}
        </h2>
        {saving && <div className="ml-auto w-4 h-4 border-2 border-orange-200 border-t-orange-500 rounded-full animate-spin" />}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="bg-white border-y border-gray-200">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-sm font-body text-gray-900 flex-1 pr-4">
              {lang === "ro" ? "Ascunde numărul de aprecieri" : "Hide like counts"}
            </span>
            <Toggle on={hideCounts} onToggle={() => save(!hideCounts)} />
          </div>
        </div>
        <p className="text-xs text-gray-500 font-body px-5 py-3 leading-relaxed">
          {lang === "ro"
            ? "Pe SportRise, numărul de aprecieri la postările și reels-urile altor conturi va fi ascuns pentru tine."
            : "On SportRise, the number of likes on posts and reels from other accounts will be hidden for you."}
        </p>
      </div>
    </div>
  );
}
