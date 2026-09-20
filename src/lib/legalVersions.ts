// Bump the matching version whenever the text of that document changes.
// Every logged-in user who last accepted an older version is asked to
// accept again (LegalConsentDialog) before using the dashboard.
export const TERMS_VERSION = "2.4";
export const PRIVACY_VERSION = "2.2";

const TERMS_LAST_UPDATED = { ro: "20 septembrie 2026", en: "September 20, 2026" };
const PRIVACY_LAST_UPDATED = { ro: "20 septembrie 2026", en: "September 20, 2026" };

export function legalLastUpdatedLabel(lang: string, version: string, doc: "terms" | "privacy" = "terms"): string {
  const dates = doc === "privacy" ? PRIVACY_LAST_UPDATED : TERMS_LAST_UPDATED;
  return lang === "ro"
    ? `Ultima actualizare: ${dates.ro} · Versiunea ${version}`
    : `Last updated: ${dates.en} · Version ${version}`;
}
