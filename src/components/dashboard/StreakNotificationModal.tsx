import { Button } from "@/components/ui/button";
import { Flame, X, Trophy } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

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
  const { t } = useLanguage();
  const tt = t.dashboard.tests;
  const showPreview = daysUntilNextUnlock > 0 && !!nextTestLabel;
  const daysLabel = `${daysUntilNextUnlock} ${daysUntilNextUnlock === 1 ? tt.dayLeftWord : tt.daysLeftWord}`;
  const previewHeading =
    daysUntilNextUnlock === 1
      ? tt.tomorrowUnlock
      : `${tt.inDaysUnlockPrefix} ${daysUntilNextUnlock} ${tt.daysWord} ${tt.inDaysUnlockSuffix}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl border-2 border-orange-300 bg-white shadow-[0_0_60px_-10px_rgba(249,115,22,0.5)] overflow-visible">
        {/* Close */}
        <button
          onClick={onDismiss}
          className="absolute top-3 right-3 text-gray-500 hover:text-gray-900 transition-colors z-10"
          aria-label={tt.closeAria}
        >
          <X className="h-5 w-5" />
        </button>

        {/* Flame badge with streak number */}
        <div className="flex justify-center -mt-10">
          <div className="relative">
            <div className="absolute inset-0 rounded-full bg-orange-500/40 blur-xl" />
            <div className="relative h-20 w-20 rounded-full bg-gradient-to-br from-orange-400 via-orange-500 to-red-600 flex items-center justify-center shadow-lg shadow-orange-500/50 border-4 border-white">
              <Flame className="h-10 w-10 text-white absolute" fill="currentColor" />
              <span className="relative text-2xl font-black text-white drop-shadow-lg mt-1">
                {currentStreak}
              </span>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 pt-4 pb-6 text-center">
          <h2 className="text-2xl font-extrabold text-gray-900 mb-3 flex items-center justify-center gap-2">
            {tt.keepPaceTitle}
            <Flame className="h-6 w-6 text-orange-500" fill="currentColor" />
          </h2>

          <p className="text-sm text-gray-500 leading-relaxed mb-2">
            <span className="font-semibold text-gray-900">
              {tt.startedStreakTemplate.replace("{n}", String(currentStreak)).replace("{day}", currentStreak === 1 ? tt.dayWord : tt.daysWord)}
            </span>{" "}
            {tt.loginTomorrowSuffix}
          </p>
          <p className="text-base font-bold text-orange-600 mb-5">
            {daysLabel}!
          </p>

          {showPreview && (
            <div className="mb-5 p-3 rounded-lg border-0 bg-gradient-to-r from-indigo-600 to-purple-600 flex items-center gap-3 text-left">
              <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <Trophy className="h-4 w-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-white/70">
                  {previewHeading}
                </p>
                <p className="text-sm font-semibold text-white truncate">
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
              {tt.continueTrainingBtn}
            </Button>
            <Button
              variant="outline"
              onClick={onDismiss}
              className="w-full h-11 text-sm font-semibold bg-white border-gray-300 text-gray-900 hover:bg-gray-100"
            >
              {tt.seeProgressBtn}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StreakNotificationModal;
