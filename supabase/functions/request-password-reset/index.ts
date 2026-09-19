import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Public "forgot password" entry point. The admin account's password is only
// ever changed manually from the Supabase dashboard, so for that email the
// reset is silently skipped. The check runs here with the service role (the
// is_admin_email() RPC is no longer callable from the client) and the
// response is identical either way, so nothing about which email is the
// admin's can be learned from calling this.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { email, redirectTo } = await req.json();
    if (typeof email !== "string" || !email.trim()) {
      return new Response(JSON.stringify({ error: "Missing email" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: isAdmin } = await adminClient.rpc("is_admin_email", { _email: email.trim() });

    if (!isAdmin) {
      // redirectTo is still validated by Auth against the project's allowed
      // redirect URLs, so accepting it from the client is safe.
      const { error } = await adminClient.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: typeof redirectTo === "string" ? redirectTo : undefined,
      });
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
