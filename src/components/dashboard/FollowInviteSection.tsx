import { useState, useEffect } from "react";
import {
  ArrowLeft, Users, Upload, Link, MessageCircle,
  Phone, Copy, Check,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { getOrCreateInviteCode } from "@/lib/inviteCode";

interface FollowInviteSectionProps {
  userId: string;
  onBack: () => void;
}

interface Config {
  autoConfirm: boolean;
  invitationCode: string;
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

// Brand icon SVGs (inline, no external deps)
function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current text-foreground">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

function SnapchatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current text-foreground">
      <path d="M12.166.006c.876-.014 3.519.249 4.946 2.883.471.864.355 2.32.276 3.337-.02.253-.04.49-.05.69l.175-.03c.226-.05.462-.11.713-.11.49 0 .935.167 1.213.457.252.26.366.595.32.956-.086.662-.735 1.05-1.237 1.25l-.1.04c.029.11.064.23.1.355.267.912.71 2.429.077 3.862-.71 1.609-2.308 2.553-4.754 2.807-.151.248-.36.672-.517 1.002-.265.564-.582 1.023-1.082 1.023-.253 0-.506-.096-.786-.2-.376-.138-.802-.294-1.46-.294-.67 0-1.113.158-1.5.299-.273.1-.525.194-.773.194-.476 0-.804-.43-1.073-.972-.16-.326-.373-.752-.524-1.003-2.42-.248-4.037-1.205-4.754-2.836-.631-1.437-.19-2.953.077-3.863.032-.11.062-.21.087-.305-.107-.043-.23-.094-.362-.155-.538-.248-1.11-.627-1.195-1.265-.046-.361.068-.696.32-.957.279-.29.723-.457 1.214-.457.249 0 .496.06.722.113l.144.03-.009-.128c-.073-.997-.19-2.51.273-3.369C8.571.252 11.29.02 12.166.006z"/>
    </svg>
  );
}

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current text-foreground">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
    </svg>
  );
}

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current text-foreground">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current text-foreground">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
    </svg>
  );
}

