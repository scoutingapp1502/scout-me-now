import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Info } from "lucide-react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useLanguage } from "@/i18n/LanguageContext";
import type { ProfileSection } from "@/hooks/useProfileCompletion";

interface ProfileCompletionBarProps {
  percentage: number;
  sections: ProfileSection[];
  onSectionClick?: (sectionKey: string) => void;
}

const ProfileCompletionBar = ({ percentage, sections, onSectionClick }: ProfileCompletionBarProps) => {
  const { lang } = useLanguage();
  const [expanded, setExpanded] = useState(true);

  if (percentage >= 100) return null;

  return (
    <div className="mb-6 rounded-xl border border-border bg-card shadow-sm overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-accent/30 transition-colors"
      >
        <h3 className="text-sm font-semibold text-foreground">
          {lang === "ro" ? "Completează-ți profilul" : "Complete your profile"}
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-lg font-bold text-primary">{percentage}%</span>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4">
          <Progress value={percentage} className="h-2.5 mb-4" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {sections.map((section) => (
              <button
                key={section.key}
                onClick={() => onSectionClick?.(section.key)}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                  section.completed
                    ? "text-muted-foreground"
                    : "text-foreground hover:bg-accent/50 cursor-pointer"
                }`}
                disabled={section.completed}
              >
                {section.completed ? (
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                )}
                <span className={section.completed ? "line-through" : "font-medium"}>
                  {lang === "ro" ? section.labelRo : section.labelEn}
                </span>
                {!section.completed && (
                  <span className="ml-auto text-xs text-muted-foreground">+{section.weight}%</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfileCompletionBar;
