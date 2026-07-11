import { Link } from "react-router-dom";
import { Star, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import heroStadium from "@/assets/hero-stadium.jpg";

const SuccessStoriesSection = () => {
  const { t } = useLanguage();

  const testimonials = [t.testimonials.t1, t.testimonials.t2, t.testimonials.t3];

  return (
    <section className="relative py-12 sm:py-20 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <img src={heroStadium} alt="" className="w-full h-full object-cover opacity-30" />
        <div className="absolute inset-0 bg-gradient-to-b from-pitch via-pitch/90 to-pitch" />
      </div>

      <div className="relative container mx-auto px-4 text-center">
        <h2 className="font-display text-2xl sm:text-4xl md:text-5xl text-primary-foreground mb-3">
          {t.testimonials.title} <span className="text-electric">{t.testimonials.titleHighlight}</span>
        </h2>
        <p className="text-muted-foreground font-body mb-10 text-sm sm:text-base">
          {t.testimonials.subtitle}
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6 mb-10">
          {testimonials.map((tt) => (
            <div key={tt.name} className="bg-primary-foreground/5 backdrop-blur-sm border border-electric/20 rounded-xl p-5 sm:p-6 text-left">
              <div className="flex gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-electric text-electric" />
                ))}
              </div>
              <p className="text-primary-foreground/90 font-body mb-4 italic text-sm sm:text-base">"{tt.text}"</p>
              <p className="text-electric font-semibold font-body text-sm sm:text-base">{tt.name}</p>
              <p className="text-primary-foreground/60 text-xs sm:text-sm font-body">{tt.role}</p>
            </div>
          ))}
        </div>

        <Link to="/auth?tab=register">
          <Button size="lg" className="bg-electric text-pitch hover:bg-electric/90 font-bold text-base sm:text-lg px-8 sm:px-10 py-5 sm:py-6 rounded-xl shadow-lg shadow-electric/25">
            {t.hero.cta}
            <ChevronRight className="ml-1 h-5 w-5" />
          </Button>
        </Link>
      </div>
    </section>
  );
};

export default SuccessStoriesSection;
