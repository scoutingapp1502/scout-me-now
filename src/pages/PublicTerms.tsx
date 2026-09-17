import { useLanguage } from "@/i18n/LanguageContext";
import LegalDocPage from "@/components/legal/LegalDocPage";
import { TERMS_SECTIONS_RO, TERMS_SECTIONS_EN } from "@/components/dashboard/TermsSection";

const PublicTerms = () => {
  const { lang } = useLanguage();
  const sections = lang === "ro" ? TERMS_SECTIONS_RO : TERMS_SECTIONS_EN;

  return (
    <LegalDocPage
      eyebrow="LEGAL"
      title={lang === "ro" ? "Termeni și Condiții" : "Terms and Conditions"}
      lastUpdated={lang === "ro" ? "Ultima actualizare: 17 septembrie 2026 · Versiunea 2.0" : "Last updated: September 17, 2026 · Version 2.0"}
      tocLabel={lang === "ro" ? "Cuprins" : "Table of Contents"}
      sections={sections}
      backLabel={lang === "ro" ? "Înapoi" : "Back"}
    />
  );
};

export default PublicTerms;
