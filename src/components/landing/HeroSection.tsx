import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ChevronRight } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import heroStadium from "@/assets/hero-stadium.jpg";

const HeroSection = () => {
  const { t } = useLanguage();

  return (
    <section className="relative pt-14 sm:pt-16 overflow-hidden min-h-[80vh] flex items-center">
      <div className="absolute inset-0">
        <img src={heroStadium} alt="" className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-pitch/80 via-pitch/60 to-pitch" />
      </div>
      <div className="relative container mx-auto px-4 py-16 sm:py-24 md:py-36 text-center">
        <div className="inline-block mb-4 px-3 sm:px-4 py-1 rounded-full bg-electric/20 border border-electric/30">
          <span className="text-electric text-xs sm:text-sm font-medium">{t.hero.badge}</span>
        </div>
        <h1 className="font-display text-3xl sm:text-5xl md:text-7xl lg:text-8xl text-primary-foreground mb-4 sm:mb-6 leading-tight">
          {t.hero.title1} <span className="text-electric">{t.hero.titleHighlight}</span>
          <br />{t.hero.title2}
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8 sm:mb-10 font-body px-2">
          {t.hero.subtitle}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center px-4 sm:px-0">
          <Link to="/auth?tab=register">
            <Button size="lg" className="w-full sm:w-auto bg-electric text-pitch hover:bg-electric/90 font-bold text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 rounded-xl shadow-lg shadow-electric/25">
              {t.hero.cta}
              <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
          </Link>
          <Link to="/auth?tab=register&role=scout">
            <Button size="lg" className="w-full sm:w-auto border-2 border-electric/50 text-electric hover:bg-electric/10 font-bold text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 rounded-xl bg-transparent">
              {t.hero.ctaScout}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
