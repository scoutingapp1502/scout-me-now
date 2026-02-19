import { useLanguage } from "@/i18n/LanguageContext";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

const LanguageToggle = () => {
  const { lang, setLang } = useLanguage();

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLang(lang === "ro" ? "en" : "ro")}
      className="text-primary-foreground hover:text-primary hover:bg-primary-foreground/10 font-body text-sm gap-1.5"
    >
      <Globe className="h-4 w-4" />
      {lang === "ro" ? "ENG" : "RO"}
    </Button>
  );
};

export default LanguageToggle;
