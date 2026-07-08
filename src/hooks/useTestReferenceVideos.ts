import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useTestReferenceVideos() {
  const [videos, setVideos] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("test_reference_videos")
      .select("test_key, video_url");
    const map: Record<string, string> = {};
    (data || []).forEach((r: any) => { map[r.test_key] = r.video_url; });
    setVideos(map);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const saveVideo = async (testKey: string, videoUrl: string, adminUserId: string) => {
    const { error } = await (supabase as any)
      .from("test_reference_videos")
      .upsert({ test_key: testKey, video_url: videoUrl, updated_by: adminUserId }, { onConflict: "test_key" });
    if (!error) await fetchAll();
    return { error };
  };

  const removeVideo = async (testKey: string) => {
    const { error } = await (supabase as any)
      .from("test_reference_videos")
      .delete()
      .eq("test_key", testKey);
    if (!error) await fetchAll();
    return { error };
  };

  return { videos, loading, saveVideo, removeVideo, refetch: fetchAll };
}
