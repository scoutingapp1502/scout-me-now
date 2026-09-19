export const MINIMUM_AGE = 16;

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
