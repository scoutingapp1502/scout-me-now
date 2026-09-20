import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rejecting a pending avatar deletes the staged file from storage and clears
// pending_photo_url/avatar_moderation_status — the previously-approved
// photo_url is untouched throughout (it was never replaced to begin with,
// per the "old avatar stays visible until the new one is approved" design —
// see 20261006090000_avatar_moderation.sql). Per explicit product decision,
// a rejected avatar counts the same as a rejected post toward
// rejected_posts_count / the "users at risk of blocking" list — not tracked
// separately.
const STORAGE_MARKER = "/storage/v1/object/";

function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  const idx = url.indexOf(STORAGE_MARKER);
  if (idx === -1) return null;
  let rest = url.slice(idx + STORAGE_MARKER.length);
  const q = rest.indexOf("?");
  if (q !== -1) rest = rest.slice(0, q);
  rest = rest.replace(/^(public|sign|authenticated)\//, "");
  const slash = rest.indexOf("/");
  if (slash === -1) return null;
  const bucket = rest.slice(0, slash);
  let path = rest.slice(slash + 1);
  try { path = decodeURI(path); } catch { /* keep as-is */ }
  if (!bucket || !path) return null;
  return { bucket, path };
}

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

    // skip_counter: true when this delete is happening because
    // approve_user_report already incremented approved_reports_count for
    // this account — see reject-post's identical parameter for the full
    // rationale (keeping the automated-pipeline counter and the
    // user-report counter independent).
    //
    // reject_live: true is for a user-filed report on the CURRENT,
    // already-approved avatar (photo_url) — the common case for a report,
    // as opposed to AdminContentModeration's use of this function, which
    // only ever targets a pending_photo_url still awaiting the automated
    // pipeline's decision. Without this distinction, reporting someone's
    // live avatar 400'd here with "No pending avatar to reject" (real
    // production bug: approve_user_report's counter incremented but the
    // photo was never actually removed).
    const { user_id, avatar_table, reason, skip_counter, reject_live } = await req.json();
    if (!user_id || (avatar_table !== "player_profiles" && avatar_table !== "scout_profiles")) {
      return new Response(JSON.stringify({ error: "Missing/invalid user_id or avatar_table" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: fetchError } = await adminClient
      .from(avatar_table)
      .select("user_id, pending_photo_url, photo_url")
      .eq("user_id", user_id)
      .maybeSingle();
    if (fetchError || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (reject_live) {
      // Best-effort file cleanup for the live photo — same rationale as the
      // pending-file cleanup below (an orphaned file is a minor cost; a
      // report stuck unresolved because of a storage hiccup is worse).
      const liveUrl = (profile as any).photo_url;
      if (liveUrl) {
        const parsed = parseStorageUrl(liveUrl);
        if (parsed) {
          const { error: removeError } = await adminClient.storage.from(parsed.bucket).remove([parsed.path]);
          if (removeError) console.error(`Failed to remove ${parsed.bucket}/${parsed.path}:`, removeError);
        }
      }
      const { error: rejectLiveError } = await adminClient.rpc("reject_live_avatar", { p_user_id: user_id, p_table: avatar_table });
      if (rejectLiveError) {
        return new Response(JSON.stringify({ error: rejectLiveError.message }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Best-effort — see reject-post's identical call for the full
      // rationale (generic, separate from any counter, fires regardless of
      // skip_counter).
      const { error: liveNoticeError } = await adminClient.rpc("issue_content_rejection_notice", { p_user_id: user_id, p_content_type: "avatar" });
      if (liveNoticeError) console.error("Failed to issue content rejection notice:", liveNoticeError);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!(profile as any).pending_photo_url) {
      return new Response(JSON.stringify({ error: "No pending avatar to reject" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Best-effort file cleanup — a storage failure must not block clearing
    // the pending state (an orphaned file is a minor cost; an avatar stuck
    // un-rejected because of a storage hiccup is worse).
    const parsed = parseStorageUrl((profile as any).pending_photo_url);
    if (parsed) {
      const { error: removeError } = await adminClient.storage.from(parsed.bucket).remove([parsed.path]);
      if (removeError) console.error(`Failed to remove ${parsed.bucket}/${parsed.path}:`, removeError);
    }

    const { error: rejectError } = await adminClient.rpc("reject_pending_avatar", {
      p_user_id: user_id, p_table: avatar_table, p_reason: reason ?? null, p_skip_counter: !!skip_counter,
    });
    if (rejectError) {
      return new Response(JSON.stringify({ error: rejectError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: noticeError } = await adminClient.rpc("issue_content_rejection_notice", { p_user_id: user_id, p_content_type: "avatar" });
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
