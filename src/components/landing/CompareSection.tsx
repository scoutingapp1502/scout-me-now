import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight, BarChart3, Target, Lock } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const CompareSection = () => {
  const { t } = useLanguage();

  const athleticRows = [
    { icon: "⚡", label: "Pro Line Drill", value: "9.9s" },
    { icon: "🦘", label: "2 Foots Vertical Jump", value: "62cm" },
    { icon: "💪", label: "Shuttle Run", value: "11.4s" },
  ];

  const specificRows = [
    { icon: "⚽", label: "Control și Pasă", value: "14 rep." },
    { icon: "🏀", label: "Free Throw Shooting", value: "8/10" },
  ];

  const lockedRowCount = 2;

  return (
    <section className="py-12 sm:py-20 bg-gray-50 border-t border-gray-100">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8 sm:gap-12 items-center">
          {/* Copy */}
          <div className="text-center md:text-left">
            <h2 className="font-display text-2xl sm:text-4xl md:text-5xl text-gray-900 mb-3">
              {t.compare.title} <span className="text-orange-500">{t.compare.titleHighlight}</span>
            </h2>
            <p className="text-gray-500 font-body mb-6 text-sm sm:text-base">
              {t.compare.subtitle}
            </p>
            <Link to="/auth?tab=register">
              <Button size="lg" className="bg-orange-500 text-white hover:bg-orange-600 font-bold px-6 sm:px-8 py-5 sm:py-6 rounded-xl shadow-lg shadow-orange-500/20">
                {t.hero.cta}
                <ChevronRight className="ml-1 h-5 w-5" />
              </Button>
            </Link>
          </div>

          {/* Tests mockup: two stacked cards, same format as the notes/report preview */}
          <div className="max-w-sm w-full mx-auto md:mx-0 md:ml-auto space-y-4">
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-orange-500" />
                <span className="text-orange-600 text-[11px] font-body font-semibold uppercase tracking-wide">{t.compare.sectionAthletic}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {athleticRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between py-2">
                    <span className="flex items-center gap-2 text-gray-700 text-xs sm:text-sm font-body">
                      <span className="text-base leading-none">{row.icon}</span>
                      {row.label}
                    </span>
                    <span className="font-display text-sm sm:text-base text-gray-900 shrink-0">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Target className="h-4 w-4 text-orange-500" />
                <span className="text-orange-600 text-[11px] font-body font-semibold uppercase tracking-wide">{t.compare.sectionSpecific}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {specificRows.map((row) => (
                  <div key={row.label} className="flex items-center justify-between py-2">
                    <span className="flex items-center gap-2 text-gray-700 text-xs sm:text-sm font-body">
                      <span className="text-base leading-none">{row.icon}</span>
                      {row.label}
                    </span>
                    <span className="font-display text-sm sm:text-base text-gray-900 shrink-0">{row.value}</span>
                  </div>
                ))}
              </div>

              {/* Locked teaser rows — skeleton bars, not real (blurred) text, so nothing is readable */}
              <div className="space-y-2.5 pt-2.5 select-none pointer-events-none">
                {Array.from({ length: lockedRowCount }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between opacity-50">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full bg-gray-200" />
                      <div className="h-2.5 rounded-full bg-gray-200" style={{ width: 70 + i * 18 }} />
                    </div>
                    <div className="h-2.5 w-8 rounded-full bg-gray-200 shrink-0" />
                  </div>
                ))}
              </div>
              <div className="flex justify-center mt-3">
                <span className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-50 border border-orange-200 text-orange-600 text-[10px] font-body font-semibold">
                  <Lock className="h-3 w-3" />
                  {t.compare.unlockHint}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default CompareSection;
