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
    // The caller's own JWT is the only trustworthy source of identity here —
    // previously userId came straight from the request body, so anyone who
    // knew (or guessed) another user's UUID could overwrite that user's
    // verification document and reset their status to "pending" with no
    // authentication at all. Uploads now always act on the authenticated
    // caller, never on an ID the client supplies.
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
    const userId = caller.id;

    const { fileName, fileBase64, mimeType } = await req.json();

    if (!fileName || !fileBase64 || !mimeType) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
