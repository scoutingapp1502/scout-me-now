import { useLanguage } from "@/i18n/LanguageContext";
import LegalDocPage from "@/components/legal/LegalDocPage";
import { PRIVACY_SECTIONS_RO, PRIVACY_SECTIONS_EN } from "@/components/dashboard/PrivacyPolicySection";

const PublicPrivacy = () => {
  const { lang } = useLanguage();
  const sections = lang === "ro" ? PRIVACY_SECTIONS_RO : PRIVACY_SECTIONS_EN;

  return (
    <LegalDocPage
      eyebrow="LEGAL"
      title={lang === "ro" ? "Politica de Confidențialitate" : "Privacy Policy"}
      lastUpdated={lang === "ro" ? "Ultima actualizare: 17 septembrie 2026 · Versiunea 2.0" : "Last updated: September 17, 2026 · Version 2.0"}
      tocLabel={lang === "ro" ? "Cuprins" : "Table of Contents"}
      sections={sections}
      backLabel={lang === "ro" ? "Înapoi" : "Back"}
    />
  );
};

export default PublicPrivacy;
