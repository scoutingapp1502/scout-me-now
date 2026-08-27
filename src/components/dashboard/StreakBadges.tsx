import { Flame, Medal, Trophy } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useLanguage } from "@/i18n/LanguageContext";
import type { TranslationKeys } from "@/i18n/translations";

interface StreakBadgesProps {
  bestStreak: number;
  currentStreak?: number;
  /** Layout compact (mai mic), util pe carduri de listă. */
  compact?: boolean;
}

interface BadgeDef {
  threshold: number;
  label: string;
  description: string;
  icon: typeof Flame;
  gradient: string;
  ring: string;
  iconColor: string;
}

const getBadges = (tt: TranslationKeys["dashboard"]["tests"]): BadgeDef[] => [
  {
    threshold: 7,
    label: tt.badgeWeekLabel,
    description: tt.badgeWeekDesc,
    icon: Flame,
    gradient: "from-amber-500/20 to-orange-600/10",
    ring: "ring-amber-500/40",
    iconColor: "text-amber-400",
  },
  {
    threshold: 30,
    label: tt.badgeDedicatedLabel,
    description: tt.badgeDedicatedDesc,
    icon: Medal,
    gradient: "from-sky-500/20 to-indigo-600/10",
    ring: "ring-sky-400/40",
    iconColor: "text-sky-300",
  },
  {
    threshold: 100,
    label: tt.badgeProLabel,
    description: tt.badgeProDesc,
    icon: Trophy,
    gradient: "from-yellow-400/25 to-amber-600/15",
    ring: "ring-yellow-400/50",
    iconColor: "text-yellow-300",
  },
];

export default function StreakBadges({ bestStreak, currentStreak = 0, compact = false }: StreakBadgesProps) {
  const { t } = useLanguage();
  const tt = t.dashboard.tests;
  const BADGES = getBadges(tt);
  const reached = BADGES.filter((b) => bestStreak >= b.threshold);
  if (reached.length === 0) return null;

  const size = compact ? "h-7 w-7" : "h-9 w-9";
  const iconSize = compact ? "h-3.5 w-3.5" : "h-4 w-4";

  return (
    <TooltipProvider delayDuration={150}>
      <div className="flex items-center gap-1.5 flex-wrap">
        {reached.map((badge) => {
          const Icon = badge.icon;
          return (
            <Tooltip key={badge.threshold}>
              <TooltipTrigger asChild>
                <div
                  className={`${size} rounded-full bg-gradient-to-br ${badge.gradient} ring-1 ${badge.ring} flex items-center justify-center shadow-sm cursor-help`}
                  aria-label={badge.label}
                >
                  <Icon className={`${iconSize} ${badge.iconColor}`} />
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-[220px]">
                <p className="font-display text-xs uppercase tracking-wide">{badge.label}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{badge.description}</p>
                {currentStreak > 0 && (
                  <p className="text-[10px] text-muted-foreground/80 mt-1">
                    {tt.currentStreakLabel} {currentStreak} {currentStreak === 1 ? tt.dayWord : tt.daysWord}
                  </p>
                )}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}

export function getNextBadgeMilestone(bestStreak: number, tt: TranslationKeys["dashboard"]["tests"]): { threshold: number; label: string } | null {
  const next = getBadges(tt).find((b) => bestStreak < b.threshold);
  return next ? { threshold: next.threshold, label: next.label } : null;
}
