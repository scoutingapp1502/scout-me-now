import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const STORAGE_KEY = "notification-read-ids";

function getReadIds(userId: string): Set<string> {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}-${userId}`);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function setReadIds(userId: string, ids: Set<string>) {
  localStorage.setItem(`${STORAGE_KEY}-${userId}`, JSON.stringify([...ids]));
}

export function useNotificationCount(userId: string | null) {
  const [count, setCount] = useState(0);

  const recalc = useCallback(async () => {
    if (!userId) return;

    // Count unread incoming follow requests
    const { data: follows } = await supabase
      .from("follows")
      .select("id")
      .eq("following_id", userId)
      .eq("status", "pending");
    const readIds = getReadIds(userId);
    const unreadFollows = follows ? follows.filter(f => !readIds.has(f.id)).length : 0;

    // Count unread rejected follow requests sent by the current user
    const { data: rejectedFollows } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_id", userId)
      .eq("status", "rejected");
    const unreadRejectedFollows = rejectedFollows
      ? rejectedFollows.filter(f => !readIds.has(`${f.id}-rejected`)).length
      : 0;

    // Count pending collaboration requests (for agents)
    const { data: agentCollabs } = await supabase
      .from("agent_collaboration_requests")
      .select("id")
      .eq("agent_user_id", userId)
      .eq("status", "pending");
    const unreadAgentCollabs = agentCollabs ? agentCollabs.filter(r => !readIds.has(r.id)).length : 0;

    // Count responded collaboration requests (for players - accepted/rejected)
    const { data: playerCollabs } = await supabase
      .from("agent_collaboration_requests")
      .select("id, status")
      .eq("player_user_id", userId)
      .in("status", ["accepted", "rejected"]);
    const unreadPlayerCollabs = playerCollabs ? playerCollabs.filter(r => !readIds.has(`${r.id}-response`)).length : 0;

    // Count unread recommendation notifications
    const [pendingRecsRes, submittedRecsRes] = await Promise.all([
      supabase.from("recommendations").select("id").eq("author_user_id", userId).eq("status", "pending").eq("initiated_by", "request"),
      supabase.from("recommendations").select("id").eq("recipient_user_id", userId).eq("status", "submitted"),
    ]);
    const unreadPendingRecs = (pendingRecsRes.data || []).filter((r: any) => !readIds.has(`rec-${r.id}-author`)).length;
    const unreadSubmittedRecs = (submittedRecsRes.data || []).filter((r: any) => !readIds.has(`rec-${r.id}-recipient`)).length;

    // Count unread video notifications (anyone watching players they follow)
    let unreadVideoNotifs = 0;
    {
      const { data: followsData } = await supabase
        .from("follows").select("following_id").eq("follower_id", userId).eq("status", "accepted");
      const followedIds = (followsData || []).map((f: any) => f.following_id);
      if (followedIds.length > 0) {
        const { data: playerRolesData } = await supabase
          .from("user_roles").select("user_id").in("user_id", followedIds).eq("role", "player");
        const playerIds = (playerRolesData || []).map((r: any) => r.user_id);
        if (playerIds.length > 0) {
          const { data: videoNotifsData } = await supabase
            .from("player_video_notifications").select("id").in("player_id", playerIds);
          unreadVideoNotifs = (videoNotifsData || []).filter((n: any) => !readIds.has(`video-${n.id}`)).length;
        }
      }
    }

    // Count unread likes on my stories
    let unreadStoryLikes = 0;
    {
      const { data: myStories } = await (supabase as any).from("stories").select("id").eq("user_id", userId);
      const myStoryIds = (myStories || []).map((s: any) => s.id);
      if (myStoryIds.length > 0) {
        const { data: storyLikesData } = await (supabase as any)
          .from("story_likes").select("id").in("story_id", myStoryIds).neq("user_id", userId);
        unreadStoryLikes = (storyLikesData || []).filter((l: any) => !readIds.has(`storylike-${l.id}`)).length;
      }
    }

    setCount(unreadFollows + unreadRejectedFollows + unreadAgentCollabs + unreadPlayerCollabs + unreadPendingRecs + unreadSubmittedRecs + unreadVideoNotifs + unreadStoryLikes);
  }, [userId]);

  useEffect(() => {
    recalc();

    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith(STORAGE_KEY)) recalc();
    };
    window.addEventListener("storage", onStorage);

    const onCustom = () => recalc();
    window.addEventListener("notification-read-update", onCustom);

    const channel = supabase
      .channel(`notif-count-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "follows", filter: `following_id=eq.${userId}` }, () => recalc())
      .on("postgres_changes", { event: "*", schema: "public", table: "follows", filter: `follower_id=eq.${userId}` }, () => recalc())
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_collaboration_requests", filter: `agent_user_id=eq.${userId}` }, () => recalc())
      .on("postgres_changes", { event: "*", schema: "public", table: "agent_collaboration_requests", filter: `player_user_id=eq.${userId}` }, () => recalc())
      .on("postgres_changes", { event: "*", schema: "public", table: "recommendations", filter: `author_user_id=eq.${userId}` }, () => recalc())
      .on("postgres_changes", { event: "*", schema: "public", table: "recommendations", filter: `recipient_user_id=eq.${userId}` }, () => recalc())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "player_video_notifications" }, () => recalc())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "story_likes" }, () => recalc())
      .subscribe();

    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("notification-read-update", onCustom);
      supabase.removeChannel(channel);
    };
  }, [userId, recalc]);

  return count;
}

export function markNotificationRead(userId: string, followId: string) {
  const ids = getReadIds(userId);
  ids.add(followId);
  setReadIds(userId, ids);
  window.dispatchEvent(new Event("notification-read-update"));
}

export function markAllNotificationsRead(userId: string, followIds: string[]) {
  const ids = getReadIds(userId);
  followIds.forEach(id => ids.add(id));
  setReadIds(userId, ids);
  window.dispatchEvent(new Event("notification-read-update"));
}

export function isNotificationRead(userId: string, followId: string): boolean {
  return getReadIds(userId).has(followId);
}
