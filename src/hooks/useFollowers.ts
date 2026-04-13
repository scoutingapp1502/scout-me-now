import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Follower {
  id: string;
  follower_id: string;
  created_at: string;
  name: string;
  photo: string | null;
  role: "player" | "scout" | "agent";
}

export function useFollowers(userId: string | null) {
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchFollowers = async () => {
    if (!userId) return;

    const { data: follows } = await supabase
      .from("follows")
      .select("id, follower_id, created_at")
      .eq("following_id", userId)
      .order("created_at", { ascending: false });

    if (!follows || follows.length === 0) {
      setFollowers([]);
      setCount(0);
      setLoading(false);
      return;
    }

    setCount(follows.length);
    const followerIds = follows.map(f => f.follower_id);

    const { data: roles } = await supabase
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", followerIds);

    const roleMap: Record<string, string> = {};
    roles?.forEach(r => { roleMap[r.user_id] = r.role; });

    const playerIds = followerIds.filter(id => roleMap[id] === "player");
    const scoutIds = followerIds.filter(id => roleMap[id] === "scout" || roleMap[id] === "agent");

    let playerMap: Record<string, { name: string; photo: string | null }> = {};
    let scoutMap: Record<string, { name: string; photo: string | null }> = {};

    if (playerIds.length > 0) {
      const { data } = await supabase.from("player_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", playerIds);
      data?.forEach(p => { playerMap[p.user_id] = { name: `${p.first_name} ${p.last_name}`.trim(), photo: p.photo_url }; });
    }
    if (scoutIds.length > 0) {
      const { data } = await supabase.from("scout_profiles").select("user_id, first_name, last_name, photo_url").in("user_id", scoutIds);
      data?.forEach(s => { scoutMap[s.user_id] = { name: `${s.first_name} ${s.last_name}`.trim(), photo: s.photo_url }; });
    }

    const mapped: Follower[] = follows.map(f => {
      const role = (roleMap[f.follower_id] || "player") as Follower["role"];
      const info = role === "player" ? playerMap[f.follower_id] : scoutMap[f.follower_id];
      return {
        id: f.id,
        follower_id: f.follower_id,
        created_at: f.created_at,
        name: info?.name || "Unknown",
        photo: info?.photo || null,
        role,
      };
    });

    setFollowers(mapped);
    setLoading(false);
  };

  const removeFollower = async (followId: string) => {
    await supabase.from("follows").delete().eq("id", followId);
    setFollowers(prev => prev.filter(f => f.id !== followId));
    setCount(prev => Math.max(0, prev - 1));
  };

  useEffect(() => {
    fetchFollowers();

    const channel = supabase
      .channel(`followers-${userId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "follows" }, () => {
        fetchFollowers();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  return { followers, count, loading, removeFollower };
}
