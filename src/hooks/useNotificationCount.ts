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
    const { data: follows } = await supabase
      .from("follows")
      .select("id")
      .eq("following_id", userId);
    if (!follows) { setCount(0); return; }
    const readIds = getReadIds(userId);
    const unread = follows.filter(f => !readIds.has(f.id)).length;
    setCount(unread);
  }, [userId]);

  useEffect(() => {
    recalc();

    const onStorage = (e: StorageEvent) => {
      if (e.key?.startsWith(STORAGE_KEY)) recalc();
    };
    window.addEventListener("storage", onStorage);

    // Listen for custom event for same-tab updates
    const onCustom = () => recalc();
    window.addEventListener("notification-read-update", onCustom);

    const channel = supabase
      .channel(`notif-count-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "follows" }, () => recalc())
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "follows" }, () => recalc())
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
