import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Flame, X, Trophy, Sparkles } from "lucide-react";

interface StreakNotificationModalProps {
  currentStreak: number;
  required: number;
  daysUntilNextUnlock: number;
  nextTestPreview: string | null;
  nextTestLabel: string | null;
  onContinue: () => void;
  onDismiss: () => void;
}

const StreakNotificationModal = ({
  currentStreak,
  required,
  daysUntilNextUnlock,
  nextTestPreview,
  nextTestLabel,
  onContinue,
  onDismiss,
}: StreakNotificationModalProps) => {
  const percentage = Math.min(100, Math.round((currentStreak / required) * 100));
  const showPreview = daysUntilNextUnlock === 1 && nextTestLabel;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500/20 via-primary/20 to-primary/5 p-6 pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-400" />
              <h2 className="text-lg font-bold text-foreground">
                Continuă seria!
              </h2>
            </div>
            <button
              onClick={onDismiss}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <Progress value={percentage} className="h-2 flex-1" />
            <span className="text-sm font-bold text-primary">
              {currentStreak}/{required}
            </span>
          </div>
        </div>

        {/* Body */}
        <div className="p-6">
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-4 py-1.5 text-sm font-medium text-orange-400 mb-3">
              <Sparkles className="h-3.5 w-3.5" />
              Streak activ
            </div>
            <h3 className="text-xl font-bold text-foreground mb-2">
              Ești în ziua {currentStreak} din {required}
            </h3>
            <p className="text-sm text-muted-foreground">
              Mai ai{" "}
              <span className="font-semibold text-foreground">
                {daysUntilNextUnlock} {daysUntilNextUnlock === 1 ? "zi" : "zile"}
              </span>{" "}
              consecutive pentru a debloca un nou Test Atletic.
            </p>
          </div>

          {showPreview && (
            <div className="mt-4 p-4 rounded-lg border border-primary/30 bg-primary/5 flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Trophy className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs uppercase tracking-wide text-muted-foreground mb-0.5">
                  Mâine deblochezi
                </p>
                <p className="text-sm font-semibold text-foreground">
                  {nextTestLabel}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border p-4">
          <Button
            variant="outline"
            size="sm"
            onClick={onDismiss}
            className="border-muted-foreground/50 text-muted-foreground hover:text-foreground"
          >
            Mai târziu
          </Button>
          <Button size="sm" onClick={onContinue}>
            <Flame className="h-4 w-4 mr-1" />
            Continuă seria
          </Button>
        </div>
      </div>
    </div>
  );
};

export default StreakNotificationModal;
