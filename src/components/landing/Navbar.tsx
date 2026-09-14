import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";
import SportriseWordmark from "@/components/SportriseWordmark";

const Navbar = () => {
  const { t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-sm border-b border-gray-200">
      <div className="container mx-auto flex items-center justify-between h-14 sm:h-16 px-4">
        <Link to="/" className="flex items-center gap-2">
          <SportriseWordmark className="text-lg" />
        </Link>

        <div className="hidden sm:flex items-center gap-3">
          <LanguageToggle light />
          <Link to="/auth?tab=login">
            <Button variant="ghost" className="text-gray-700 hover:text-orange-600 hover:bg-orange-50">
              {t.nav.auth}
            </Button>
          </Link>
          <Link to="/auth?tab=register">
            <Button className="bg-orange-500 hover:bg-orange-600 text-white font-semibold">
              {t.nav.register}
            </Button>
          </Link>
        </div>

        <button
          className="sm:hidden text-gray-900 p-1"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="sm:hidden bg-white border-t border-gray-200 px-4 py-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
          <LanguageToggle light />
          <Link to="/auth?tab=login" onClick={() => setMobileMenuOpen(false)}>
            <Button variant="ghost" className="w-full text-gray-700 hover:text-orange-600 hover:bg-orange-50 justify-start">
              {t.nav.auth}
            </Button>
          </Link>
          <Link to="/auth?tab=register" onClick={() => setMobileMenuOpen(false)}>
            <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white font-semibold">
              {t.nav.register}
            </Button>
          </Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
