export type RankMetricType = "time" | "count" | "made_attempted";

export interface RankTestConfig {
  metricType: RankMetricType;
  /** Only for "count" — the unit suffix shown next to the value, e.g. "cm" or "reps". */
  unit?: string;
}

/**
 * Which columns a test's rank results use. Derived from each test's own
 * description in PersonalProfile.tsx: timed drills -> "time", tests measuring
 * a single number like jump height or rep count -> "count", shooting/target
 * drills counted as hits-out-of-attempts -> "made_attempted".
 */
export const testRankingConfig: Record<string, RankTestConfig> = {
  // Shared athletic tests (both sports)
  speed: { metricType: "time" },
  endurance: { metricType: "time" },
  straight_line_speed: { metricType: "time" },
  jumping: { metricType: "count", unit: "cm" },
  acceleration: { metricType: "count", unit: "cm" },
  // Basketball technical tests
  free_throw_shooting_video: { metricType: "made_attempted" },
  star_shooting_drill_video: { metricType: "made_attempted" },
  crossover_video: { metricType: "time" },
  between_the_legs_video: { metricType: "time" },
  double_cross_video: { metricType: "time" },
  between_legs_cross_video: { metricType: "time" },
  // Football technical tests
  control_pass_video: { metricType: "count", unit: "reps" },
  slalom_video: { metricType: "time" },
  precision_video: { metricType: "made_attempted" },
  coordination_video: { metricType: "count", unit: "reps" },
  long_pass_video: { metricType: "made_attempted" },
};

export const getRankTestConfig = (testKey: string): RankTestConfig =>
  testRankingConfig[testKey] ?? { metricType: "time" };

export interface RankResultRow {
  id: string;
  playerId: string;
  playerName: string;
  sport: string;
  testKey: string;
  timeSeconds: number | null;
  madeCount: number | null;
  attemptedCount: number | null;
  value: number | null;
  updatedAt: string;
}

export const computePercent = (row: Pick<RankResultRow, "madeCount" | "attemptedCount">): number | null => {
  if (row.madeCount == null || row.attemptedCount == null || row.attemptedCount <= 0) return null;
  return (row.madeCount / row.attemptedCount) * 100;
};

/** Ascending sort key — lower is always "better" here, inverting metrics where higher is actually better. */
const rankSortValue = (row: RankResultRow, config: RankTestConfig): number => {
  if (config.metricType === "time") {
    return row.timeSeconds ?? Number.POSITIVE_INFINITY;
  }
  if (config.metricType === "count") {
    return row.value == null ? Number.POSITIVE_INFINITY : -row.value;
  }
  const pct = computePercent(row);
  if (pct == null) return Number.POSITIVE_INFINITY;
  return -(pct * 1000 + (row.madeCount ?? 0));
};

export const sortRankRows = (rows: RankResultRow[], testKey: string): RankResultRow[] => {
  const config = getRankTestConfig(testKey);
  return [...rows].sort((a, b) => rankSortValue(a, config) - rankSortValue(b, config));
};

export const formatRankValue = (row: RankResultRow, testKey: string): string => {
  const config = getRankTestConfig(testKey);
  if (config.metricType === "time") {
    return row.timeSeconds != null ? `${row.timeSeconds}s` : "—";
  }
  if (config.metricType === "count") {
    return row.value != null ? `${row.value}${config.unit ?? ""}` : "—";
  }
  return "—";
};
