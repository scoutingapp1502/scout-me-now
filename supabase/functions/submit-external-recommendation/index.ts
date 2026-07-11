import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { token, authorName, content } = await req.json();
    if (!token || !authorName?.trim() || !content?.trim()) {
      return new Response(JSON.stringify({ error: "token, authorName and content required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Fetch and validate the request
    const { data: request, error: fetchError } = await adminClient
      .from("external_recommendation_requests")
      .select("id, requester_user_id, target_email, status")
      .eq("token", token)
      .maybeSingle();

    if (fetchError || !request) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (request.status === "completed") {
      return new Response(JSON.stringify({ error: "already_completed" }), {
        status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert the external recommendation (status = 'submitted', awaiting owner approval)
    const { error: insertError } = await adminClient
      .from("external_recommendations")
      .insert({
        request_id: request.id,
        recipient_user_id: request.requester_user_id,
        author_name: authorName.trim(),
        author_email: request.target_email,
        content: content.trim(),
        status: "submitted",
      });

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark request as completed
    await adminClient
      .from("external_recommendation_requests")
      .update({ status: "completed", completed_at: new Date().toISOString() })
      .eq("id", request.id);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
