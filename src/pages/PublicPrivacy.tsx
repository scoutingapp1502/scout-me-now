import { useLanguage } from "@/i18n/LanguageContext";
import LegalDocPage from "@/components/legal/LegalDocPage";
import { PRIVACY_SECTIONS_RO, PRIVACY_SECTIONS_EN } from "@/components/dashboard/PrivacyPolicySection";
import { PRIVACY_VERSION, legalLastUpdatedLabel } from "@/lib/legalVersions";

const PublicPrivacy = () => {
  const { lang } = useLanguage();
  const sections = lang === "ro" ? PRIVACY_SECTIONS_RO : PRIVACY_SECTIONS_EN;

  return (
    <LegalDocPage
      eyebrow="LEGAL"
      title={lang === "ro" ? "Politica de Confidențialitate" : "Privacy Policy"}
      lastUpdated={legalLastUpdatedLabel(lang, PRIVACY_VERSION, "privacy")}
      tocLabel={lang === "ro" ? "Cuprins" : "Table of Contents"}
      sections={sections}
      backLabel={lang === "ro" ? "Înapoi" : "Back"}
    />
  );
};

export default PublicPrivacy;
