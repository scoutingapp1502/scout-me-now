import { useState } from "react";
import { ArrowLeft, ChevronRight, Search, LifeBuoy, AlertTriangle, UserCheck, BadgeCheck, MessageSquareWarning } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";

interface HelpSectionProps {
  onBack: () => void;
}

export default function HelpSection({ onBack }: HelpSectionProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();
  const [query, setQuery] = useState("");

  const soon = () => toast({ title: lang === "ro" ? "Funcționalitate în curând." : "Coming soon." });

  const mainRows = [
    {
      icon: AlertTriangle,
      labelRo: "Raportează o problemă",
      labelEn: "Report a problem",
      descRo: null,
      descEn: null,
    },
    {
      icon: UserCheck,
      labelRo: "Starea contului",
      labelEn: "Account status",
      descRo: "Verifică starea contului tău.",
      descEn: "Review your Account Status.",
    },
    {
      icon: BadgeCheck,
      labelRo: "SportRise Verificat",
      labelEn: "SportRise Verified",
      descRo: "Abonații primesc suport îmbunătățit, un insignă verificată și alte beneficii exclusive.",
      descEn: "Subscribers get enhanced support, a verified badge and other exclusive benefits.",
    },
  ];

  const activityRows = [
    {
      icon: MessageSquareWarning,
      labelRo: "Rapoarte și încălcări",
      labelEn: "Reports and violations",
      descRo: "Rapoarte, încălcări și orice solicitări de asistență privind monetizarea.",
      descEn: "Reports, violations and any monetisation support requests.",
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
          {lang === "ro" ? "Ajutor și asistență" : "Help and support"}
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Search */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2.5">
            <Search className="h-4 w-4 text-muted-foreground shrink-0" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onFocus={soon}
              placeholder={lang === "ro" ? "Caută articole de ajutor" : "Search help articles"}
              className="flex-1 bg-transparent text-sm font-body outline-none text-foreground placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Icon + title */}
        <div className="flex flex-col items-center px-8 py-8 text-center">
          <LifeBuoy className="h-20 w-20 text-primary mb-4" strokeWidth={1.2} />
          <p className="text-lg font-semibold font-heading text-foreground">
            {lang === "ro" ? "Ajutor și asistență" : "Help and support"}
          </p>
        </div>

        {/* Main rows */}
        <div className="bg-card border-y border-border divide-y divide-border">
          {mainRows.map((row) => {
            const Icon = row.icon;
            return (
              <button
                key={row.labelEn}
                onClick={soon}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors text-left"
              >
                <Icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body text-foreground">
                    {lang === "ro" ? row.labelRo : row.labelEn}
                  </p>
                  {(lang === "ro" ? row.descRo : row.descEn) && (
                    <p className="text-xs text-muted-foreground font-body mt-0.5 leading-relaxed">
                      {lang === "ro" ? row.descRo : row.descEn}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              </button>
            );
          })}
        </div>

        {/* Your support activity */}
        <p className="text-sm font-semibold font-body text-foreground px-5 pt-5 pb-2">
          {lang === "ro" ? "Activitatea ta de asistență" : "Your support activity"}
        </p>
        <div className="bg-card border-y border-border divide-y divide-border">
          {activityRows.map((row) => {
            const Icon = row.icon;
            return (
              <button
                key={row.labelEn}
                onClick={soon}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/30 transition-colors text-left"
              >
                <Icon className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-body text-foreground">
                    {lang === "ro" ? row.labelRo : row.labelEn}
                  </p>
                  <p className="text-xs text-muted-foreground font-body mt-0.5 leading-relaxed">
                    {lang === "ro" ? row.descRo : row.descEn}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
