import { Wrench } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import SportriseWordmark from "@/components/SportriseWordmark";
import type { MaintenanceState } from "@/hooks/useMaintenanceMode";

interface MaintenancePageProps {
  maintenance: MaintenanceState;
}

// Only the end time is ever shown to users — never the start, and never a
// synthetic/estimated end (an emergency start with no real end chosen shows
// nothing at all here, since the admin explicitly said duration is unknown
// until they stop it manually).
function formatEnd(endIso: string | null, lang: string): string | null {
  if (!endIso) return null;
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" };
  return new Date(endIso).toLocaleString(lang === "ro" ? "ro-RO" : "en-US", opts);
}

const MaintenancePage = ({ maintenance }: MaintenancePageProps) => {
  const { lang } = useLanguage();
  const endLabel = maintenance.endIsEstimate ? null : formatEnd(maintenance.scheduledEnd, lang);

  return (
    <div className="min-h-screen w-full bg-gray-100 flex flex-col items-center justify-center px-4 py-10 gap-8">
      <SportriseWordmark className="text-2xl" />

      <div className="w-full max-w-lg bg-white border border-gray-200 rounded-2xl shadow-sm p-6 sm:p-8 text-center space-y-3">
        <div className="mx-auto h-14 w-14 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-lg">
          <Wrench className="h-7 w-7 text-white" />
        </div>
        <h1 className="font-display text-2xl text-gray-900">
          {lang === "ro" ? "Suntem în mentenanță" : "We're under maintenance"}
        </h1>
        <p className="text-sm text-gray-500 font-body leading-relaxed">
          {maintenance.message
            ? maintenance.message
            : lang === "ro"
              ? "Îmbunătățim platforma chiar acum. Revenim în cel mai scurt timp!"
              : "We're improving the platform right now. We'll be back shortly!"}
        </p>
        {endLabel && (
          <p className="text-xs text-gray-400 font-body">
            {lang === "ro" ? "Revine la: " : "Back at: "}
            <span className="font-semibold text-gray-600">{endLabel}</span>
          </p>
        )}
      </div>
    </div>
  );
};

export default MaintenancePage;
