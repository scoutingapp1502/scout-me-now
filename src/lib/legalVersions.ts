// Bump the matching version whenever the text of that document changes.
// Every logged-in user who last accepted an older version is asked to
// accept again (LegalConsentDialog) before using the dashboard.
export const TERMS_VERSION = "2.1";
export const PRIVACY_VERSION = "2.1";

const LAST_UPDATED = { ro: "17 septembrie 2026", en: "September 17, 2026" };

export function legalLastUpdatedLabel(lang: string, version: string): string {
  return lang === "ro"
    ? `Ultima actualizare: ${LAST_UPDATED.ro} · Versiunea ${version}`
    : `Last updated: ${LAST_UPDATED.en} · Version ${version}`;
}
