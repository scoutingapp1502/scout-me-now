import { useState, useEffect } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";

type MsgRequestsValue = "everyone" | "followers" | "no_one";
type GroupChatValue   = "everyone" | "following_or_messaged";
type StoryRepliesValue = "everyone" | "followers" | "no_one";

interface Config {
  messageRequests: MsgRequestsValue;
  groupChat: GroupChatValue;
  storyReplies: StoryRepliesValue;
}

const DEFAULT_CONFIG: Config = {
  messageRequests: "everyone",
  groupChat: "everyone",
  storyReplies: "everyone",
};

interface MessagesRepliesSectionProps {
  userId: string;
  onBack: () => void;
}

function RadioRow<T extends string>({
  value,
  current,
  labelRo,
  labelEn,
  lang,
  onSelect,
}: {
  value: T;
  current: T;
  labelRo: string;
  labelEn: string;
  lang: string;
  onSelect: (v: T) => void;
}) {
  return (
    <button
      onClick={() => onSelect(value)}
      className="w-full flex items-center justify-between py-3.5 hover:bg-muted/20 transition-colors text-left"
    >
      <span className="text-sm font-body text-foreground">{lang === "ro" ? labelRo : labelEn}</span>
      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${current === value ? "border-foreground" : "border-muted-foreground/40"}`}>
        {current === value && <div className="w-2.5 h-2.5 rounded-full bg-foreground" />}
      </div>
    </button>
  );
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

// ── Message Requests sub-page ─────────────────────────────────────────────────
function MessageRequestsPage({
  config,
  saving,
  onSave,
  onBack,
}: {
  config: Config;
  saving: boolean;
  onSave: (patch: Partial<Config>) => void;
  onBack: () => void;
}) {
  const { lang } = useLanguage();

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground whitespace-nowrap">
          {lang === "ro" ? "Solicitări de mesaje" : "Message requests"}
        </h2>
        {saving && <div className="ml-auto w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />}
      </div>

      <div className="flex-1 overflow-y-auto px-5">
        {/* Intro */}
        <p className="text-sm text-muted-foreground font-body pt-5 pb-1 leading-relaxed">
          {lang === "ro"
            ? "Când cineva pe care nu îl urmărești sau cu care nu ai mai vorbit îți trimite un mesaj, îl primești ca solicitare de mesaj."
            : "When someone who you don't follow or haven't chatted with before sends you a message, you receive it as a message request."}
        </p>

        {/* Who can send message requests */}
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-1">
          {lang === "ro" ? "Cine îți poate trimite solicitări de mesaje" : "Who can send you message requests"}
        </p>
        <div className="divide-y divide-border/60">
          <RadioRow value="everyone"   current={config.messageRequests} labelRo="Toată lumea"      labelEn="Everyone"        lang={lang} onSelect={v => onSave({ messageRequests: v })} />
          <RadioRow value="followers"  current={config.messageRequests} labelRo="Urmăritorii tăi"  labelEn="Your followers"  lang={lang} onSelect={v => onSave({ messageRequests: v })} />
          <RadioRow value="no_one"     current={config.messageRequests} labelRo="Nimeni"            labelEn="No one"          lang={lang} onSelect={v => onSave({ messageRequests: v })} />
        </div>
        <p className="text-xs text-muted-foreground font-body py-3 leading-relaxed border-b border-border">
          {lang === "ro"
            ? "Persoanele pe care le urmărești sau cu care ai vorbit pot întotdeauna să îți trimită mesaje, dacă nu le-ai blocat."
            : "People that you follow or have chatted with before can always send you messages unless you block them."}
        </p>
      </div>
    </div>
  );
}

// ── Group Requests sub-page ───────────────────────────────────────────────────
function GroupRequestsPage({
  config,
  saving,
  onSave,
  onBack,
}: {
  config: Config;
  saving: boolean;
  onSave: (patch: Partial<Config>) => void;
  onBack: () => void;
}) {
  const { lang } = useLanguage();

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground whitespace-nowrap">
          {lang === "ro" ? "Solicitări de grup" : "Group requests"}
        </h2>
        {saving && <div className="ml-auto w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />}
      </div>

      <div className="flex-1 overflow-y-auto px-5">
        <p className="text-sm text-muted-foreground font-body pt-5 pb-1 leading-relaxed">
          {lang === "ro"
            ? "Alege cine te poate adăuga direct într-o conversație de grup."
            : "Choose who can add you directly to a group chat."}
        </p>

        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider pt-4 pb-1">
          {lang === "ro" ? "Cine te poate adăuga în conversații de grup" : "Who can add you to group chats"}
        </p>
        <div className="divide-y divide-border/60">
          <RadioRow value="everyone"              current={config.groupChat} labelRo="Toată lumea"                              labelEn="Everyone"                                        lang={lang} onSelect={v => onSave({ groupChat: v })} />
          <RadioRow value="following_or_messaged" current={config.groupChat} labelRo="Doar cei pe care îi urmăresc"             labelEn="Only people that I follow"                       lang={lang} onSelect={v => onSave({ groupChat: v })} />
        </div>
        <p className="text-xs text-muted-foreground font-body py-3 leading-relaxed border-b border-border">
          {lang === "ro"
            ? "Persoanele care te urmăresc sau cu care ai vorbit deja pot întotdeauna să te adauge într-un grup nou. Persoanele pe care le-ai blocat nu te pot adăuga niciodată."
            : "People that follow you or that you've already chatted with can always add you to a new group. People that you've blocked can never add you."}
        </p>
      </div>
    </div>
  );
}

// ── Story Replies sub-page ────────────────────────────────────────────────────
function StoryRepliesPage({
  config,
  saving,
  onSave,
  onBack,
}: {
  config: Config;
  saving: boolean;
  onSave: (patch: Partial<Config>) => void;
  onBack: () => void;
}) {
  const { lang } = useLanguage();

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground whitespace-nowrap">
          {lang === "ro" ? "Răspunsuri la story" : "Story replies"}
        </h2>
        {saving && <div className="ml-auto w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />}
      </div>

      <div className="flex-1 overflow-y-auto px-5">
        <p className="text-xs text-muted-foreground font-body pt-5 pb-3 leading-relaxed">
          {lang === "ro" ? "Cine poate răspunde la story-urile tale" : "Who can reply to your stories"}
        </p>
        <div className="divide-y divide-border/60">
          <RadioRow value="everyone"  current={config.storyReplies} labelRo="Permite răspunsuri la story de la toată lumea"       labelEn="Allow story replies from everyone"                       lang={lang} onSelect={v => onSave({ storyReplies: v })} />
          <RadioRow value="followers" current={config.storyReplies} labelRo="Permite răspunsuri la story doar de la cei urmăriți" labelEn="Only allow story replies from people that you follow"    lang={lang} onSelect={v => onSave({ storyReplies: v })} />
          <RadioRow value="no_one"    current={config.storyReplies} labelRo="Nu permite răspunsuri la story"                      labelEn="Don't allow story replies"                              lang={lang} onSelect={v => onSave({ storyReplies: v })} />
        </div>
      </div>
    </div>
  );
}

// ── Main MessagesRepliesSection ───────────────────────────────────────────────
export default function MessagesRepliesSection({ userId, onBack }: MessagesRepliesSectionProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
  const [subPage, setSubPage] = useState<"message-requests" | "group-requests" | "story-replies" | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await (supabase as any)
        .from("user_privacy_settings")
        .select("message_requests_visibility, group_chat_visibility, story_replies_visibility")
        .eq("user_id", userId)
        .maybeSingle();
      if (data) {
        setConfig({
          messageRequests: data.message_requests_visibility ?? "everyone",
          groupChat: data.group_chat_visibility ?? "everyone",
          storyReplies: data.story_replies_visibility ?? "everyone",
        });
      }
    };
    fetch();
  }, [userId]);

  const save = async (patch: Partial<Config>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    setSaving(true);
    const { error } = await (supabase as any)
      .from("user_privacy_settings")
      .upsert({
        user_id: userId,
        message_requests_visibility: next.messageRequests,
        group_chat_visibility: next.groupChat,
        story_replies_visibility: next.storyReplies,
        updated_at: new Date().toISOString(),
      });
    setSaving(false);
    if (error) toast({ title: lang === "ro" ? "Eroare la salvare." : "Save error.", variant: "destructive" });
  };

  const labelMsgReq = () => {
    const map: Record<MsgRequestsValue, { ro: string; en: string }> = {
      everyone:  { ro: "Toată lumea", en: "Everyone" },
      followers: { ro: "Urmăritori",  en: "Followers" },
      no_one:    { ro: "Nimeni",      en: "No one" },
    };
    return lang === "ro" ? map[config.messageRequests].ro : map[config.messageRequests].en;
  };

  const labelStory = () => {
    const map: Record<StoryRepliesValue, { ro: string; en: string }> = {
      everyone:  { ro: "Toată lumea", en: "Everyone" },
      followers: { ro: "Urmăritori",  en: "Followers" },
      no_one:    { ro: "Nimeni",      en: "No one" },
    };
    return lang === "ro" ? map[config.storyReplies].ro : map[config.storyReplies].en;
  };

  const labelGroupChat = () => {
    const map: Record<GroupChatValue, { ro: string; en: string }> = {
      everyone:              { ro: "Toată lumea",                  en: "Everyone" },
      following_or_messaged: { ro: "Cei pe care îi urmăresc",       en: "People I follow" },
    };
    return lang === "ro" ? map[config.groupChat].ro : map[config.groupChat].en;
  };

  if (subPage === "message-requests") {
    return <MessageRequestsPage config={config} saving={saving} onSave={save} onBack={() => setSubPage(null)} />;
  }

  if (subPage === "group-requests") {
    return <GroupRequestsPage config={config} saving={saving} onSave={save} onBack={() => setSubPage(null)} />;
  }

  if (subPage === "story-replies") {
    return <StoryRepliesPage config={config} saving={saving} onSave={save} onBack={() => setSubPage(null)} />;
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground whitespace-nowrap">
          {lang === "ro" ? "Mesaje și răspunsuri" : "Messages and story replies"}
        </h2>
        {saving && <div className="ml-auto w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />}
      </div>

      <div className="flex-1 overflow-y-auto">
        <p className="text-xs text-muted-foreground font-body uppercase tracking-wider px-5 pt-5 pb-2">
          {lang === "ro" ? "Cum te pot contacta" : "How people can reach you"}
        </p>
        <div className="bg-card border-y border-border divide-y divide-border">
          <button onClick={() => setSubPage("message-requests")} className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
            <span className="text-sm font-body text-foreground">{lang === "ro" ? "Solicitări de mesaje" : "Message requests"}</span>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground font-body">{labelMsgReq()}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
          <button onClick={() => setSubPage("group-requests")} className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
            <span className="text-sm font-body text-foreground">{lang === "ro" ? "Solicitări de grup" : "Group requests"}</span>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground font-body">{labelGroupChat()}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
          <button onClick={() => setSubPage("story-replies")} className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors">
            <span className="text-sm font-body text-foreground">{lang === "ro" ? "Răspunsuri la story" : "Story replies"}</span>
            <div className="flex items-center gap-1">
              <span className="text-sm text-muted-foreground font-body">{labelStory()}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}
