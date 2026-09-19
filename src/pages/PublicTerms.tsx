import { useLanguage } from "@/i18n/LanguageContext";
import LegalDocPage from "@/components/legal/LegalDocPage";
import { TERMS_SECTIONS_RO, TERMS_SECTIONS_EN } from "@/components/dashboard/TermsSection";
import { TERMS_VERSION, legalLastUpdatedLabel } from "@/lib/legalVersions";

const PublicTerms = () => {
  const { lang } = useLanguage();
  const sections = lang === "ro" ? TERMS_SECTIONS_RO : TERMS_SECTIONS_EN;

  return (
    <LegalDocPage
      eyebrow="LEGAL"
      title={lang === "ro" ? "Termeni și Condiții" : "Terms and Conditions"}
      lastUpdated={legalLastUpdatedLabel(lang, TERMS_VERSION)}
      tocLabel={lang === "ro" ? "Cuprins" : "Table of Contents"}
      sections={sections}
      backLabel={lang === "ro" ? "Înapoi" : "Back"}
    />
  );
};

export default PublicTerms;
