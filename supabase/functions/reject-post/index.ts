import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rejecting a post is a hard delete, not a status flip — a rejected post
// has no further purpose (it's not shown to anyone, including the author,
// once resolved) and keeping it around only wastes DB + storage space. This
// deletes the post row and its media files, and increments a durable
// counter on the author's profile (rejected_posts_count) so they can still
// see how many of their posts have been rejected over time even though the
// posts themselves are gone.
//
// Storage deletion happens with the service role because RLS/ownership on
// storage.objects is keyed to the uploader, not to whichever admin is
// rejecting the post.
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

    const { post_id } = await req.json();
    if (!post_id) {
      return new Response(JSON.stringify({ error: "Missing post_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: post, error: fetchError } = await adminClient
      .from("posts")
      .select("id, user_id, image_url, video_url")
      .eq("id", post_id)
      .maybeSingle();
    if (fetchError || !post) {
      return new Response(JSON.stringify({ error: "Post not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Best-effort file cleanup — a storage failure must not block the row
    // deletion (an orphaned file is a minor cost; a post stuck un-rejected
    // because of a storage hiccup is worse).
    for (const url of [post.image_url, post.video_url]) {
      if (!url) continue;
      const parsed = parseStorageUrl(url);
      if (!parsed) continue;
      const { error: removeError } = await adminClient.storage.from(parsed.bucket).remove([parsed.path]);
      if (removeError) console.error(`Failed to remove ${parsed.bucket}/${parsed.path}:`, removeError);
    }

    const { error: incrementError } = await adminClient.rpc("increment_rejected_posts_count", { p_user_id: post.user_id });
    if (incrementError) console.error("Failed to increment rejected_posts_count:", incrementError);

    const { error: deleteError } = await adminClient.from("posts").delete().eq("id", post_id);
    if (deleteError) {
      return new Response(JSON.stringify({ error: deleteError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
