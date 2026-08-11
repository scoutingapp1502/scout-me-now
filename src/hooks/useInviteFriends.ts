import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getOrCreateInviteCode } from "@/lib/inviteCode";

export interface Invitee {
  userId: string;
  name: string;
  completion: number;
  validated: boolean;
  createdAt: string;
}

export interface InviteFriendsState {
  code: string;
  invitees: Invitee[];
  validatedCount: number;
  availableUnlockSlots: number;
  inviteUnlockedTests: string[];
  loading: boolean;
}

function calcCompletion(p: any): number {
  let pct = 0;
  if (p?.video_highlights?.length > 0) pct += 35;
  if (p?.career_description) pct += 25;
  if (p?.height_cm && p?.weight_kg && p?.preferred_foot) pct += 20;
  if (p?.photo_url) pct += 5;
  if (p?.position) pct += 5;
  if (p?.current_team) pct += 2.5;
  if (p?.nationality) pct += 2.5;
  if (p?.date_of_birth) pct += 5;
  return pct;
}

export function useInviteFriends(userId: string, enabled: boolean) {
  const [state, setState] = useState<InviteFriendsState>({
    code: "",
    invitees: [],
    validatedCount: 0,
    availableUnlockSlots: 0,
    inviteUnlockedTests: [],
    loading: true,
  });

  const fetchData = useCallback(async () => {
    if (!userId || !enabled) {
      setState((prev) => ({ ...prev, loading: false }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true }));

    const code = await getOrCreateInviteCode(userId);

    // Fetch invite uses
    const { data: uses } = await (supabase as any)
      .from("invite_uses")
      .select("invitee_id, created_at")
      .eq("inviter_id", userId);

    const invitees: Invitee[] = [];
    if (uses && (uses as any[]).length > 0) {
      const inviteeIds = (uses as any[]).map((u: any) => u.invitee_id);
      const { data: profiles } = await supabase
        .from("player_profiles")
        .select(
          "user_id, first_name, last_name, video_highlights, career_description, height_cm, weight_kg, preferred_foot, photo_url, position, current_team, nationality, date_of_birth"
        )
        .in("user_id", inviteeIds);

      for (const use of uses as any[]) {
        const profile = (profiles as any[] | null)?.find(
          (p: any) => p.user_id === use.invitee_id
        );
        const completion = profile ? calcCompletion(profile) : 0;
        const name = profile
          ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Jucător"
          : "Jucător";
        invitees.push({
          userId: use.invitee_id,
          name,
          completion,
          validated: completion >= 55,
          createdAt: use.created_at,
        });
      }
    }

    const validatedCount = invitees.filter((i) => i.validated).length;

    const { data: inviteUnlocks } = await (supabase as any)
      .from("invite_test_unlocks")
      .select("test_key")
      .eq("user_id", userId);

    const inviteUnlockedTests =
      (inviteUnlocks as any[])?.map((u: any) => u.test_key) ?? [];

    const availableUnlockSlots =
      Math.floor(validatedCount / 3) - inviteUnlockedTests.length;

    setState({
      code,
      invitees,
      validatedCount,
      availableUnlockSlots,
      inviteUnlockedTests,
      loading: false,
    });
  }, [userId, enabled]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const unlockTestViaInvite = useCallback(
    async (testKey: string): Promise<boolean> => {
      if (!userId) return false;

      const { data, error } = await (supabase as any).rpc("unlock_test_via_invite", {
        _test_key: testKey,
      });
      if (error || !data) return false;

      setState((prev) => ({
        ...prev,
        inviteUnlockedTests: [...prev.inviteUnlockedTests, testKey],
        availableUnlockSlots: prev.availableUnlockSlots - 1,
      }));

      return true;
    },
    [userId]
  );

  return { ...state, refetch: fetchData, unlockTestViaInvite };
}
