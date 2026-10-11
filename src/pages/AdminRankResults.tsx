import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useTestRankings } from "@/hooks/useTestRankings";
import { athleticTests, getTechnicalTestsBySport, TechnicalTest } from "@/components/dashboard/PersonalProfile";
import { getRankTestConfig, computePercent, sortRankRows, RankResultRow } from "@/lib/testRankingConfig";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Trash2, Loader2, Trophy, Pencil } from "lucide-react";

const SPORTS: { key: string; label: string }[] = [
  { key: "football", label: "Fotbal" },
  { key: "basketball", label: "Baschet" },
];

interface PlayerHit {
  user_id: string;
  first_name: string;
  last_name: string;
}

const TestRankRow = ({
  test,
  sport,
  rows,
  onSave,
  onDelete,
}: {
  test: TechnicalTest;
  sport: string;
  rows: RankResultRow[];
  onSave: (input: { playerId: string; timeSeconds: string; madeCount: string; attemptedCount: string; value: string }) => Promise<boolean>;
  onDelete: (id: string) => void;
}) => {
  const config = getRankTestConfig(test.key);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [results, setResults] = useState<PlayerHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<PlayerHit | null>(null);
  const [timeSeconds, setTimeSeconds] = useState("");
  const [madeCount, setMadeCount] = useState("");
  const [attemptedCount, setAttemptedCount] = useState("");
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!debouncedSearch) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    (supabase as any)
      .rpc("search_players_by_sport", { p_search: debouncedSearch, p_sport: sport, p_limit: 8 })
      .then(({ data }: { data: PlayerHit[] | null }) => {
        if (!cancelled) {
          setResults(data || []);
          setSearching(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [debouncedSearch, sport]);

  const resetForm = () => {
    setSelectedPlayer(null);
    setSearch("");
    setResults([]);
    setTimeSeconds("");
    setMadeCount("");
    setAttemptedCount("");
    setValue("");
  };

  const handleEdit = (row: RankResultRow) => {
    setSelectedPlayer({ user_id: row.playerId, first_name: row.playerName, last_name: "" });
    setSearch(row.playerName);
    setResults([]);
    setTimeSeconds(row.timeSeconds != null ? String(row.timeSeconds) : "");
    setMadeCount(row.madeCount != null ? String(row.madeCount) : "");
    setAttemptedCount(row.attemptedCount != null ? String(row.attemptedCount) : "");
    setValue(row.value != null ? String(row.value) : "");
  };

  const handleSave = async () => {
    if (!selectedPlayer) return;
    setSaving(true);
    const ok = await onSave({ playerId: selectedPlayer.user_id, timeSeconds, madeCount, attemptedCount, value });
    setSaving(false);
    if (ok) resetForm();
  };

  const testRows = sortRankRows(rows, test.key);

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white space-y-3">
      <div>
        <p className="font-semibold text-sm">
          {test.icon} {test.label}
        </p>
        <p className="text-xs text-gray-500 whitespace-pre-line mt-1">{test.description}</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 items-start">
        <div className="relative flex-1 min-w-0 w-full">
          <Input
            placeholder="Caută jucător după nume..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setSelectedPlayer(null);
            }}
          />
          {search && !selectedPlayer && (results.length > 0 || searching) && (
            <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-md max-h-48 overflow-y-auto">
              {searching && <div className="p-2 text-xs text-gray-400">Se caută...</div>}
              {results.map((p) => (
                <button
                  key={p.user_id}
                  type="button"
                  className="w-full text-left px-3 py-2 text-sm hover:bg-orange-50"
                  onClick={() => {
                    setSelectedPlayer(p);
                    setSearch(`${p.first_name} ${p.last_name}`.trim());
                    setResults([]);
                  }}
                >
                  {p.first_name} {p.last_name}
                </button>
              ))}
            </div>
          )}
        </div>

        {config.metricType === "time" && (
          <Input
            type="number"
            step="0.01"
            placeholder="Timp (s)"
            value={timeSeconds}
            onChange={(e) => setTimeSeconds(e.target.value)}
            className="w-full sm:w-32"
          />
        )}
        {config.metricType === "count" && (
          <Input
            type="number"
            step="0.1"
            placeholder={`Rezultat (${config.unit ?? ""})`}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="w-full sm:w-36"
          />
        )}
        {config.metricType === "made_attempted" && (
          <>
            <Input
              type="number"
              step="0.01"
              placeholder="Timp (s, opțional)"
              value={timeSeconds}
              onChange={(e) => setTimeSeconds(e.target.value)}
              className="w-full sm:w-32"
            />
            <Input
              type="number"
              placeholder="Reușite"
              value={madeCount}
              onChange={(e) => setMadeCount(e.target.value)}
              className="w-full sm:w-24"
            />
            <Input
              type="number"
              placeholder="Total"
              value={attemptedCount}
              onChange={(e) => setAttemptedCount(e.target.value)}
              className="w-full sm:w-24"
            />
          </>
        )}

        <Button type="button" size="sm" disabled={!selectedPlayer || saving} onClick={handleSave} className="shrink-0">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvează"}
        </Button>
      </div>

      {testRows.length > 0 && (
        <div className="divide-y divide-gray-100 border-t border-gray-100 pt-2">
          {testRows.map((row, i) => {
            const pct = computePercent(row);
            return (
              <div key={row.id} className="flex items-center justify-between py-1.5 text-sm">
                <span className="text-gray-700">
                  <span className="text-gray-400 mr-2">#{i + 1}</span>
                  {row.playerName}
                </span>
                <div className="flex items-center gap-3 text-gray-600">
                  {config.metricType === "time" && <span>{row.timeSeconds}s</span>}
                  {config.metricType === "count" && (
                    <span>
                      {row.value}
                      {config.unit}
                    </span>
                  )}
                  {config.metricType === "made_attempted" && (
                    <span>
                      {row.timeSeconds != null ? `${row.timeSeconds}s · ` : ""}
                      {row.madeCount}/{row.attemptedCount} {pct != null ? `(${pct.toFixed(0)}%)` : ""}
                    </span>
                  )}
                  <button type="button" onClick={() => handleEdit(row)} title="Editează">
                    <Pencil className="h-3.5 w-3.5 text-gray-400 hover:text-orange-500" />
                  </button>
                  <button type="button" onClick={() => onDelete(row.id)} title="Șterge">
                    <Trash2 className="h-3.5 w-3.5 text-gray-400 hover:text-red-500" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default function AdminRankResults({ embedded }: { embedded?: boolean } = {}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [sport, setSport] = useState<string>("football");
  const { rows, loading, saveResult, deleteResult } = useTestRankings(sport);

  const handleSave = async (
    test: TechnicalTest,
    input: { playerId: string; timeSeconds: string; madeCount: string; attemptedCount: string; value: string }
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { error } = await saveResult({
      playerId: input.playerId,
      sport,
      testKey: test.key,
      timeSeconds: input.timeSeconds ? parseFloat(input.timeSeconds) : null,
      madeCount: input.madeCount ? parseInt(input.madeCount, 10) : null,
      attemptedCount: input.attemptedCount ? parseInt(input.attemptedCount, 10) : null,
      value: input.value ? parseFloat(input.value) : null,
      createdBy: user.id,
    });
    if (error) {
      toast({ title: "Eroare la salvare", variant: "destructive" });
      return false;
    }
    toast({ title: "Rezultat salvat!" });
    return true;
  };

  const handleDelete = async (id: string) => {
    const { error } = await deleteResult(id);
    if (error) {
      toast({ title: "Eroare la ștergere", variant: "destructive" });
    } else {
      toast({ title: "Rezultat șters." });
    }
  };

  const technicalTests = getTechnicalTestsBySport(sport);

  return (
    <div className={embedded ? "text-gray-900" : "min-h-screen bg-gray-200 text-gray-900"}>
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        {!embedded && (
          <div className="flex items-center gap-3 mb-6">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl font-heading font-bold">🏆 Rezultate Rank</h1>
          </div>
        )}
        {embedded && (
          <h1 className="text-2xl font-heading font-bold mb-2 flex items-center gap-2">
            <Trophy className="h-6 w-6" /> Rezultate Rank
          </h1>
        )}
        <p className="text-sm text-gray-500 mb-6">
          Rezultatele introduse aici apar în secțiunea Rank a jucătorilor, în clasamentul top 10 pentru fiecare test.
        </p>

        <div className="flex gap-2 mb-6">
          {SPORTS.map((s) => (
            <Button key={s.key} variant={sport === s.key ? "default" : "outline"} size="sm" onClick={() => setSport(s.key)}>
              {s.label}
            </Button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-orange-500" />
          </div>
        ) : (
          <div className="space-y-8">
            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Teste Atletice (comune tuturor sporturilor)
              </h2>
              <div className="space-y-4">
                {athleticTests.map((test) => (
                  <TestRankRow
                    key={test.key}
                    test={test}
                    sport={sport}
                    rows={rows.filter((r) => r.testKey === test.key)}
                    onSave={(input) => handleSave(test, input)}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">
                Teste Specifice — {SPORTS.find((s) => s.key === sport)?.label}
              </h2>
              <div className="space-y-4">
                {technicalTests.map((test) => (
                  <TestRankRow
                    key={test.key}
                    test={test}
                    sport={sport}
                    rows={rows.filter((r) => r.testKey === test.key)}
                    onSave={(input) => handleSave(test, input)}
                    onDelete={handleDelete}
                  />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
