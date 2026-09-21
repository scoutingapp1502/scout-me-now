// Absolute floor: no account can be created below this age, with or
// without parental consent.
export const MINIMUM_AGE = 13;

// Below this age (and at or above MINIMUM_AGE), registration requires a
// self-declared parental consent checkbox — see PARENTAL_CONSENT_AGE usage
// in Auth.tsx. There is no independent verification of the parent's
// identity, only the minor's own confirmation at signup.
export const PARENTAL_CONSENT_AGE = 16;

// A Descoperitor (cauta_jucator) account requires being a legal adult —
// separate, stricter floor than MINIMUM_AGE, since Scouts interact directly
// with minor players (see TermsSection.tsx's "Siguranță și comportament"
// clause). Enforced both here (Auth.tsx) and server-side by
// enforce_minimum_age() on scout_profiles (see
// 20261018090000_scout_minimum_age_18.sql).
export const SCOUT_MINIMUM_AGE = 18;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Latest date of birth that still satisfies the minimum age today.
export function latestDateOfBirthForAge(age: number): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - age);
  return toLocalIsoDate(d);
}

export function isAtLeastAge(dateOfBirth: string, age: number): boolean {
  if (!ISO_DATE.test(dateOfBirth)) return false;
  return dateOfBirth <= latestDateOfBirthForAge(age);
}
