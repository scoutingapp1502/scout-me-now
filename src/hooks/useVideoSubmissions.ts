import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface VideoSubmission {
  id: string;
  user_id: string;
  test_key: string;
  video_url: string;
  status: string;
  grade: number | null;
  reviewer_notes: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  player_name?: string;
}

export function useVideoSubmissions(userId?: string) {
  const [submissions, setSubmissions] = useState<VideoSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchSubmissions = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("video_submissions").select("*");
    if (userId) {
      query = query.eq("user_id", userId);
    }
    const { data, error } = await query.order("created_at", { ascending: false });
    if (!error && data) {
      setSubmissions(data as VideoSubmission[]);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    fetchSubmissions();
  }, [fetchSubmissions]);

  const submitVideo = async (testKey: string, videoUrl: string, currentUserId: string) => {
    const { data, error } = await supabase
      .from("video_submissions")
      .insert({ user_id: currentUserId, test_key: testKey, video_url: videoUrl })
      .select()
      .single();

    if (!error) {
      // Call edge function for notification
      try {
        await supabase.functions.invoke("notify-video-submission", {
          body: { test_key: testKey, video_url: videoUrl },
        });
      } catch (e) {
        console.warn("Email notification failed:", e);
      }
      await fetchSubmissions();
    }
    return { data, error };
  };

  const getSubmissionForTest = (testKey: string): VideoSubmission | undefined => {
    return submissions.find((s) => s.test_key === testKey);
  };

  return { submissions, loading, fetchSubmissions, submitVideo, getSubmissionForTest };
}

export function useAdminVideoSubmissions() {
  const [submissions, setSubmissions] = useState<VideoSubmission[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("video_submissions")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) {
      // Fetch player names
      const userIds = [...new Set(data.map((s: any) => s.user_id))];
      const { data: profiles } = await supabase
        .from("player_profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", userIds);

      const profileMap = new Map(
        (profiles || []).map((p: any) => [p.user_id, `${p.first_name} ${p.last_name}`])
      );

      setSubmissions(
        (data as VideoSubmission[]).map((s) => ({
          ...s,
          player_name: profileMap.get(s.user_id) || "Necunoscut",
        }))
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const reviewVideo = async (
    submissionId: string,
    grade: number,
    reviewerNotes: string,
    reviewerId: string
  ) => {
    const { error } = await supabase
      .from("video_submissions")
      .update({
        status: "verified",
        grade,
        reviewer_notes: reviewerNotes,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", submissionId);

    if (!error) {
      await fetchAll();
    }
    return { error };
  };

  const rejectVideo = async (submissionId: string, reviewerNotes: string, reviewerId: string) => {
    const { error } = await supabase
      .from("video_submissions")
      .update({
        status: "rejected",
        reviewer_notes: reviewerNotes,
        reviewed_by: reviewerId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", submissionId);

    if (!error) {
      await fetchAll();
    }
    return { error };
  };

  return { submissions, loading, fetchAll, reviewVideo, rejectVideo };
}
