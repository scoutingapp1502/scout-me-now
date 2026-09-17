import { useLanguage } from "@/i18n/LanguageContext";
import SportriseWordmark from "@/components/SportriseWordmark";

interface PersonalAreaFooterProps {
  onNavigate?: (section: string) => void;
}

const PersonalAreaFooter = ({ onNavigate }: PersonalAreaFooterProps) => {
  const { lang } = useLanguage();

  return (
    <footer className="mt-8 border-t border-gray-200 py-6 px-4">
      <div className="flex flex-col items-center gap-3 text-center">
        <SportriseWordmark className="text-base" />
        <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5 text-xs text-gray-500 font-body">
          <a href="/contact" target="_blank" rel="noopener noreferrer" className="hover:text-orange-500 transition-colors">
            Contact
          </a>
          <button onClick={() => onNavigate?.("terms")} className="hover:text-orange-500 transition-colors">
            {lang === "ro" ? "Termeni" : "Terms"}
          </button>
          <button onClick={() => onNavigate?.("privacy-policy")} className="hover:text-orange-500 transition-colors">
            {lang === "ro" ? "Confidențialitate" : "Privacy"}
          </button>
          <button onClick={() => onNavigate?.("help")} className="hover:text-orange-500 transition-colors">
            {lang === "ro" ? "Ajutor" : "Help"}
          </button>
        </div>
        <p className="text-[11px] text-gray-400 font-body">
          © {new Date().getFullYear()} SportRise. {lang === "ro" ? "Toate drepturile rezervate." : "All rights reserved."}
        </p>
      </div>
    </footer>
  );
};

export default PersonalAreaFooter;
