import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useLanguage } from "@/i18n/LanguageContext";
import LanguageToggle from "@/components/LanguageToggle";

const Navbar = () => {
  const { t } = useLanguage();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-pitch/95 backdrop-blur-sm border-b border-electric/10">
      <div className="container mx-auto flex items-center justify-between h-14 sm:h-16 px-4">
        <Link to="/" className="flex items-center gap-2">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-electric flex items-center justify-center">
            <span className="text-pitch font-display text-base sm:text-lg">⚽</span>
          </div>
          <span className="font-display text-lg sm:text-2xl text-primary-foreground tracking-wider">
            SPORTRISE
          </span>
        </Link>

        <div className="hidden sm:flex items-center gap-3">
          <LanguageToggle />
          <Link to="/auth?tab=login">
            <Button variant="ghost" className="text-primary-foreground hover:text-electric hover:bg-primary-foreground/10">
              {t.nav.auth}
            </Button>
          </Link>
          <Link to="/auth?tab=register">
            <Button className="bg-electric hover:bg-electric/90 text-pitch font-semibold">
              {t.nav.register}
            </Button>
          </Link>
        </div>

        <button
          className="sm:hidden text-primary-foreground p-1"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {mobileMenuOpen && (
        <div className="sm:hidden bg-pitch/98 border-t border-electric/10 px-4 py-4 space-y-3 animate-in slide-in-from-top-2 duration-200">
          <LanguageToggle />
          <Link to="/auth?tab=login" onClick={() => setMobileMenuOpen(false)}>
            <Button variant="ghost" className="w-full text-primary-foreground hover:text-electric hover:bg-primary-foreground/10 justify-start">
              {t.nav.auth}
            </Button>
          </Link>
          <Link to="/auth?tab=register" onClick={() => setMobileMenuOpen(false)}>
            <Button className="w-full bg-electric hover:bg-electric/90 text-pitch font-semibold">
              {t.nav.register}
            </Button>
          </Link>
        </div>
      )}
    </nav>
  );
};

export default Navbar;
