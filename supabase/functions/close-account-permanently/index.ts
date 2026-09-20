import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Irreversible account closure — explicitly different from ban-user (which
// only blocks app usage and can be undone). This:
//   1. blocks app usage immediately, same account_status mechanism as
//      ban-user (see 20261009090000_account_status_in_app_blocking.sql),
//      but set to 'closed' rather than 'banned' — the app shows a
//      different, permanent-sounding page for this status, with no path
//      back to 'active' anywhere in this project's code;
//   2. permanently blacklists the account's email address, so it can never
//      be used to register again — enforced server-side by a trigger on
//      auth.users (reject_blacklisted_email_trigger), not just by this
//      function, so it can't be bypassed by any other signup path.
// The account's data is NOT deleted — same product decision as ban-user,
// this only ever removes the ability to use the app, never the content.

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

    const { userId, reason } = await req.json();
    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // An admin can never permanently close another admin's account through
    // this endpoint — same guard as ban-user, for the same reason: prevents
    // a compromised/malicious admin session from locking out the team.
    const { data: targetRole } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    if (targetRole) {
      return new Response(JSON.stringify({ error: "Cannot close an admin account" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: targetUser, error: getUserError } = await adminClient.auth.admin.getUserById(userId);
    if (getUserError || !targetUser?.user?.email) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: blacklistError } = await adminClient
      .from("email_blacklist")
      .upsert({
        email: targetUser.user.email.toLowerCase(),
        reason: reason || null,
        blacklisted_by: caller.id,
      }, { onConflict: "email" });
    if (blacklistError) {
      return new Response(JSON.stringify({ error: blacklistError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: statusError } = await adminClient.rpc("set_account_status", {
      p_user_id: userId, p_status: "closed",
    });
    if (statusError) {
      return new Response(JSON.stringify({ error: statusError.message }), {
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
