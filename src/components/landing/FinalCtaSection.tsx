import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";

const FinalCtaSection = () => {
  const { t } = useLanguage();

  return (
    <section className="relative py-14 sm:py-24 overflow-hidden bg-gradient-to-br from-orange-500 to-orange-600">
      <div className="relative container mx-auto px-4 text-center">
        <h2 className="font-display text-2xl sm:text-4xl md:text-5xl text-white mb-4">
          {t.cta.title}
        </h2>
        <p className="text-orange-50 font-body mb-8 sm:mb-10 max-w-xl mx-auto text-sm sm:text-base">
          {t.cta.subtitle}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
          <Link to="/auth?tab=register">
            <Button size="lg" className="bg-white text-orange-600 hover:bg-orange-50 font-bold text-base sm:text-lg px-8 sm:px-10 py-5 sm:py-6 rounded-xl shadow-lg">
              {t.hero.cta}
              <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
          </Link>
          <Link to="/auth?tab=register&role=cauta_jucator">
            <Button size="lg" variant="outline" className="border-2 border-white/70 text-white hover:bg-white/10 font-bold text-base sm:text-lg px-8 sm:px-10 py-5 sm:py-6 rounded-xl bg-transparent">
              {t.hero.ctaScout}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default FinalCtaSection;
