import { CHALLENGE_META, useWeeklyChallenge, WeeklyChallengeType } from "@/hooks/useWeeklyChallenge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Trophy, CheckCircle2, Clock } from "lucide-react";

interface Props {
  userId: string;
  viewerUserId: string | null;
  availableTests: string[];
  isOwner: boolean;
}

/**
 * Card cu provocarea săptămânală curentă + badge-uri câștigate.
 * - Pe profilul propriu: arată provocarea + status, motivează utilizatorul.
 * - Pe profilul vizitat: arată badge-urile recente (semnal pentru scouteri).
 */
export default function WeeklyChallengeCard({ userId, viewerUserId, availableTests, isOwner }: Props) {
  const wc = useWeeklyChallenge(userId, viewerUserId, availableTests, true);

  if (wc.loading) return null;

  // Pentru profil vizitat: afișează doar badge-urile recente, dacă există
  if (!isOwner) {
    if (wc.badges.length === 0) return null;
    return (
      <div className="bg-card border border-border rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="h-4 w-4 text-amber-400" />
          <h4 className="font-display text-sm text-foreground uppercase tracking-wide">
            Provocări săptămânale rezolvate
          </h4>
          <span className="text-xs text-muted-foreground">({wc.badges.length})</span>
        </div>
        <TooltipProvider>
          <div className="flex flex-wrap gap-2">
            {wc.badges.slice(0, 8).map((b) => {
              const meta = CHALLENGE_META[b.challenge_type as WeeklyChallengeType];
              return (
                <Tooltip key={b.week_start + b.challenge_type}>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 cursor-help">
                      <span className="text-base leading-none">{meta?.emoji ?? "🏆"}</span>
                      <span className="text-[11px] font-body text-foreground">{meta?.label ?? "Provocare"}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-xs max-w-[220px]">
                      Săptămâna {new Date(b.week_start).toLocaleDateString("ro-RO")} — {meta?.description}
                    </p>
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </TooltipProvider>
      </div>
    );
  }

  // Profil propriu
  const meta = wc.challengeType ? CHALLENGE_META[wc.challengeType] : null;
  const isCompleted = wc.status === "completed";

  return (
    <div className="bg-card border border-border rounded-2xl p-4 sm:p-5">
      <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-amber-400" />
          <h4 className="font-display text-sm text-foreground uppercase tracking-wide">
            Provocarea săptămânii
          </h4>
        </div>
        {wc.weekStart && (
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground font-body">
            <Clock className="h-3 w-3" />
            Resetează lunea
          </span>
        )}
      </div>

      {meta && (
        <div
          className={`p-3 rounded-lg border ${
            isCompleted
              ? "bg-emerald-500/10 border-emerald-500/30"
              : "bg-muted/30 border-border"
          }`}
        >
          <div className="flex items-start gap-3">
            <span className="text-2xl leading-none mt-0.5">{meta.emoji}</span>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-display text-foreground uppercase tracking-wide">
                  {meta.label}
                </p>
                {isCompleted && (
                  <span className="flex items-center gap-1 text-[10px] uppercase tracking-wide font-bold text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />
                    Rezolvată
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground font-body mt-1">{meta.description}</p>
              {!isCompleted && (
                <p className="text-[11px] text-primary font-body mt-2">
                  🎁 Recompensă: 1 test tehnic deblocat înainte de termen + badge vizibil scouterilor
                </p>
              )}
              {isCompleted && wc.unlockedTest && (
                <p className="text-[11px] text-emerald-400 font-body mt-2">
                  ✓ Ai deblocat un test tehnic + badge câștigat
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {wc.badges.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground font-body mb-2">
            Badge-uri câștigate ({wc.badges.length})
          </p>
          <TooltipProvider>
            <div className="flex flex-wrap gap-1.5">
              {wc.badges.slice(0, 10).map((b) => {
                const m = CHALLENGE_META[b.challenge_type as WeeklyChallengeType];
                return (
                  <Tooltip key={b.week_start + b.challenge_type}>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 cursor-help">
                        <span className="text-sm leading-none">{m?.emoji ?? "🏆"}</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="text-xs max-w-[220px]">
                        <strong>{m?.label}</strong>
                        <br />
                        Săptămâna {new Date(b.week_start).toLocaleDateString("ro-RO")}
                      </p>
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          </TooltipProvider>
        </div>
      )}
    </div>
  );
}
