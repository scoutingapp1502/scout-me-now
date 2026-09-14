import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const HeroSection = () => {
  const { t } = useLanguage();

  return (
    <section className="relative pt-14 sm:pt-16 overflow-hidden min-h-[80vh] flex items-center bg-gradient-to-br from-gray-50 via-white to-orange-50">
      {/* Soft decorative shapes, no sport-specific imagery */}
      <div className="absolute -top-24 -right-24 w-72 h-72 sm:w-96 sm:h-96 bg-orange-200/40 rounded-full blur-3xl" />
      <div className="absolute -bottom-24 -left-24 w-72 h-72 sm:w-96 sm:h-96 bg-orange-100/60 rounded-full blur-3xl" />

      <div className="relative container mx-auto px-4 py-16 sm:py-24 md:py-32 text-center">
        <div className="inline-flex items-center gap-2 mb-5 px-3.5 sm:px-4 py-1.5 rounded-full bg-white border border-gray-200 shadow-sm">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
          </span>
          <span className="text-gray-700 text-xs sm:text-sm font-semibold font-body">{t.hero.badge}</span>
        </div>
        <h1 className="font-display text-3xl sm:text-5xl md:text-7xl lg:text-8xl text-gray-900 mb-4 sm:mb-6 leading-tight">
          {t.hero.title1} <span className="text-orange-500">{t.hero.titleHighlight}</span>
          <br />{t.hero.title2}
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-gray-500 max-w-2xl mx-auto mb-8 sm:mb-10 font-body px-2">
          {t.hero.subtitle}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0">
          <Link to="/auth?tab=register">
            <Button size="lg" className="w-full sm:w-auto bg-orange-500 text-white hover:bg-orange-600 font-bold text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 rounded-xl shadow-lg shadow-orange-500/20">
              {t.hero.cta}
              <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
          </Link>
          <Link to="/auth?tab=register&role=cauta_jucator">
            <Button size="lg" variant="outline" className="w-full sm:w-auto border-2 border-orange-300 text-orange-600 hover:bg-orange-50 font-bold text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 rounded-xl bg-white">
              {t.hero.ctaScout}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
