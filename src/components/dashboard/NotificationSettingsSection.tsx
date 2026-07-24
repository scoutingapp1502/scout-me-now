import { useState, useEffect } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const STORAGE_KEY = "sportrise_notif_settings";

interface NotifConfig {
  pauseAll: boolean;
  messagesOnly: boolean;
}

const DEFAULT_CONFIG: NotifConfig = { pauseAll: false, messagesOnly: false };

interface NotificationSettingsSectionProps {
  onBack: () => void;
  onNavigateToSleepMode?: () => void;
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

export default function NotificationSettingsSection({ onBack, onNavigateToSleepMode }: NotificationSettingsSectionProps) {
  const { lang } = useLanguage();
  const [config, setConfig] = useState<NotifConfig>(DEFAULT_CONFIG);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try { setConfig(JSON.parse(stored)); } catch {}
    }
  }, []);

  const update = (patch: Partial<NotifConfig>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground">
          {lang === "ro" ? "Notificări" : "Notifications"}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Section title */}
        <div className="px-5 pt-5 pb-2">
          <p className="text-sm font-semibold text-foreground font-body">
            {lang === "ro" ? "Notificări în aplicație" : "In-app notifications"}
          </p>
        </div>

        <div className="bg-card border-y border-border divide-y divide-border">
          {/* Pause all */}
          <div className="flex items-start gap-3 px-5 py-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-body text-foreground">
                {lang === "ro" ? "Pauză totală" : "Pause all"}
              </p>
              <p className="text-xs text-muted-foreground font-body mt-0.5 leading-relaxed">
                {lang === "ro"
                  ? "Notă: SportRise nu trimite notificări push în afara aplicației — aceasta e doar o preferință personală, salvată local pe acest dispozitiv."
                  : "Note: SportRise doesn't send push notifications outside the app — this is only a personal preference saved locally on this device."}
              </p>
            </div>
            <div className="pt-0.5">
              <Toggle on={config.pauseAll} onToggle={() => update({ pauseAll: !config.pauseAll })} />
            </div>
          </div>

          {/* Sleep mode */}
          <button
            onClick={onNavigateToSleepMode}
            className="w-full flex items-start gap-3 px-5 py-4 hover:bg-muted/30 transition-colors text-left"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-body text-foreground">
                {lang === "ro" ? "Mod somn" : "Sleep mode"}
              </p>
              <p className="text-xs text-muted-foreground font-body mt-0.5 leading-relaxed">
                {lang === "ro"
                  ? "Setează un interval orar de liniște, ca reamintire personală (nu afectează notificările altor persoane)."
                  : "Set a quiet-hours reminder for yourself (doesn't affect notifications for anyone else)."}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
          </button>

          {/* Messages only */}
          <div className="flex items-start gap-3 px-5 py-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-body text-foreground">
                {lang === "ro" ? "Doar mesaje" : "Messages only"}
              </p>
              <p className="text-xs text-muted-foreground font-body mt-0.5 leading-relaxed">
                {lang === "ro"
                  ? "Preferință personală salvată local pe acest dispozitiv."
                  : "Personal preference saved locally on this device."}
              </p>
            </div>
            <div className="pt-0.5">
              <Toggle on={config.messagesOnly} onToggle={() => update({ messagesOnly: !config.messagesOnly })} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
