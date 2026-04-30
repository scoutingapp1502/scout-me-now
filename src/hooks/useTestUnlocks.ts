import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export interface TestUnlocksState {
  currentStreak: number; // progres către următoarea deblocare (resetează la unlock)
  bestStreak: number;
  loginStreak: number; // zile consecutive de logare (NU se resetează la unlock)
  bestLoginStreak: number;
  unlockedTests: string[];
  daysUntilNextUnlock: number;
  required: number; // 3 pentru prima deblocare, 4 pentru următoarele
  nextTestPreview: string | null;
  loading: boolean;
}

/**
 * Hook ce gestionează streak-ul zilnic și deblocarea aleatorie a testelor tehnice.
 */
export function useTestUnlocks(
  userId: string,
  viewerUserId: string | null,
  availableTests: string[],
  enabled: boolean,
) {
  const { toast } = useToast();
  const [state, setState] = useState<TestUnlocksState>({
    currentStreak: 0,
    bestStreak: 0,
    loginStreak: 0,
    bestLoginStreak: 0,
    unlockedTests: [],
    daysUntilNextUnlock: 3,
    required: 3,
    nextTestPreview: null,
    loading: true,
  });

  const isOwner = enabled && viewerUserId === userId;

  const fetchState = useCallback(async () => {
    const { data } = await supabase
      .from("player_test_unlocks" as any)
      .select("current_streak, unlocked_tests, last_visit_date, next_test_preview, best_streak, login_streak, best_login_streak")
      .eq("user_id", userId)
      .maybeSingle();

    const unlocked = ((data as any)?.unlocked_tests as string[]) || [];
    const streak = (data as any)?.current_streak ?? 0;
    const best = (data as any)?.best_streak ?? 0;
    const loginStreak = (data as any)?.login_streak ?? 0;
    const bestLoginStreak = (data as any)?.best_login_streak ?? 0;
    const required = unlocked.length === 0 ? 3 : 4;
    setState({
      currentStreak: streak,
      bestStreak: Math.max(best, streak),
      loginStreak,
      bestLoginStreak: Math.max(bestLoginStreak, loginStreak),
      unlockedTests: unlocked,
      daysUntilNextUnlock: Math.max(required - streak, 0),
      required,
      nextTestPreview: (data as any)?.next_test_preview ?? null,
      loading: false,
    });
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isOwner) {
        await fetchState();
        return;
      }
      const { data, error } = await supabase.rpc("ping_daily_visit" as any, {
        _available_tests: availableTests,
      });
      if (cancelled) return;
      if (error) {
        await fetchState();
        return;
      }
      const row = Array.isArray(data) ? (data as any)[0] : (data as any);
      if (row) {
        const unlocked = (row.unlocked_tests as string[]) || [];
        const streak = row.current_streak ?? 0;
        const best = row.best_streak ?? 0;
        const loginStreak = row.login_streak ?? 0;
        const bestLoginStreak = row.best_login_streak ?? 0;
        const required = unlocked.length === 0 ? 3 : 4;
        setState({
          currentStreak: streak,
          bestStreak: Math.max(best, streak),
          loginStreak,
          bestLoginStreak: Math.max(bestLoginStreak, loginStreak),
          unlockedTests: unlocked,
          daysUntilNextUnlock: row.days_until_next_unlock ?? Math.max(required - streak, 0),
          required,
          nextTestPreview: row.next_test_preview ?? null,
          loading: false,
        });
        if (row.newly_unlocked) {
          toast({
            title: "🎁 Test nou deblocat!",
            description: "Ai deblocat un test tehnic specific. Acum poți încărca un video.",
          });
        }
      } else {
        await fetchState();
      }
    };
    run();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, viewerUserId, isOwner, availableTests.join(",")]);

  return state;
}
