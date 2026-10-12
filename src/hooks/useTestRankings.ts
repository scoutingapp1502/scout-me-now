import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RankResultRow } from "@/lib/testRankingConfig";

export interface SaveRankResultInput {
  playerId: string;
  sport: string;
  testKey: string;
  timeSeconds?: number | null;
  madeCount?: number | null;
  attemptedCount?: number | null;
  value?: number | null;
  createdBy: string;
}

export function useTestRankings(sport: string | null) {
  const [rows, setRows] = useState<RankResultRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    if (!sport) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const { data: resultRows } = await (supabase as any)
      .from("test_rankings")
      .select("id, player_id, sport, test_key, time_seconds, made_count, attempted_count, value, updated_at")
      .eq("sport", sport);

    const playerIds = Array.from(new Set((resultRows || []).map((r: any) => r.player_id)));
    let names: Record<string, string> = {};
    let photos: Record<string, string | null> = {};
    if (playerIds.length > 0) {
      const { data: players } = await supabase
        .from("player_profiles")
        .select("user_id, first_name, last_name, photo_url")
        .in("user_id", playerIds);
      names = Object.fromEntries((players || []).map((p: any) => [p.user_id, `${p.first_name} ${p.last_name}`.trim()]));
      photos = Object.fromEntries((players || []).map((p: any) => [p.user_id, p.photo_url]));
    }

    setRows(
      (resultRows || []).map((r: any) => ({
        id: r.id,
        playerId: r.player_id,
        playerName: names[r.player_id] || "—",
        playerPhotoUrl: photos[r.player_id] ?? null,
        sport: r.sport,
        testKey: r.test_key,
        timeSeconds: r.time_seconds,
        madeCount: r.made_count,
        attemptedCount: r.attempted_count,
        value: r.value,
        updatedAt: r.updated_at,
      }))
    );
    setLoading(false);
  }, [sport]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const saveResult = async (input: SaveRankResultInput) => {
    const { error } = await (supabase as any).from("test_rankings").upsert(
      {
        player_id: input.playerId,
        sport: input.sport,
        test_key: input.testKey,
        time_seconds: input.timeSeconds ?? null,
        made_count: input.madeCount ?? null,
        attempted_count: input.attemptedCount ?? null,
        value: input.value ?? null,
        created_by: input.createdBy,
      },
      { onConflict: "player_id,test_key" }
    );
    if (!error) await fetchAll();
    return { error };
  };

  const deleteResult = async (id: string) => {
    const { error } = await (supabase as any).from("test_rankings").delete().eq("id", id);
    if (!error) await fetchAll();
    return { error };
  };

  return { rows, loading, saveResult, deleteResult, refetch: fetchAll };
}
