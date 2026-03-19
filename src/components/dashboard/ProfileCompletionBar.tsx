import { Progress } from "@/components/ui/progress";
import { CheckCircle2, Circle } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import type { ProfileSection } from "@/hooks/useProfileCompletion";

interface ProfileCompletionBarProps {
  percentage: number;
  sections: ProfileSection[];
  onSectionClick?: (sectionKey: string) => void;
}

const ProfileCompletionBar = ({ percentage, sections, onSectionClick }: ProfileCompletionBarProps) => {
  const { lang } = useLanguage();

  if (percentage >= 100) return null;

  return (
    <div className="mb-6 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">
          {lang === "ro" ? "Completează-ți profilul" : "Complete your profile"}
        </h3>
        <span className="text-lg font-bold text-primary">{percentage}%</span>
      </div>

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
  );
};

export default ProfileCompletionBar;
