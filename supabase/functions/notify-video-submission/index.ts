import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { test_key, video_url, player_name } = await req.json();

    if (!test_key || !video_url) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert into video_submissions
    const { data: submission, error: insertError } = await supabase
      .from("video_submissions")
      .insert({
        user_id: user.id,
        test_key,
        video_url,
        status: "pending",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Insert error:", insertError);
      return new Response(JSON.stringify({ error: insertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Send email notification via SMTP-like approach using fetch to a simple email service
    // We'll use Supabase's built-in ability to send via edge function
    const emailTo = "scoutingapp1502@gmail.com";
    const subject = `🎥 Video nou de verificat: ${test_key} — ${player_name || "Jucător"}`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background: #1a1a2e; color: #eee;">
        <h2 style="color: #3B82F6;">🎥 Video Nou de Verificat</h2>
        <p><strong>Jucător:</strong> ${player_name || "Necunoscut"}</p>
        <p><strong>Test:</strong> ${test_key}</p>
        <p><strong>Video URL:</strong> <a href="${video_url}" style="color: #3B82F6;">${video_url}</a></p>
        <p><strong>Data:</strong> ${new Date().toLocaleString("ro-RO")}</p>
        <hr style="border-color: #333;" />
        <p>Accesează panoul de administrare din aplicație pentru a verifica și acorda nota.</p>
      </div>
    `;

    // Use Resend or a simple SMTP - for now we'll log the email content
    // The admin will see submissions in the admin panel
    console.log(`Email notification for video submission:`, {
      to: emailTo,
      subject,
      submissionId: submission.id,
    });

    return new Response(
      JSON.stringify({ success: true, submission }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
