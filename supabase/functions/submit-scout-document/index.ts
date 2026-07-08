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
    const { userId, fileName, fileBase64, mimeType } = await req.json();

    if (!userId || !fileName || !fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Verify user exists
    const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(userId);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode base64 and upload to storage
    const fileBytes = Uint8Array.from(atob(fileBase64), (c) => c.charCodeAt(0));
    const ext = fileName.split(".").pop() || "pdf";
    const storagePath = `${userId}/${Date.now()}.${ext}`;

    const { error: uploadError } = await adminClient.storage
      .from("scout-documents")
      .upload(storagePath, fileBytes, { contentType: mimeType, upsert: true });

    if (uploadError) {
      return new Response(JSON.stringify({ error: uploadError.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get signed URL (stored for admin to use later)
    const documentUrl = `${supabaseUrl}/storage/v1/object/scout-documents/${storagePath}`;

    // Insert or update verification request
    const { error: insertError } = await adminClient
      .from("scout_verification_requests")
      .upsert({
        user_id: userId,
        document_url: documentUrl,
        status: "pending",
        reviewed_at: null,
        reviewer_notes: null,
      }, { onConflict: "user_id" });

    if (insertError) {
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
