import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";

const FooterSection = () => {
  const { t } = useLanguage();

  return (
    <footer className="bg-pitch py-8 sm:py-10 border-t border-electric/10">
      <div className="container mx-auto px-4">
        <div className="flex flex-col gap-4 items-center text-center">
          <div className="flex items-center gap-2">
            <span className="font-display text-lg sm:text-xl text-primary-foreground">⚽ SPORTRISE</span>
          </div>
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-sm text-muted-foreground font-body">
            <Link to="/" className="hover:text-electric transition-colors">{t.footer.home}</Link>
            <Link to="/auth?tab=register" className="hover:text-electric transition-colors">{t.footer.register}</Link>
            <Link to="/auth?tab=login" className="hover:text-electric transition-colors">{t.footer.auth}</Link>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm font-body">{t.footer.rights}</p>
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;
