import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rejects a video highlight submission — either one still pending/flagged
// (never went live) or one already 'approved' (a user report against a
// live highlight being upheld; reject_video_highlight in
// 20261015090000_video_highlights_moderation.sql already removes it from
// the live video_highlights/video_descriptions arrays in that case). This
// function's own job is just the storage file cleanup + calling that RPC —
// same division of labor as reject-post/reject-avatar (service role for
// storage, since RLS on storage.objects is keyed to the uploader, not
// whichever admin is rejecting).
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: { user: caller }, error: authError } = await adminClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: callerRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!callerRole) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { submission_id } = await req.json();
    if (!submission_id) {
      return new Response(JSON.stringify({ error: "Missing submission_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: submission, error: fetchError } = await adminClient
      .from("video_highlight_submissions")
      .select("id, user_id, storage_path")
      .eq("id", submission_id)
      .maybeSingle();
    if (fetchError || !submission) {
      return new Response(JSON.stringify({ error: "Submission not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Best-effort file cleanup — a storage failure must not block the
    // rejection (an orphaned file is a minor cost; a submission stuck
    // un-rejected because of a storage hiccup is worse).
    const { error: removeError } = await adminClient.storage.from("player-videos").remove([(submission as any).storage_path]);
    if (removeError) console.error(`Failed to remove player-videos/${(submission as any).storage_path}:`, removeError);

    const { error: rejectError } = await adminClient.rpc("reject_video_highlight", { p_submission_id: submission_id });
    if (rejectError) {
      return new Response(JSON.stringify({ error: rejectError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: noticeError } = await adminClient.rpc("issue_content_rejection_notice", {
      p_user_id: (submission as any).user_id, p_content_type: "video_highlight",
    });
    if (noticeError) console.error("Failed to issue content rejection notice:", noticeError);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
