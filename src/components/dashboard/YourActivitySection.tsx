import { ArrowLeft, ChevronRight, Heart, Trash2, RotateCcw, Timer } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import { useToast } from "@/hooks/use-toast";

interface YourActivitySectionProps {
  onBack: () => void;
  onNavigate: (section: string) => void;
}

interface ActivityItem {
  icon: React.ElementType;
  labelRo: string;
  labelEn: string;
  navigateTo?: string;
}

interface ActivityGroup {
  titleRo: string;
  titleEn: string;
  items: ActivityItem[];
}

const GROUPS: ActivityGroup[] = [
  {
    titleRo: "Interacțiuni",
    titleEn: "Interactions",
    items: [
      { icon: Heart, labelRo: "Aprecieri", labelEn: "Likes", navigateTo: "likes-activity" },
    ],
  },
  {
    titleRo: "Conținut eliminat și arhivat",
    titleEn: "Removed and archived content",
    items: [
      { icon: Trash2,    labelRo: "Șters recent",  labelEn: "Recently deleted", navigateTo: "recently-deleted" },
      { icon: RotateCcw, labelRo: "Arhivat",       labelEn: "Archived",        navigateTo: "archive" },
    ],
  },
  {
    titleRo: "Cum folosești SportRise",
    titleEn: "How you use SportRise",
    items: [
      { icon: Timer, labelRo: "Gestionarea timpului", labelEn: "Time management", navigateTo: "time-management" },
    ],
  },
];

export default function YourActivitySection({ onBack, onNavigate }: YourActivitySectionProps) {
  const { lang } = useLanguage();
  const { toast } = useToast();

  const handleItem = (item: ActivityItem) => {
    if (item.navigateTo) {
      onNavigate(item.navigateTo);
    } else {
      toast({ title: lang === "ro" ? "Funcționalitate în curând." : "Coming soon." });
    }
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="relative flex items-center px-4 py-3 border-b border-border shrink-0">
        <button onClick={onBack} className="p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h2 className="absolute left-1/2 -translate-x-1/2 font-heading text-sm tracking-wide text-foreground">
          {lang === "ro" ? "Activitatea ta" : "Your activity"}
        </h2>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {/* Hero */}
        <div className="px-6 py-8 text-center">
          <h1 className="font-heading text-2xl text-foreground mb-2 leading-tight">
            {lang === "ro" ? "Un singur loc pentru\nactivitatea ta" : "One place to manage\nyour activity"}
          </h1>
          <p className="text-sm text-muted-foreground font-body leading-relaxed">
            {lang === "ro"
              ? "Vizualizează și gestionează interacțiunile, conținutul și activitatea ta."
              : "View and manage your interactions, content and activity."}
          </p>
        </div>

        {/* Groups */}
        {GROUPS.map((group) => (
          <div key={group.titleEn} className="mb-2">
            <p className="text-xs text-muted-foreground font-body px-4 py-2 uppercase tracking-wider">
              {lang === "ro" ? group.titleRo : group.titleEn}
            </p>
            <div className="bg-card border-y border-border">
              {group.items.map((item, i) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.labelEn}
                    onClick={() => handleItem(item)}
                    className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 transition-colors text-left ${i > 0 ? "border-t border-border" : ""}`}
                  >
                    <Icon className="h-5 w-5 text-foreground shrink-0" />
                    <span className="flex-1 text-sm text-foreground font-body">
                      {lang === "ro" ? item.labelRo : item.labelEn}
                    </span>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                );
              })}
            </div>
          </div>
        ))}

        <div className="h-8" />
      </div>
    </div>
  );
}
