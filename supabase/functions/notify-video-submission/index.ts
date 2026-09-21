import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

// Called from submitVideoSubmission() (useVideoSubmissions.ts) AFTER the
// client has already upserted the video_submissions row. This function only
// notifies the admin by email — it must not insert the row itself: the table
// has a unique index on (user_id, test_key), so a second insert always failed
// with a duplicate-key error before the email was ever sent.
//
// Best-effort with respect to email: a delivery problem is logged and never
// turns into an error for the player.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "No auth" }, 401);

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    const { test_key } = await req.json();
    if (typeof test_key !== "string" || !test_key) return json({ error: "Missing fields" }, 400);

    // Read what was actually saved rather than trusting the request body for
    // the content of an email that lands in the admin's inbox.
    const { data: submission, error: fetchError } = await supabase
      .from("video_submissions")
      .select("id, video_url")
      .eq("user_id", user.id)
      .eq("test_key", test_key)
      .maybeSingle();

    if (fetchError || !submission) {
      console.error("Submission not found for notification:", fetchError, user.id, test_key);
      return json({ error: "Submission not found" }, 404);
    }

    const { data: profile } = await supabase
      .from("player_profiles")
      .select("first_name, last_name")
      .eq("user_id", user.id)
      .maybeSingle();
    const playerName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "";

    const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");
    if (!sendgridApiKey) {
      console.error("SENDGRID_API_KEY not configured — email not sent. Submission:", submission.id);
      return json({ success: true, emailed: false });
    }

    const escapeHtml = (s: string) =>
      String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const emailTo = Deno.env.get("CONTACT_NOTIFY_EMAIL") || "scoutingapp1502@gmail.com";
    const displayName = playerName || "Jucător";
    const subject = `🎥 Video nou de verificat: ${test_key} — ${displayName}`;

    // Uploaded videos live in a private bucket, so a raw URL may not open
    // for the admin — only link http(s) URLs, and always point to the panel.
    const videoUrl = String(submission.video_url || "");
    const videoRow = /^https?:\/\//i.test(videoUrl)
      ? `<tr><td style="padding: 4px 12px 4px 0; color: #666;"><strong>Video:</strong></td><td><a href="${escapeHtml(videoUrl)}" style="color:#f97316;">Deschide linkul videoclipului</a></td></tr>`
      : "";

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background: #fafafa; color: #222;">
        <h2 style="color: #f97316; margin-bottom: 4px;">Video nou de verificat</h2>
        <p style="color: #888; margin-top: 0; font-size: 13px;">${new Date().toLocaleString("ro-RO")}</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 4px 12px 4px 0; color: #666;"><strong>Jucător:</strong></td><td>${escapeHtml(displayName)}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #666;"><strong>Test:</strong></td><td>${escapeHtml(test_key)}</td></tr>
          ${videoRow}
        </table>
        <p style="color: #888; font-size: 13px;">
          Deschide panoul de administrare din aplicație (Verificare Videouri) pentru a verifica și acorda nota.
        </p>
      </div>
    `;

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
      return json({ success: true, emailed: false });
    }

    return json({ success: true, emailed: true });
  } catch (err) {
    console.error("Error:", err);
    return json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});
