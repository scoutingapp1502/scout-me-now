import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Blocks an account's ability to USE the app without deleting the account or
// any of its data — per explicit product decision: a banned user keeps their
// profile/posts/messages exactly as they were (visible to others as before),
// they simply see a dedicated "account banned" page instead of the app.
//
// Deliberately NOT Supabase Auth's ban_duration anymore (that was the
// original implementation) — ban_duration rejects the login request itself
// at the Auth layer, before any of this project's own code runs, which
// means there is no way to show the user a custom page explaining why or
// how to appeal; they just get a generic failed-login error. Login is
// allowed to succeed normally now, and account_status (set here via
// set_account_status) is what the app checks right after — see
// 20261009090000_account_status_in_app_blocking.sql.

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

    const { error: updateError } = await adminClient.rpc("set_account_status", {
      p_user_id: userId,
      p_status: action === "ban" ? "banned" : "active",
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
