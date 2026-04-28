import { Button } from "@/components/ui/button";
import { Flame, X, Trophy } from "lucide-react";

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
  const showPreview = daysUntilNextUnlock > 0 && !!nextTestLabel;
  const daysLabel = `${daysUntilNextUnlock} ${daysUntilNextUnlock === 1 ? "zi rămasă" : "zile rămase"}`;
  const previewHeading =
    daysUntilNextUnlock === 1
      ? "Mâine deblochezi"
      : `Peste ${daysUntilNextUnlock} zile deblochezi`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl border-2 border-primary/40 bg-card shadow-[0_0_60px_-10px_hsl(var(--primary)/0.5)] overflow-visible">
        {/* Close */}
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors z-10"
          aria-label="Închide"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Flame badge with streak number */}
        <div className="flex justify-center -mt-10">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-orange-500/40 blur-xl" />
            <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-orange-400 via-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/50 border-4 border-card">
              <Flame className="h-10 w-10 text-white absolute" fill="currentColor" />
              <span className="relative text-2xl font-black text-white drop-shadow-lg mt-1">
                {currentStreak}
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pt-4 pb-6 text-center">
          <h2 className="text-2xl font-extrabold text-foreground mb-3 flex items-center justify-center gap-2">
            Menține ritmul, campionule!
            <Flame className="h-6 w-6 text-orange-400" fill="currentColor" />
          </h2>

          <p className="text-sm text-muted-foreground leading-relaxed mb-2">
            Ai început seria de{" "}
            <span className="font-semibold text-foreground">{currentStreak} {currentStreak === 1 ? "zi" : "zile"}</span>.
            Loghează-te și mâine pentru a fi mai aproape de deblocarea testului tău special.
          </p>
          <p className="text-base font-bold text-orange-400 mb-5">
            {daysLabel}!
          </p>

          {showPreview && (
            <div className="mb-5 p-3 rounded-lg border border-primary/30 bg-primary/5 flex items-center gap-3 text-left">
              <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <Trophy className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
                  Mâine deblochezi
                </p>
                <p className="text-sm font-semibold text-foreground truncate">
                  {nextTestLabel}
                </p>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Button
              onClick={onContinue}
              className="w-full h-11 text-sm font-bold bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg shadow-orange-500/30 border-0"
            >
              AM ÎNȚELES, SPRE ANTRENAMENT!
            </Button>
            <Button
              variant="outline"
              onClick={onDismiss}
              className="w-full h-11 text-sm font-semibold border-primary/40 text-primary hover:bg-primary/10 hover:text-primary"
            >
              VEZI PROGRESUL MEU
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreakNotificationModal;
