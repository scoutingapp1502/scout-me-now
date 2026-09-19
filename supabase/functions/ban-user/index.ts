import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Blocks an account's ability to log in without deleting the account or any
// of its data — per explicit product decision: a banned user keeps their
// profile/posts/messages exactly as they were (visible to others as before,
// or however the app already treats a normal account), they simply can no
// longer authenticate. Implemented via Supabase Auth's own ban_duration
// mechanism (auth.admin.updateUserById), not a custom "is_banned" column —
// that's the one place actually capable of rejecting a login attempt,
// since RLS only governs data access, not the auth handshake itself.
//
// "876000h" (100 years) stands in for "indefinite" — Supabase Auth's API
// takes a duration, not a boolean, and has no literal "forever" value.
const PERMANENT_BAN_DURATION = "876000h";

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

    const { userId, action } = await req.json();
    if (!userId || (action !== "ban" && action !== "unban")) {
      return new Response(JSON.stringify({ error: "Missing or invalid fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // An admin can never ban another admin through this endpoint — prevents
    // a compromised or malicious admin session from locking out the rest of
    // the team; that situation requires direct Supabase dashboard access.
    if (action === "ban") {
      const { data: targetRole } = await adminClient
        .from("user_roles")
        .select("role")
        .eq("user_id", userId)
        .eq("role", "admin")
        .maybeSingle();
      if (targetRole) {
        return new Response(JSON.stringify({ error: "Cannot ban an admin account" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { error: updateError } = await adminClient.auth.admin.updateUserById(userId, {
      ban_duration: action === "ban" ? PERMANENT_BAN_DURATION : "none",
    });

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), {
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
