import { useEffect, useMemo, useState } from "react";
import { Loader2, Trophy } from "lucide-react";
import { useTestRankings } from "@/hooks/useTestRankings";
import { athleticTests, getTechnicalTestsBySport, TechnicalTest } from "@/components/dashboard/PersonalProfile";
import { RankResultRow, getRankTestConfig, computePercent, sortRankRows, formatRankValue } from "@/lib/testRankingConfig";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface RankSectionProps {
  playerSport: string;
}

type Category = "athletic" | "technical";

const medalForRank = (rank: number) => {
  if (rank === 1) return "🥇";
  if (rank === 2) return "🥈";
  if (rank === 3) return "🥉";
  return null;
};

const RankTable = ({ test, rows, loading }: { test: TechnicalTest; rows: RankResultRow[]; loading: boolean }) => {
  const testRows = useMemo(
    () => sortRankRows(rows.filter((r) => r.testKey === test.key), test.key).slice(0, 10),
    [rows, test.key]
  );
  const config = getRankTestConfig(test.key);

  const columns =
    config.metricType === "made_attempted"
      ? ["Timp", "Reușite", "Total", "%"]
      : config.metricType === "time"
      ? ["Timp"]
      : ["Rezultat"];

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
      <div className="px-4 py-3 flex items-center border-b border-gray-100">
        <span className="font-display font-bold text-sm sm:text-base text-gray-900 tracking-wide">{test.label}</span>
      </div>
      {testRows.length === 0 ? (
        <div className="px-4 py-6 text-center text-gray-400 text-sm font-body">Niciun rezultat înregistrat încă</div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 text-[11px] font-body uppercase tracking-wide border-b border-gray-100">
              <th className="pl-4 pr-3 py-2 w-10">#</th>
              <th className="px-3 py-2">Jucător</th>
              {columns.map((c) => (
                <th key={c} className="px-4 sm:px-6 py-2 text-right whitespace-nowrap">
                  {c}
                </th>
              ))}
              <th className="w-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {testRows.map((row, i) => {
              const rank = i + 1;
              const medal = medalForRank(rank);
              const pct = computePercent(row);
              return (
                <tr key={row.id} className={rank <= 3 ? "bg-orange-50/60" : ""}>
                  <td className="pl-4 pr-3 py-3 font-display font-semibold text-gray-700">{medal ?? rank}</td>
                  <td className="px-3 py-3 font-body text-gray-800">
                    <div className="flex items-center gap-3">
                      {row.playerPhotoUrl ? (
                        <img src={row.playerPhotoUrl} alt={row.playerName} className="h-9 w-9 rounded-full object-cover shrink-0 border border-gray-200" />
                      ) : (
                        <div className="h-9 w-9 rounded-full bg-gray-100 border border-gray-200 shrink-0 flex items-center justify-center text-gray-400 text-xs font-display font-semibold">
                          {row.playerName.charAt(0)}
                        </div>
                      )}
                      <span className="truncate max-w-[140px]">{row.playerName}</span>
                    </div>
                  </td>
                  {config.metricType === "made_attempted" ? (
                    <>
                      <td className="px-4 sm:px-6 py-3 text-right font-body text-gray-600">{row.timeSeconds != null ? `${row.timeSeconds}s` : "—"}</td>
                      <td className="px-4 sm:px-6 py-3 text-right font-body text-gray-600">{row.madeCount ?? "—"}</td>
                      <td className="px-4 sm:px-6 py-3 text-right font-body text-gray-600">{row.attemptedCount ?? "—"}</td>
                      <td className="px-4 sm:px-6 py-3 text-right font-display font-semibold text-orange-600">{pct != null ? `${pct.toFixed(0)}%` : "—"}</td>
                    </>
                  ) : (
                    <td className="px-4 sm:px-6 py-3 text-right font-display font-semibold text-orange-600">{formatRankValue(row, test.key)}</td>
                  )}
                  <td className="w-4" />
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
      {loading && (
        <div className="px-4 py-3 flex justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-orange-400" />
        </div>
      )}
    </div>
  );
};

const RankSection = ({ playerSport }: RankSectionProps) => {
  const { rows, loading } = useTestRankings(playerSport || null);
  const [category, setCategory] = useState<Category>("athletic");

  const technicalTests = useMemo(() => getTechnicalTestsBySport(playerSport), [playerSport]);
  const testsForCategory = category === "athletic" ? athleticTests : technicalTests;

  const [selectedTestKey, setSelectedTestKey] = useState<string>(athleticTests[0]?.key ?? "");

  useEffect(() => {
    if (!testsForCategory.some((t) => t.key === selectedTestKey)) {
      setSelectedTestKey(testsForCategory[0]?.key ?? "");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, playerSport]);

  const selectedTest = testsForCategory.find((t) => t.key === selectedTestKey) ?? testsForCategory[0];

  return (
    <div className="max-w-3xl mx-auto space-y-4 pb-10">
      <div className="flex items-center gap-2 mb-2">
        <Trophy className="h-6 w-6 text-orange-500" />
        <h1 className="font-display text-xl sm:text-2xl text-gray-900">Rank</h1>
      </div>
      <p className="text-sm text-gray-500 font-body -mt-2">
        Top 10 cele mai bune rezultate, pentru {playerSport === "basketball" ? "baschet" : "fotbal"}.
      </p>

      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={category === "athletic" ? "default" : "outline"}
          onClick={() => setCategory("athletic")}
        >
          Teste Atletice
        </Button>
        <Button
          type="button"
          size="sm"
          variant={category === "technical" ? "default" : "outline"}
          onClick={() => setCategory("technical")}
        >
          Teste Specifice
        </Button>
      </div>

      <Select value={selectedTestKey} onValueChange={setSelectedTestKey}>
        <SelectTrigger className="bg-white">
          <SelectValue placeholder="Alege testul" />
        </SelectTrigger>
        <SelectContent>
          {testsForCategory.map((test) => (
            <SelectItem key={test.key} value={test.key}>
              {test.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {loading && rows.length === 0 ? (
        <div className="flex justify-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
        </div>
      ) : selectedTest ? (
        <RankTable key={selectedTest.key} test={selectedTest} rows={rows} loading={loading} />
      ) : null}
    </div>
  );
};

export default RankSection;
