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

    // Email notification to the admin inbox. Best-effort: a delivery
    // problem never fails the submission, it only gets logged.
    const escapeHtml = (s: string) =>
      String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const emailTo = Deno.env.get("CONTACT_NOTIFY_EMAIL") || "scoutingapp1502@gmail.com";
    const safeName = escapeHtml(player_name || "Jucător");
    const subject = `🎥 Video nou de verificat: ${test_key} — ${player_name || "Jucător"}`;
    const htmlBody = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background: #fafafa; color: #222;">
        <h2 style="color: #f97316; margin-bottom: 4px;">Video nou de verificat</h2>
        <p style="color: #888; margin-top: 0; font-size: 13px;">${new Date().toLocaleString("ro-RO")}</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 4px 12px 4px 0; color: #666;"><strong>Jucător:</strong></td><td>${safeName}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #666;"><strong>Test:</strong></td><td>${escapeHtml(test_key)}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #666;"><strong>Video:</strong></td><td><a href="${escapeHtml(video_url)}" style="color:#f97316;">Deschide videoclipul</a></td></tr>
        </table>
        <p style="color: #888; font-size: 13px;">
          Accesează panoul de administrare din aplicație pentru a verifica și acorda nota.
        </p>
      </div>
    `;

    const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");
    if (!sendgridApiKey) {
      console.error("SENDGRID_API_KEY not configured — email not sent. Submission:", submission.id);
    } else {
      const emailRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${sendgridApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: emailTo }] }],
          from: { email: "suport@sportrise.ro", name: "SportRise" },
          subject,
          content: [{ type: "text/html", value: htmlBody }],
        }),
      });
      if (!emailRes.ok) {
        console.error("SendGrid error:", await emailRes.text());
      }
    }

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
