import { StickyNote, FileBarChart, Star } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const HowItWorksSection = () => {
  const { t } = useLanguage();

  return (
    <section className="py-14 sm:py-24 bg-white border-t border-gray-100 overflow-hidden">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Copy */}
          <div className="max-w-xl">
            <h2 className="font-display text-3xl sm:text-5xl md:text-6xl text-gray-900 leading-tight mb-5">
              {t.howItWorks.title}
            </h2>
            <p className="text-gray-500 font-body text-base sm:text-lg">
              {t.howItWorks.subtitle}
            </p>
          </div>

          {/* Illustrative notes/report cards, styled after the real scout notes UI */}
          <div className="max-w-sm w-full mx-auto lg:mx-0 lg:ml-auto">
            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm mb-5 sm:-rotate-1">
              <div className="flex items-center gap-2 mb-3">
                <StickyNote className="h-4 w-4 text-orange-500" />
                <span className="text-orange-600 text-[11px] font-body font-semibold uppercase tracking-wide">{t.notesPreview.noteBadge}</span>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 shrink-0 rounded-full bg-gray-100 border border-gray-200" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <div className="h-2.5 w-20 bg-gray-200 rounded-full" />
                    <div className="flex gap-0.5 shrink-0">
                      {[1, 2, 3, 4].map((i) => (
                        <Star key={i} className="h-3 w-3 fill-orange-400 text-orange-400" />
                      ))}
                      <Star className="h-3 w-3 text-gray-200" />
                    </div>
                  </div>
                  <span className="inline-block px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 text-[10px] font-body font-semibold mb-2">
                    {t.notesPreview.priority}
                  </span>
                  <p className="text-gray-400 text-xs font-body leading-relaxed">"{t.notesPreview.quote}"</p>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm sm:rotate-1 sm:ml-8">
              <div className="flex items-center gap-2 mb-3">
                <FileBarChart className="h-4 w-4 text-orange-500" />
                <span className="text-orange-600 text-[11px] font-body font-semibold uppercase tracking-wide">{t.notesPreview.reportBadge}</span>
              </div>
              <div className="space-y-2">
                <div className="h-2.5 w-28 bg-gray-200 rounded-full" />
                <div className="h-2 w-full bg-gray-100 rounded-full" />
                <div className="h-2 w-4/5 bg-gray-100 rounded-full" />
                <div className="h-2 w-2/3 bg-gray-100 rounded-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
