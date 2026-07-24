import { PROFANITY_WORDS } from "./messageModeration";

// A bare URL is extremely common in a sports-networking app (highlight
// links, club websites) — flagging it alone caused constant false
// positives, so it now only counts as a spam signal when paired with
// promotional phrasing, not on its own.
const URL_PATTERN = /https?:\/\//i;
const SPAM_PATTERNS = [
  /\b(click here|free money|buy now|earn \$|work from home|dm me|check my profile|win a prize)\b/i,
  /(.)\1{6,}/, // same character repeated 7+ times (excludes normal "!!!!"/"sooo" enthusiasm)
];

export type HideUnwantedLevel = "off" | "some" | "more";

export function isLikelyUnwantedComment(text: string, level: HideUnwantedLevel): boolean {
  if (level === "off" || !text) return false;
  const lower = text.toLowerCase();

  const hasProfanity = PROFANITY_WORDS.some((w) => new RegExp(`(^|[^\\p{L}\\p{N}])${w}($|[^\\p{L}\\p{N}])`, "iu").test(lower));
  if (hasProfanity) return true;

  const hasSpamPattern = SPAM_PATTERNS.some((p) => p.test(text));
  if (hasSpamPattern) return true;

  // A URL combined with promotional language (matched above) is already
  // caught; a URL alone is only suspicious at the stricter "more" level.
  if (level === "more" && URL_PATTERN.test(text)) return true;

  if (level === "more") {
    const letters = text.replace(/[^a-zA-Z]/g, "");
    const isShouting = letters.length > 6 && letters === letters.toUpperCase();
    if (isShouting) return true;
  }

  return false;
}
