import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Loader2, Trophy, Crown, Medal } from "lucide-react";
import { useTestRankings } from "@/hooks/useTestRankings";
import PersonalProfile, { athleticTests, getTechnicalTestsBySport, TechnicalTest } from "@/components/dashboard/PersonalProfile";
import { RankResultRow, getRankTestConfig, computePercent, sortRankRows, formatRankValue } from "@/lib/testRankingConfig";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface RankSectionProps {
  playerSport: string;
  onNavigateToChat?: (userId: string) => void;
}

type Category = "athletic" | "technical";

const PODIUM_BADGE_STYLE: Record<number, string> = {
  1: "bg-gradient-to-br from-yellow-300 to-amber-500 ring-2 ring-yellow-200 shadow-md shadow-yellow-300/50",
  2: "bg-gradient-to-br from-gray-200 to-gray-400 ring-2 ring-gray-100 shadow-md shadow-gray-300/50",
  3: "bg-gradient-to-br from-amber-500 to-amber-700 ring-2 ring-amber-300 shadow-md shadow-amber-400/50",
};

const RankBadge = ({ rank }: { rank: number }) => {
  if (rank <= 3) {
    const Icon = rank === 1 ? Crown : Medal;
    return (
      <div
        className={`h-8 w-8 sm:h-9 sm:w-9 rounded-full flex items-center justify-center shrink-0 ${PODIUM_BADGE_STYLE[rank]}`}
      >
        <Icon className="h-4 w-4 sm:h-[18px] sm:w-[18px] text-white drop-shadow-sm" strokeWidth={2.25} fill="currentColor" fillOpacity={0.15} />
      </div>
    );
  }
  return (
    <div className="h-7 w-7 sm:h-8 sm:w-8 rounded-full flex items-center justify-center text-xs sm:text-sm font-display font-bold border border-gray-200 bg-gray-50 text-gray-500 shrink-0">
      {rank}
    </div>
  );
};

const RankTable = ({
  test,
  rows,
  loading,
  onSelectPlayer,
}: {
  test: TechnicalTest;
  rows: RankResultRow[];
  loading: boolean;
  onSelectPlayer: (playerId: string) => void;
}) => {
  const testRows = useMemo(
    () => sortRankRows(rows.filter((r) => r.testKey === test.key), test.key).slice(0, 10),
    [rows, test.key]
  );
  const config = getRankTestConfig(test.key);

  const columns: { full: string; short: string }[] =
    config.metricType === "made_attempted"
      ? [
          { full: "Timp", short: "Timp" },
          { full: "Reușite", short: "Reuș." },
          { full: "Total", short: "Tot." },
          { full: "%", short: "%" },
        ]
      : config.metricType === "time"
      ? [{ full: "Timp", short: "Timp" }]
      : [{ full: "Rezultat", short: "Rez." }];

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
            <tr className="text-left text-gray-400 text-[10px] sm:text-[11px] font-body uppercase tracking-normal sm:tracking-wide border-b border-gray-100">
              <th className="pl-2 pr-1 sm:pl-4 sm:pr-3 py-2.5 w-8 sm:w-10">#</th>
              <th className="px-1 sm:px-3 py-2.5">Jucător</th>
              {columns.map((c) => (
                <th key={c.full} className="px-1 sm:px-6 py-2.5 text-center whitespace-nowrap">
                  <span className="sm:hidden">{c.short}</span>
                  <span className="hidden sm:inline">{c.full}</span>
                </th>
              ))}
              <th className="w-1 sm:w-4" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {testRows.map((row, i) => {
              const rank = i + 1;
              const pct = computePercent(row);
              return (
                <tr
                  key={row.id}
                  onClick={() => onSelectPlayer(row.playerId)}
                  className={`cursor-pointer hover:bg-orange-50 transition-colors ${rank <= 3 ? "bg-orange-50/60" : ""}`}
                >
                  <td className="pl-2 pr-1 sm:pl-4 sm:pr-3 py-3.5">
                    <RankBadge rank={rank} />
                  </td>
                  <td className="px-1 sm:px-3 py-3.5 font-body text-gray-900">
                    <div className="flex items-center gap-2 sm:gap-3">
                      {row.playerPhotoUrl ? (
                        <img src={row.playerPhotoUrl} alt={row.playerName} className="h-11 w-11 sm:h-12 sm:w-12 rounded-full object-cover shrink-0 border border-gray-200" />
                      ) : (
                        <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-full bg-gray-100 border border-gray-200 shrink-0 flex items-center justify-center text-gray-400 text-sm font-display font-semibold">
                          {row.playerName.charAt(0)}
                        </div>
                      )}
                      {/* Mobile: last name on top, first name below — more legible
                          than one truncated line in a narrow column. Desktop keeps
                          the combined name on a single line. */}
                      <div className="sm:hidden leading-tight min-w-0">
                        <span className="block font-semibold break-words">{row.playerLastName || row.playerName}</span>
                        {row.playerFirstName && (
                          <span className="block text-gray-500 font-normal text-[11px] break-words">{row.playerFirstName}</span>
                        )}
                      </div>
                      <span className="hidden sm:inline truncate max-w-[140px] font-semibold">{row.playerName}</span>
                    </div>
                  </td>
                  {config.metricType === "made_attempted" ? (
                    <>
                      <td className="px-1 sm:px-6 py-3.5 text-center font-display font-bold text-gray-900">{row.timeSeconds != null ? `${row.timeSeconds}s` : "—"}</td>
                      <td className="px-1 sm:px-6 py-3.5 text-center font-display font-bold text-gray-900">{row.madeCount ?? "—"}</td>
                      <td className="px-1 sm:px-6 py-3.5 text-center font-display font-bold text-gray-900">{row.attemptedCount ?? "—"}</td>
                      <td className="px-1 sm:px-6 py-3.5 text-center font-display font-bold text-orange-600">{pct != null ? `${pct.toFixed(0)}%` : "—"}</td>
                    </>
                  ) : (
                    <td className="px-1 sm:px-6 py-3.5 text-center font-display font-bold text-orange-600">{formatRankValue(row, test.key)}</td>
                  )}
                  <td className="w-1 sm:w-4" />
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

const RankSection = ({ playerSport, onNavigateToChat }: RankSectionProps) => {
  const { rows, loading } = useTestRankings(playerSport || null);
  const [category, setCategory] = useState<Category>("athletic");
  const [viewingPlayerId, setViewingPlayerId] = useState<string | null>(null);

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

  if (viewingPlayerId) {
    return (
      <div className="space-y-0">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setViewingPlayerId(null)}
          className="mb-4 gap-2 text-gray-500 hover:bg-gray-100 hover:text-gray-900 font-body"
        >
          <ArrowLeft className="h-4 w-4" />
          Înapoi
        </Button>
        <PersonalProfile userId={viewingPlayerId} readOnly onNavigateToChat={onNavigateToChat} />
      </div>
    );
  }

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
        <RankTable key={selectedTest.key} test={selectedTest} rows={rows} loading={loading} onSelectPlayer={setViewingPlayerId} />
      ) : null}
    </div>
  );
};

export default RankSection;
