import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";

const STORAGE_KEY = "sportrise_feed_activity";
type FeedActivityValue = "followers" | "no_one";

interface FeedActivitySectionProps {
  userId: string;
  onBack: () => void;
}

export default function FeedActivitySection({ userId, onBack }: FeedActivitySectionProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [value, setValue] = useState<FeedActivityValue>("followers");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Load from localStorage first (instant), then verify from DB
    const cached = localStorage.getItem(STORAGE_KEY);
    if (cached === "no_one") setValue("no_one");

    const fetchFromDB = async () => {
      const { data } = await (supabase as any)
        .from("user_privacy_settings")
        .select("feed_activity_visibility")
        .eq("user_id", userId)
        .maybeSingle();
      if (data?.feed_activity_visibility) {
        setValue(data.feed_activity_visibility as FeedActivityValue);
        localStorage.setItem(STORAGE_KEY, data.feed_activity_visibility);
      }
    };
    fetchFromDB();
  }, [userId]);

  const handleSelect = async (v: FeedActivityValue) => {
    setValue(v);
    localStorage.setItem(STORAGE_KEY, v);
    setSaving(true);
    const { error } = await (supabase as any)
      .from("user_privacy_settings")
      .upsert({ user_id: userId, feed_activity_visibility: v, updated_at: new Date().toISOString() });
    setSaving(false);
    if (error) {
      toast({ title: lang === "ro" ? "Eroare la salvare." : "Save error.", variant: "destructive" });
    }
  };

  const options: { value: FeedActivityValue; labelRo: string; labelEn: string }[] = [
    { value: "followers", labelRo: "Urmăritorii pe care îi urmărești înapoi", labelEn: "Followers you follow back" },
    { value: "no_one",    labelRo: "Nimeni",                                   labelEn: "No one" },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground whitespace-nowrap">
          {lang === "ro" ? "Activitate în feed" : "Feed activity"}
        </h2>
        {saving && (
          <div className="ml-auto w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5">
        {/* Description */}
        <p className="text-sm text-muted-foreground font-body pt-5 pb-4 leading-relaxed">
          {lang === "ro"
            ? "Cine poate vedea aprecierile tale la postări în feed"
            : "Who can see your likes on posts in the feed"}
        </p>

        {/* Options */}
        <div className="divide-y divide-border">
          {options.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleSelect(opt.value)}
              className="w-full flex items-center justify-between py-4 hover:bg-muted/20 transition-colors text-left"
            >
              <span className="text-sm font-body text-foreground">
                {lang === "ro" ? opt.labelRo : opt.labelEn}
              </span>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${value === opt.value ? "border-foreground" : "border-muted-foreground/40"}`}>
                {value === opt.value && <div className="w-2.5 h-2.5 rounded-full bg-foreground" />}
              </div>
            </button>
          ))}
        </div>

        {/* Footer note */}
        <p className="text-xs text-muted-foreground font-body pt-4 leading-relaxed">
          {lang === "ro"
            ? "Alege cine poate vedea aprecierile tale la postări în feed."
            : "Choose who can see your likes on posts in the feed."}
        </p>
      </div>
    </div>
  );
}
