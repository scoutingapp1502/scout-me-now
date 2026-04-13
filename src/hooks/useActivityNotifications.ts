import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

const LAST_SEEN_KEY = "activity-last-seen";

function getLastSeen(userId: string): string {
  const stored = localStorage.getItem(`${LAST_SEEN_KEY}-${userId}`);
  if (stored) return stored;
  // Default to now (no old notifications on first use)
  const now = new Date().toISOString();
  localStorage.setItem(`${LAST_SEEN_KEY}-${userId}`, now);
  return now;
}

export function markActivitySeen(userId: string) {
  localStorage.setItem(`${LAST_SEEN_KEY}-${userId}`, new Date().toISOString());
}

export function useActivityNotifications(userId: string | null) {
  const [count, setCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [mineCount, setMineCount] = useState(0);

  const fetchCount = useCallback(async () => {
    if (!userId) return;
    const lastSeen = getLastSeen(userId);
    let followingTotal = 0;
    let mineTotal = 0;

    try {
      // 1. Get who I follow
      const { data: follows } = await supabase
        .from("follows")
        .select("following_id")
        .eq("follower_id", userId);

      const followingIds = follows?.map(f => f.following_id) || [];

      // FOLLOWING TAB notifications:
      if (followingIds.length > 0) {
        // a) New posts from followed users
        const { count: newPosts } = await supabase
          .from("posts")
          .select("*", { count: "exact", head: true })
          .in("user_id", followingIds)
          .gt("created_at", lastSeen);
        followingTotal += newPosts || 0;

        // b) Likes on MY comments on followed users' posts
        const { data: myComments } = await supabase
          .from("post_comments")
          .select("id")
          .eq("user_id", userId);

        if (myComments && myComments.length > 0) {
          const myCommentIds = myComments.map(c => c.id);
          const { count: commentLikes } = await supabase
            .from("comment_likes")
            .select("*", { count: "exact", head: true })
            .in("comment_id", myCommentIds)
            .neq("user_id", userId)
            .gt("created_at", lastSeen);
          followingTotal += commentLikes || 0;
        }
      }

      // MY POSTS TAB notifications:
      const { data: myPosts } = await supabase
        .from("posts")
        .select("id")
        .eq("user_id", userId);

      if (myPosts && myPosts.length > 0) {
        const myPostIds = myPosts.map(p => p.id);

        const { count: postLikes } = await supabase
          .from("post_likes")
          .select("*", { count: "exact", head: true })
          .in("post_id", myPostIds)
          .neq("user_id", userId)
          .gt("created_at", lastSeen);
        mineTotal += postLikes || 0;

        const { count: postComments } = await supabase
          .from("post_comments")
          .select("*", { count: "exact", head: true })
          .in("post_id", myPostIds)
          .neq("user_id", userId)
          .gt("created_at", lastSeen);
        mineTotal += postComments || 0;
      }
    } catch (e) {
      console.error("Activity notification count error:", e);
    }

    setFollowingCount(followingTotal);
    setMineCount(mineTotal);
    setCount(followingTotal + mineTotal);
  }, [userId]);

  useEffect(() => {
    fetchCount();

    const channel = supabase
      .channel("activity-notif")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => fetchCount())
      .on("postgres_changes", { event: "*", schema: "public", table: "post_likes" }, () => fetchCount())
      .on("postgres_changes", { event: "*", schema: "public", table: "post_comments" }, () => fetchCount())
      .on("postgres_changes", { event: "*", schema: "public", table: "comment_likes" }, () => fetchCount())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [fetchCount]);

  return { count, followingCount, mineCount, refetch: fetchCount };
}
