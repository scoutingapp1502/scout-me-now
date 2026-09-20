// Shared risk-engine logic between analyze-video-frames (initial pass) and
// recheck-video-content (secondary pass). See
// VIDEO_MODERATION_IMPLEMENTATION_PROMPT.md §4-5, §7.

export type ModerationCategory =
  | "sexual" | "violence" | "weapons" | "drugs" | "hate" | "threats" | "text";

export type CategoryScores = Partial<Record<ModerationCategory, number>>;

export interface Threshold {
  category: string;
  low_max: number;
  high_min: number;
}

export type RiskLevel = "low" | "uncertain" | "high";

// Minors get a stricter (lower) low_max, so more borderline cases route to
// recheck/admin for them than for an adult with the identical raw score —
// never a hard block purely on age. See prompt §4.
const MINOR_LOW_MAX_MULTIPLIER = 0.7;

export function isMinor(dateOfBirth: string | null | undefined): boolean {
  if (!dateOfBirth) return false;
  const dob = new Date(dateOfBirth);
  if (isNaN(dob.getTime())) return false;
  const eighteenthBirthday = new Date(dob);
  eighteenthBirthday.setFullYear(dob.getFullYear() + 18);
  return eighteenthBirthday > new Date();
}

export function categoryRiskLevel(
  score: number,
  threshold: Threshold,
  minor: boolean
): RiskLevel {
  const lowMax = minor ? threshold.low_max * MINOR_LOW_MAX_MULTIPLIER : threshold.low_max;
  if (score >= threshold.high_min) return "high";
  if (score > lowMax) return "uncertain";
  return "low";
}

export interface OverallRisk {
  level: RiskLevel;
  triggeredCategories: ModerationCategory[]; // categories at "uncertain" or "high"
  highCategories: ModerationCategory[];
}

// Overall decision is the most severe category — a single "high" makes the
// whole piece of content "high", regardless of how clean the rest score.
export function evaluateOverallRisk(
  scores: CategoryScores,
  thresholds: Threshold[],
  minor: boolean
): OverallRisk {
  const thresholdByCategory = new Map(thresholds.map((t) => [t.category, t]));
  const triggered: ModerationCategory[] = [];
  const high: ModerationCategory[] = [];
  let worst: RiskLevel = "low";

  for (const [category, score] of Object.entries(scores) as [ModerationCategory, number][]) {
    const threshold = thresholdByCategory.get(category);
    if (!threshold || score == null) continue;
    const level = categoryRiskLevel(score, threshold, minor);
    if (level === "high") { high.push(category); triggered.push(category); worst = "high"; }
    else if (level === "uncertain") { triggered.push(category); if (worst !== "high") worst = "uncertain"; }
  }

  return { level: worst, triggeredCategories: triggered, highCategories: high };
}

// Aggregates per-frame scores into one score per category using max(), not
// average — a single problematic frame in a 60s clip must count, not get
// diluted by five clean ones.
export function maxAcrossFrames(perFrameScores: CategoryScores[]): CategoryScores {
  const result: CategoryScores = {};
  for (const frameScores of perFrameScores) {
    for (const [category, score] of Object.entries(frameScores) as [ModerationCategory, number][]) {
      if (score == null) continue;
      result[category] = Math.max(result[category] ?? 0, score);
    }
  }
  return result;
}

// Merges multiple CategoryScores objects that can legitimately overlap on
// the same category from two different sources (e.g. Vision reading
// "sexual"/"violence"/"weapons"/"drugs" off an image, and Natural Language
// reading that same set off the caption/OCR text) using max(), never plain
// object-spread overwrite. A plain {...imageScores, ...textScores} silently
// discards the image's score for any category the text pass also produced
// a (usually near-zero, since the caption is normally clean) value for —
// which meant a post with a genuinely dangerous image and an innocuous
// caption could still get approved, because the caption's ~0 scores for
// sexual/violence/weapons/drugs overwrote Vision's real ones. Always use
// this (or maxAcrossFrames) to combine scores from different sources;
// never combine CategoryScores objects with spread.
export function mergeMaxScores(...scoreSets: CategoryScores[]): CategoryScores {
  const result: CategoryScores = {};
  for (const scores of scoreSets) {
    for (const [category, score] of Object.entries(scores) as [ModerationCategory, number][]) {
      if (score == null) continue;
      result[category] = Math.max(result[category] ?? 0, score);
    }
  }
  return result;
}
