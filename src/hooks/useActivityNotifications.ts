import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const FOLLOWING_SEEN_KEY = "activity-following-last-seen";
const MINE_SEEN_KEY = "activity-mine-last-seen";

function getLastSeen(key: string, userId: string): string {
  const stored = localStorage.getItem(`${key}-${userId}`);
  if (stored) return stored;
  const now = new Date().toISOString();
  localStorage.setItem(`${key}-${userId}`, now);
  return now;
}

export function markFollowingSeen(userId: string) {
  localStorage.setItem(`${FOLLOWING_SEEN_KEY}-${userId}`, new Date().toISOString());
  window.dispatchEvent(new Event("activity-seen-update"));
}

export function markMineSeen(userId: string) {
  localStorage.setItem(`${MINE_SEEN_KEY}-${userId}`, new Date().toISOString());
  window.dispatchEvent(new Event("activity-seen-update"));
}

export interface ActivityNotificationItem {
  id: string;
  type: "new_post" | "comment_like" | "post_like" | "post_comment";
  actor_name: string;
  actor_photo: string | null;
  actor_role: string;
  actor_id: string;
  post_id: string;
  created_at: string;
  tab: "following" | "mine";
}

export function useActivityNotifications(userId: string | null) {
  const [count, setCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [mineCount, setMineCount] = useState(0);
  const [notifications, setNotifications] = useState<ActivityNotificationItem[]>([]);

  const fetchCount = useCallback(async () => {
    if (!userId) return;
    const followingLastSeen = getLastSeen(FOLLOWING_SEEN_KEY, userId);
    const mineLastSeen = getLastSeen(MINE_SEEN_KEY, userId);
    let followingTotal = 0;
    let mineTotal = 0;
    const notifItems: ActivityNotificationItem[] = [];

    try {
      // Get who I follow
      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId)
        .eq("status", "accepted");
      const followingIds = follows?.map(f => f.following_id) || [];

      // Collect all actor IDs for profile resolution
      const actorIds = new Set<string>();

      // FOLLOWING TAB:
      if (followingIds.length > 0) {
        // a) New posts from followed users
        const { data: newPosts } = await supabase
          .from("posts")
          .select("id, user_id, created_at")
          .in("user_id", followingIds)
          .gt("created_at", followingLastSeen)
          .order("created_at", { ascending: false })
          .limit(50);
        if (newPosts) {
          followingTotal += newPosts.length;
          newPosts.forEach(p => {
            actorIds.add(p.user_id);
            notifItems.push({
              id: `post-${p.id}`,
              type: "new_post",
              actor_name: "",
              actor_photo: null,
              actor_role: "",
              actor_id: p.user_id,
              post_id: p.id,
              created_at: p.created_at,
              tab: "following",
            });
          });
        }

        // b) Likes on MY comments
        const { data: myComments } = await supabase
          .from("post_comments")
          .select("id, post_id")
          .eq("user_id", userId);
        if (myComments && myComments.length > 0) {
          const myCommentIds = myComments.map(c => c.id);
          const commentPostMap = new Map<string, string>();
          myComments.forEach(c => commentPostMap.set(c.id, c.post_id));

          const { data: commentLikes } = await supabase
            .from("comment_likes")
            .select("id, comment_id, user_id, created_at")
            .in("comment_id", myCommentIds)
            .neq("user_id", userId)
            .gt("created_at", followingLastSeen)
            .order("created_at", { ascending: false })
            .limit(50);
          if (commentLikes) {
            followingTotal += commentLikes.length;
            commentLikes.forEach(cl => {
              actorIds.add(cl.user_id);
              notifItems.push({
                id: `cl-${cl.id}`,
                type: "comment_like",
                actor_name: "",
                actor_photo: null,
                actor_role: "",
                actor_id: cl.user_id,
                post_id: commentPostMap.get(cl.comment_id) || "",
                created_at: cl.created_at,
                tab: "following",
              });
            });
          }
        }
      }

      // MY POSTS TAB:
      const { data: myPosts } = await supabase
        .from("posts")
        .select("id")
        .eq("user_id", userId);
      if (myPosts && myPosts.length > 0) {
        const myPostIds = myPosts.map(p => p.id);

        const { data: postLikes } = await supabase
          .from("post_likes")
          .select("id, post_id, user_id, created_at")
          .in("post_id", myPostIds)
          .neq("user_id", userId)
          .gt("created_at", mineLastSeen)
          .order("created_at", { ascending: false })
          .limit(50);
        if (postLikes) {
          mineTotal += postLikes.length;
          postLikes.forEach(pl => {
            actorIds.add(pl.user_id);
            notifItems.push({
              id: `pl-${pl.id}`,
              type: "post_like",
              actor_name: "",
              actor_photo: null,
              actor_role: "",
              actor_id: pl.user_id,
              post_id: pl.post_id,
              created_at: pl.created_at,
              tab: "mine",
            });
          });
        }

        const { data: postComments } = await supabase
          .from("post_comments")
          .select("id, post_id, user_id, created_at")
          .in("post_id", myPostIds)
          .neq("user_id", userId)
          .gt("created_at", mineLastSeen)
          .order("created_at", { ascending: false })
          .limit(50);
        if (postComments) {
          mineTotal += postComments.length;
          postComments.forEach(pc => {
            actorIds.add(pc.user_id);
            notifItems.push({
              id: `pc-${pc.id}`,
              type: "post_comment",
              actor_name: "",
              actor_photo: null,
              actor_role: "",
              actor_id: pc.user_id,
              post_id: pc.post_id,
              created_at: pc.created_at,
              tab: "mine",
            });
          });
        }
      }

      // Resolve actor profiles
      if (actorIds.size > 0) {
        const ids = [...actorIds];
        const [playerRes, scoutRes, roleRes] = await Promise.all([
          supabase.from("player_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", ids),
          supabase.from("scout_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", ids),
          supabase.from("user_roles").select("user_id, role").in("user_id", ids),
        ]);
        const profileMap = new Map<string, { name: string; photo: string | null }>();
        const roleMap = new Map<string, string>();
        (playerRes.data || []).forEach(p => profileMap.set(p.user_id, { name: `${p.first_name} ${p.last_name}`.trim(), photo: p.photo_url }));
        (scoutRes.data || []).forEach(s => { if (!profileMap.has(s.user_id)) profileMap.set(s.user_id, { name: `${s.first_name} ${s.last_name}`.trim(), photo: s.photo_url }); });
        (roleRes.data || []).forEach(r => roleMap.set(r.user_id, r.role));

        notifItems.forEach(n => {
          const p = profileMap.get(n.actor_id);
          n.actor_name = p?.name || "User";
          n.actor_photo = p?.photo || null;
          n.actor_role = roleMap.get(n.actor_id) || "player";
        });
      }

      // Sort by created_at desc
      notifItems.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    } catch (e) {
      console.error("Activity notification count error:", e);
    }

    setFollowingCount(followingTotal);
    setMineCount(mineTotal);
    setCount(followingTotal + mineTotal);
    setNotifications(notifItems);
  }, [userId]);

  useEffect(() => {
    fetchCount();

    const onSeenUpdate = () => fetchCount();
    window.addEventListener("activity-seen-update", onSeenUpdate);

    const channel = supabase
      .channel("activity-notif")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => fetchCount())
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, () => fetchCount())
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, () => fetchCount())
      .on("postgres_changes", { event: "*", schema: "public", table: "comment_likes" }, () => fetchCount())
      .subscribe();

    return () => {
      window.removeEventListener("activity-seen-update", onSeenUpdate);
      supabase.removeChannel(channel);
    };
  }, [fetchCount]);

  return { count, followingCount, mineCount, notifications, refetch: fetchCount };
}
