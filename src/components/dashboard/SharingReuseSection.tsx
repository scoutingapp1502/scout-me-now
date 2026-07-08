import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";

type StoriesToStories = "everyone" | "followers_you_follow_back" | "off";

interface Config {
  storyShares: boolean;
  storiesToStories: StoriesToStories;
  postsToStories: boolean;
  repostsEnabled: boolean;
}

const DEFAULT_CONFIG: Config = {
  storyShares: true,
  storiesToStories: "everyone",
  postsToStories: true,
  repostsEnabled: true,
};

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

function RadioRow<T extends string>({
  value, current, labelRo, labelEn, lang, onSelect,
}: {
  value: T; current: T; labelRo: string; labelEn: string; lang: string; onSelect: (v: T) => void;
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

export default function SharingReuseSection({ userId, onBack }: SharingReuseSectionProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await (supabase as any)
        .from("user_privacy_settings")
        .select("story_shares_enabled, stories_to_stories, posts_to_stories_enabled, reposts_enabled")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) {
        setConfig({
          storyShares: data.story_shares_enabled ?? true,
          storiesToStories: data.stories_to_stories ?? "everyone",
          postsToStories: data.posts_to_stories_enabled ?? true,
          repostsEnabled: data.reposts_enabled ?? true,
        });
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
        stories_to_stories: next.storiesToStories,
        posts_to_stories_enabled: next.postsToStories,
        reposts_enabled: next.repostsEnabled,
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
        {/* ── Allow people to share your stories ── */}
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 pt-5 pb-2 font-body">
          {lang === "ro" ? "Permite distribuirea story-urilor tale" : "Allow people to share your stories"}
        </p>
        <div className="bg-card border-y border-border divide-y divide-border">
          {/* Story shares toggle */}
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-sm font-body text-foreground">
              {lang === "ro" ? "Distribuiri story" : "Story shares"}
            </span>
            <Toggle on={config.storyShares} onToggle={() => save({ storyShares: !config.storyShares })} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground font-body px-5 py-3 leading-relaxed border-b border-border">
          {lang === "ro"
            ? "Când este activat, persoanele pot trimite story-urile tale în mesaje."
            : "When this is on, people can send your stories in messages."}
        </p>

        {/* Stories to stories */}
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 pt-5 pb-2 font-body">
          {lang === "ro" ? "Story-uri în story-uri" : "Stories to stories"}
        </p>
        <div className="bg-card border-y border-border px-5 divide-y divide-border/60">
          <RadioRow value="everyone"                   current={config.storiesToStories} labelRo="Toată lumea"                        labelEn="Everyone"                    lang={lang} onSelect={v => save({ storiesToStories: v })} />
          <RadioRow value="followers_you_follow_back"  current={config.storiesToStories} labelRo="Urmăritori pe care îi urmărești"    labelEn="Followers you follow back"   lang={lang} onSelect={v => save({ storiesToStories: v })} />
          <RadioRow value="off"                        current={config.storiesToStories} labelRo="Dezactivat"                         labelEn="Off"                         lang={lang} onSelect={v => save({ storiesToStories: v })} />
        </div>
        <p className="text-xs text-muted-foreground font-body px-5 py-3 leading-relaxed border-b border-border">
          {lang === "ro"
            ? "Când este activat, audiența pe care o selectezi poate distribui story-urile tale în propriul story."
            : "When this is on, the audience that you select can share your stories to their story."}
        </p>

        {/* ── Allow people to share your posts and reels ── */}
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 pt-5 pb-2 font-body">
          {lang === "ro" ? "Permite distribuirea postărilor și reels-urilor tale" : "Allow people to share your posts and reels"}
        </p>
        <div className="bg-card border-y border-border divide-y divide-border">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-sm font-body text-foreground">
              {lang === "ro" ? "Postări și reels în story-uri" : "Posts and reels to stories"}
            </span>
            <Toggle on={config.postsToStories} onToggle={() => save({ postsToStories: !config.postsToStories })} />
          </div>
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-sm font-body text-foreground">
              {lang === "ro" ? "Repostări la postări și reels" : "Reposts on posts and reels"}
            </span>
            <Toggle on={config.repostsEnabled} onToggle={() => save({ repostsEnabled: !config.repostsEnabled })} />
          </div>
        </div>

        <div className="pb-10" />
      </div>
    </div>
  );
}
