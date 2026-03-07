import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Trophy, Eye, MessageCircle, Users, ChevronRight, Star, Menu, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";

const Index = () => {
  const { t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const benefits = [
    { icon: Eye, title: t.benefits.visibility, description: t.benefits.visibilityDesc },
    { icon: MessageCircle, title: t.benefits.contact, description: t.benefits.contactDesc },
    { icon: Trophy, title: t.benefits.palmares, description: t.benefits.palmaresDesc },
    { icon: Users, title: t.benefits.network, description: t.benefits.networkDesc },
  ];

  const stats = [
    { value: "500+", label: t.stats.players },
    { value: "120+", label: t.stats.scouts },
    { value: "50+", label: t.stats.transfers },
    { value: "30+", label: t.stats.countries },
  ];

  const testimonials = [t.testimonials.t1, t.testimonials.t2, t.testimonials.t3];

  return (
    <div className="min-h-screen bg-background">
      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-pitch/95 backdrop-blur-sm border-b border-primary/20">
        <div className="container mx-auto flex items-center justify-between h-14 sm:h-16 px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-display text-base sm:text-lg">⚽</span>
            </div>
            <span className="font-display text-lg sm:text-2xl text-primary-foreground tracking-wider">
              FOOTBALLSCOUT
            </span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden sm:flex items-center gap-3">
            <LanguageToggle />
            <Link to="/auth?tab=login">
              <Button variant="ghost" className="text-primary-foreground hover:text-primary hover:bg-primary-foreground/10">
                {t.nav.auth}
              </Button>
            </Link>
            <Link to="/auth?tab=register">
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                {t.nav.register}
              </Button>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            className="sm:hidden text-primary-foreground p-1"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile menu dropdown */}
        {mobileMenuOpen && (
          <div className="sm:hidden bg-pitch/98 border-t border-primary/20 px-4 py-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
            <LanguageToggle />
            <Link to="/auth?tab=login" onClick={() => setMobileMenuOpen(false)}>
              <Button variant="ghost" className="w-full text-primary-foreground hover:text-primary hover:bg-primary-foreground/10 justify-start">
                {t.nav.auth}
              </Button>
            </Link>
            <Link to="/auth?tab=register" onClick={() => setMobileMenuOpen(false)}>
              <Button className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
                {t.nav.register}
              </Button>
            </Link>
          </div>
        )}
      </nav>

      {/* Hero */}
      <section className="relative pt-14 sm:pt-16 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-pitch via-pitch/95 to-primary/30" />
        <div className="absolute inset-0 opacity-10" style={{
          backgroundImage: `radial-gradient(circle at 2px 2px, hsl(var(--primary)) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }} />
        <div className="relative container mx-auto px-4 py-16 sm:py-24 md:py-36 text-center">
          <div className="inline-block mb-4 px-3 sm:px-4 py-1 rounded-full bg-primary/20 border border-primary/30">
            <span className="text-primary text-xs sm:text-sm font-medium">{t.hero.badge}</span>
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
              <Button size="lg" className="w-full sm:w-auto bg-electric text-pitch hover:bg-electric/90 font-bold text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 rounded-xl shadow-lg shadow-electric/25">
                {t.hero.ctaScout}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="bg-primary py-8 sm:py-10">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 text-center">
            {stats.map((stat) => (
              <div key={stat.label}>
                <p className="font-display text-3xl sm:text-4xl md:text-5xl text-electric">{stat.value}</p>
                <p className="text-primary-foreground/80 text-xs sm:text-sm mt-1 font-body">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Benefits */}
      <section className="py-12 sm:py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="text-center mb-8 sm:mb-14">
            <h2 className="font-display text-2xl sm:text-4xl md:text-5xl text-foreground mb-3">
              {t.benefits.title} <span className="text-primary">{t.benefits.titleHighlight}</span>?
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto font-body text-sm sm:text-base">
              {t.benefits.subtitle}
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {benefits.map((b) => (
              <div key={b.title} className="bg-card border border-border rounded-xl p-5 sm:p-6 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all">
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3 sm:mb-4">
                  <b.icon className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                </div>
                <h3 className="font-display text-lg sm:text-xl text-foreground mb-2">{b.title}</h3>
                <p className="text-muted-foreground text-xs sm:text-sm font-body">{b.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-12 sm:py-20 bg-pitch">
        <div className="container mx-auto px-4">
          <h2 className="font-display text-2xl sm:text-4xl md:text-5xl text-primary-foreground text-center mb-8 sm:mb-12">
            {t.testimonials.title} <span className="text-electric">{t.testimonials.titleHighlight}</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            {testimonials.map((tt) => (
              <div key={tt.name} className="bg-primary/10 border border-primary/20 rounded-xl p-5 sm:p-6">
                <div className="flex gap-1 mb-3">
                  {[1,2,3,4,5].map(i => <Star key={i} className="h-3.5 w-3.5 sm:h-4 sm:w-4 fill-electric text-electric" />)}
                </div>
                <p className="text-primary-foreground/90 font-body mb-4 italic text-sm sm:text-base">"{tt.text}"</p>
                <p className="text-primary font-semibold font-body text-sm sm:text-base">{tt.name}</p>
                <p className="text-primary-foreground/60 text-xs sm:text-sm font-body">{tt.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-12 sm:py-20 bg-gradient-to-r from-primary to-primary/80">
        <div className="container mx-auto px-4 text-center">
          <h2 className="font-display text-2xl sm:text-4xl md:text-5xl text-primary-foreground mb-4">
            {t.cta.title}
          </h2>
          <p className="text-primary-foreground/80 mb-6 sm:mb-8 max-w-lg mx-auto font-body text-sm sm:text-base">
            {t.cta.subtitle}
          </p>
          <Link to="/auth?tab=register">
            <Button size="lg" className="bg-electric text-pitch hover:bg-electric/90 font-bold text-base sm:text-lg px-8 sm:px-10 py-5 sm:py-6 rounded-xl">
              {t.hero.cta}
              <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-pitch py-8 sm:py-10 border-t border-primary/10">
        <div className="container mx-auto px-4">
          <div className="flex flex-col gap-4 items-center text-center">
            <div className="flex items-center gap-2">
              <span className="font-display text-lg sm:text-xl text-primary-foreground">⚽ FOOTBALLSCOUT</span>
            </div>
            <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-sm text-muted-foreground font-body">
              <Link to="/" className="hover:text-primary transition-colors">{t.footer.home}</Link>
              <Link to="/auth?tab=register" className="hover:text-primary transition-colors">{t.footer.register}</Link>
              <Link to="/auth?tab=login" className="hover:text-primary transition-colors">{t.footer.auth}</Link>
            </div>
            <p className="text-muted-foreground text-xs sm:text-sm font-body">{t.footer.rights}</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
