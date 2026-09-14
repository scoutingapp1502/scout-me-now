import { Link } from "react-router-dom";
import { useLanguage } from "@/i18n/LanguageContext";
import SportriseWordmark from "@/components/SportriseWordmark";

const FooterSection = () => {
  const { t } = useLanguage();

  return (
    <footer className="bg-white py-8 sm:py-10 border-t border-gray-200">
      <div className="container mx-auto px-4">
        <div className="flex flex-col gap-4 items-center text-center">
          <SportriseWordmark className="text-lg" />
          <div className="flex flex-wrap justify-center gap-4 sm:gap-6 text-sm text-gray-500 font-body">
            <Link to="/" className="hover:text-orange-600 transition-colors">{t.footer.home}</Link>
            <Link to="/auth?tab=register" className="hover:text-orange-600 transition-colors">{t.footer.register}</Link>
            <Link to="/auth?tab=login" className="hover:text-orange-600 transition-colors">{t.footer.auth}</Link>
          </div>
          <p className="text-gray-400 text-xs sm:text-sm font-body">{t.footer.rights}</p>
        </div>
      </div>
    </footer>
  );
};

export default FooterSection;