export default function FollowInviteSection({ userId, onBack }: FollowInviteSectionProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [config, setConfig] = useState<Config>({ autoConfirm: false, invitationCode: "" });
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [{ data }, code] = await Promise.all([
        (supabase as any)
          .from("user_privacy_settings")
          .select("auto_confirm_followers")
          .eq("user_id", userId)
          .maybeSingle(),
        getOrCreateInviteCode(userId),
      ]);

      setConfig({
        autoConfirm: data?.auto_confirm_followers ?? false,
        invitationCode: code,
      });
    };
    load();
  }, [userId]);

  const save = async (patch: Partial<Config>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    setSaving(true);
    await (supabase as any).from("user_privacy_settings").upsert({
      user_id: userId,
      auto_confirm_followers: next.autoConfirm,
      updated_at: new Date().toISOString(),
    });
    setSaving(false);
  };

  const inviteMessage = lang === "ro"
    ? `Hai pe SportRise! Folosește codul meu de invitație: ${config.invitationCode} pentru a te înregistra.`
    : `Join me on SportRise! Use my invitation code: ${config.invitationCode} to sign up.`;

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(inviteMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: lang === "ro" ? "Link copiat!" : "Link copied!" });
  };

  const shareOptions: {
    labelRo: string; labelEn: string;
    icon: React.ReactNode;
    action: () => void;
  }[] = [
    {
      labelRo: "Contacte", labelEn: "Contacts",
      icon: <Users className="h-5 w-5 text-foreground" />,
      action: () => { if (navigator.share) navigator.share({ text: inviteMessage }); },
    },
    {
      labelRo: "WhatsApp", labelEn: "WhatsApp",
      icon: <WhatsAppIcon />,
      action: () => window.open(`https://wa.me/?text=${encodeURIComponent(inviteMessage)}`, "_blank"),
    },
    {
      labelRo: "Invită prieteni via...", labelEn: "Invite friends via...",
      icon: <Upload className="h-5 w-5 text-foreground" />,
      action: () => { if (navigator.share) navigator.share({ text: inviteMessage }); },
    },
    {
      labelRo: "Copiază linkul de invitație", labelEn: "Copy invitation link",
      icon: copied ? <Check className="h-5 w-5 text-primary" /> : <Link className="h-5 w-5 text-foreground" />,
      action: handleCopyLink,
    },
    {
      labelRo: "Mesaje", labelEn: "Messages",
      icon: <MessageCircle className="h-5 w-5 text-foreground" />,
      action: () => window.open(`sms:?&body=${encodeURIComponent(inviteMessage)}`, "_blank"),
    },
    {
      labelRo: "Snapchat", labelEn: "Snapchat",
      icon: <SnapchatIcon />,
      action: () => { if (navigator.share) navigator.share({ text: inviteMessage }); },
    },
    {
      labelRo: "Facebook", labelEn: "Facebook",
      icon: <FacebookIcon />,
      action: () => window.open(`https://www.facebook.com/sharer/sharer.php?quote=${encodeURIComponent(inviteMessage)}`, "_blank"),
    },
    {
      labelRo: "X", labelEn: "X",
      icon: <XIcon />,
      action: () => window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(inviteMessage)}`, "_blank"),
    },
    {
      labelRo: "Instagram", labelEn: "Instagram",
      icon: <InstagramIcon />,
      action: async () => {
        await navigator.clipboard.writeText(inviteMessage);
        toast({ title: lang === "ro" ? "Mesaj copiat! Deschide Instagram și lipește-l." : "Message copied! Open Instagram and paste it." });
        window.open("https://www.instagram.com", "_blank");
      },
    },
  ];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground whitespace-nowrap">
          {lang === "ro" ? "Urmărire și invitare" : "Followers and invitations"}
        </h2>
        {saving && <div className="ml-auto w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />}
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* ── Followers section ── */}
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 pt-5 pb-2 font-body">
          {lang === "ro" ? "Urmăritori" : "Followers"}
        </p>
        <div className="bg-card border-y border-border divide-y divide-border">
          <div className="flex items-center justify-between px-5 py-4">
            <span className="text-sm font-body text-foreground flex-1 pr-4">
              {lang === "ro" ? "Confirmă automat pe oricine te..." : "Automatically confirm anyone that yo..."}
            </span>
            <Toggle on={config.autoConfirm} onToggle={() => save({ autoConfirm: !config.autoConfirm })} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground font-body px-5 py-3 leading-relaxed border-b border-border">
          {lang === "ro"
            ? "Confirmă automat cererile de urmărire de la persoanele care vor să te urmărească înapoi. Nu se va aplica creatorilor și companiilor."
            : "Automatically confirm follow requests from people who want to follow you back. This won't apply to creators and businesses."}
        </p>

        {/* ── Invite your friends ── */}
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-5 pt-5 pb-2 font-body">
          {lang === "ro" ? "Invită-ți prietenii" : "Invite your friends"}
        </p>

        {/* Invitation code display */}
        <div className="mx-5 mb-3 rounded-xl border border-border bg-card px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground font-body mb-0.5">
              {lang === "ro" ? "Codul tău de invitație" : "Your invitation code"}
            </p>
            <p className="text-lg font-heading font-bold text-primary tracking-widest">{config.invitationCode}</p>
          </div>
          <button onClick={handleCopyLink} className="p-2 rounded-lg hover:bg-muted/50 transition-colors">
            {copied ? <Check className="h-5 w-5 text-primary" /> : <Copy className="h-5 w-5 text-muted-foreground" />}
          </button>
        </div>

        {/* Share options */}
        <div className="bg-card border-y border-border divide-y divide-border">
          {shareOptions.map(opt => (
            <button
              key={opt.labelEn}
              onClick={opt.action}
              className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors text-left"
            >
              <div className="w-6 flex items-center justify-center shrink-0">{opt.icon}</div>
              <span className="text-sm font-body text-foreground">
                {lang === "ro" ? opt.labelRo : opt.labelEn}
              </span>
            </button>
          ))}
        </div>

        <div className="pb-10" />
      </div>
    </div>
  );
}
