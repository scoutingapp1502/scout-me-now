import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export type WeeklyChallengeType =
  | "add_video_highlight"
  | "add_match_video"
  | "complete_physical_data"
  | "complete_career_entry"
  | "complete_technical_test";

export interface WeeklyChallengeBadge {
  week_start: string;
  challenge_type: WeeklyChallengeType;
  earned_at: string;
}

export interface WeeklyChallengeState {
  id: string | null;
  challengeType: WeeklyChallengeType | null;
  status: "active" | "completed" | "expired" | null;
  weekStart: string | null;
  completedAt: string | null;
  unlockedTest: string | null;
  badges: WeeklyChallengeBadge[];
  loading: boolean;
}

/**
 * Hook ce gestionează provocarea săptămânală a jucătorului.
 * - Pe profilul propriu: cheamă RPC ce creează/verifică/completează provocarea.
 * - Pe profilul vizitat: doar citește badge-urile pentru afișare publică.
 */
export function useWeeklyChallenge(
  userId: string,
  viewerUserId: string | null,
  availableTests: string[],
  enabled: boolean,
) {
  const { toast } = useToast();
  const [state, setState] = useState<WeeklyChallengeState>({
    id: null,
    challengeType: null,
    status: null,
    weekStart: null,
    completedAt: null,
    unlockedTest: null,
    badges: [],
    loading: true,
  });

  const isOwner = enabled && viewerUserId === userId;

  const fetchBadges = useCallback(async () => {
    const { data } = await supabase
      .from("weekly_challenge_badges" as any)
      .select("week_start, challenge_type, earned_at")
      .eq("user_id", userId)
      .order("earned_at", { ascending: false })
      .limit(20);
    return ((data as any) || []) as WeeklyChallengeBadge[];
  }, [userId]);

  const fetchCurrent = useCallback(async () => {
    const { data } = await supabase
      .from("weekly_challenges" as any)
      .select("id, challenge_type, status, week_start, completed_at, unlocked_test")
      .eq("user_id", userId)
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data as any;
  }, [userId]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      if (!isOwner) {
        const [badges, current] = await Promise.all([fetchBadges(), fetchCurrent()]);
        if (cancelled) return;
        setState({
          id: current?.id ?? null,
          challengeType: current?.challenge_type ?? null,
          status: current?.status ?? null,
          weekStart: current?.week_start ?? null,
          completedAt: current?.completed_at ?? null,
          unlockedTest: current?.unlocked_test ?? null,
          badges,
          loading: false,
        });
        return;
      }
      const { data, error } = await supabase.rpc("get_or_create_weekly_challenge" as any, {
        _available_tests: availableTests,
      });
      if (cancelled) return;
      const badges = await fetchBadges();
      if (cancelled) return;

      if (error || !data) {
        const current = await fetchCurrent();
        setState({
          id: current?.id ?? null,
          challengeType: current?.challenge_type ?? null,
          status: current?.status ?? null,
          weekStart: current?.week_start ?? null,
          completedAt: current?.completed_at ?? null,
          unlockedTest: current?.unlocked_test ?? null,
          badges,
          loading: false,
        });
        return;
      }
      const row = Array.isArray(data) ? (data as any)[0] : (data as any);
      if (row) {
        setState({
          id: row.id,
          challengeType: row.challenge_type,
          status: row.status,
          weekStart: row.week_start,
          completedAt: row.completed_at,
          unlockedTest: row.unlocked_test,
          badges,
          loading: false,
        });
        if (row.newly_completed) {
          toast({
            title: "🏆 Provocare săptămânală rezolvată!",
            description: row.unlocked_test
              ? "Ai câștigat un badge și un test tehnic deblocat înainte de termen."
              : "Ai câștigat un badge săptămânal pe profilul tău.",
          });
        }
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

export const CHALLENGE_META: Record<
  WeeklyChallengeType,
  { label: string; description: string; emoji: string }
> = {
  add_video_highlight: {
    label: "Adaugă un video highlight",
    description: "Încarcă un video highlight nou în profilul tău săptămâna aceasta.",
    emoji: "🎬",
  },
  add_match_video: {
    label: "Adaugă un video de meci",
    description: "Încarcă un video complet de meci săptămâna aceasta.",
    emoji: "⚽",
  },
  complete_physical_data: {
    label: "Completează datele fizice",
    description: "Completează înălțimea, greutatea, piciorul preferat și naționalitatea.",
    emoji: "📏",
  },
  complete_career_entry: {
    label: "Adaugă o etapă în carieră",
    description: "Adaugă o nouă echipă/etapă în istoricul tău de carieră.",
    emoji: "📋",
  },
  complete_technical_test: {
    label: "Realizează un test tehnic",
    description: "Înregistrează un nou test tehnic specific săptămâna aceasta.",
    emoji: "🎯",
  },
};
