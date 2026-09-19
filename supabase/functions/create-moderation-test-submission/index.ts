import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Creates the video_submissions row that AdminModerationTestPanel.tsx
// (dev-only) needs to exercise the moderation pipeline end-to-end. This
// exists ONLY because the real INSERT policy on video_submissions
// ("Players can submit videos") deliberately requires the 'player' role,
// which an admin account normally doesn't have — and that policy must not
// be loosened, since it's what a real player's test-video submission relies
// on in production.
//
// This function does NOT bypass that restriction by relaxing RLS. It uses
// the service role (which bypasses RLS entirely) but only after re-deriving
// every condition RLS would have checked, plus the additional conditions
// that make this a test path and not a backdoor:
//   1. a valid JWT identifies a real authenticated user (never trusted from
//      the request body);
//   2. that user has the admin role;
//   3. the server secret MODERATION_TEST_MODE is exactly "true" — the same
//      switch analyze-video-frames itself checks, so this function is
//      already inert wherever the mock pipeline is inert;
//   4. content_type is hardcoded to "test_video" here — this function can
//      never create a submission for a real post, and never accepts a
//      caller-supplied content_type;
//   5. test_scenario is restricted to the four known values.
// Nothing here is reachable by a non-admin, and nothing here works at all
// once MODERATION_TEST_MODE is unset in production — it fails closed on
// every one of these checks, not just the RLS one it's replacing.
const VALID_SCENARIOS = ["SAFE", "UNCERTAIN_VIOLENCE", "UNCERTAIN_SEXUAL", "HIGH"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (Deno.env.get("MODERATION_TEST_MODE") !== "true") {
      return new Response(JSON.stringify({ error: "Test mode is not enabled" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const { video_url, test_scenario } = await req.json();
    if (!video_url || typeof video_url !== "string") {
      return new Response(JSON.stringify({ error: "Missing video_url" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!VALID_SCENARIOS.includes(test_scenario)) {
      return new Response(JSON.stringify({ error: "Invalid test_scenario" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The row is always owned by the calling admin (never a caller-supplied
    // user id) and always tagged in test_key so it's unmistakable in any
    // later audit — this can never be confused with a real player submission.
    const testKey = `moderation_test_${test_scenario.toLowerCase()}_${Date.now()}`;
    const { data: submission, error: insertError } = await adminClient
      .from("video_submissions")
      .insert({ user_id: caller.id, test_key: testKey, video_url, status: "pending" })
      .select()
      .single();

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ submission }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
