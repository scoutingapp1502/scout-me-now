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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const appUrl = (Deno.env.get("PUBLIC_APP_URL") || "https://sportrise.app").replace(/\/$/, "");

    // Verify caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user }, error: authError } = await adminClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { targetEmail, message, relationship, club, seasonFrom, seasonTo } = await req.json();
    if (!targetEmail || !message) {
      return new Response(JSON.stringify({ error: "targetEmail and message required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch requester name
    const { data: requesterProfile } = await adminClient
      .from("profiles")
      .select("full_name")
      .eq("user_id", user.id)
      .maybeSingle();
    const requesterName = requesterProfile?.full_name || "Cineva de pe SportRise";

    // Check if target email belongs to an existing user
    const { data: usersData } = await adminClient.auth.admin.listUsers();
    const existingUser = usersData?.users?.find((u) => u.email === targetEmail);

    if (existingUser) {
      // User exists → insert recommendation request into DB
      const { error: insertError } = await adminClient.from("recommendations").insert({
        recipient_user_id: user.id,
        author_user_id: existingUser.id,
        content: message,
        status: "pending",
        initiated_by: "request",
      });
      if (insertError) {
        return new Response(JSON.stringify({ error: insertError.message }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ ok: true, method: "in_app" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // User not found → create external recommendation request with token
    const { data: requestRow, error: requestError } = await adminClient
      .from("external_recommendation_requests")
      .insert({
        requester_user_id: user.id,
        requester_name: requesterName,
        target_email: targetEmail,
        relationship: relationship || null,
        club: club || null,
        season_from: seasonFrom || null,
        season_to: seasonTo || null,
        message: message,
        status: "pending",
      })
      .select("token")
      .single();

    if (requestError || !requestRow) {
      return new Response(JSON.stringify({ error: requestError?.message || "Failed to create request" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = requestRow.token;
    const recommendUrl = `${appUrl}/recommend?token=${token}`;

    // Build context line for the email
    const contextParts: string[] = [];
    if (relationship) contextParts.push(relationship);
    if (club) contextParts.push(club);
    if (seasonFrom && seasonTo) {
      contextParts.push(seasonFrom === seasonTo ? seasonFrom : `${seasonFrom}–${seasonTo}`);
    }
    const contextLine = contextParts.length > 0
      ? `<p style="color:#94a3b8;font-size:14px;margin:4px 0 0 0;">${contextParts.join(" · ")}</p>`
      : "";

    const emailHtml = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0f172a;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:12px;overflow:hidden;border:1px solid #334155;">
          <tr>
            <td style="padding:32px 32px 24px 32px;">
              <p style="color:#4ade80;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 16px 0;">SportRise</p>
              <h1 style="color:#f1f5f9;font-size:22px;margin:0 0 8px 0;line-height:1.3;">
                ${requesterName} te roagă să scrii o recomandare
              </h1>
              ${contextLine}
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 24px 32px;">
              <div style="background:#0f172a;border-radius:8px;padding:16px 20px;border-left:3px solid #4ade80;">
                <p style="color:#cbd5e1;font-size:14px;line-height:1.6;margin:0;white-space:pre-wrap;">${message}</p>
              </div>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px 32px;">
              <a href="${recommendUrl}"
                style="display:inline-block;background:#4ade80;color:#0f172a;font-weight:700;font-size:15px;text-decoration:none;padding:14px 28px;border-radius:8px;letter-spacing:0.3px;">
                Scrie o recomandare
              </a>
              <p style="color:#64748b;font-size:12px;margin:16px 0 0 0;">
                Dacă nu îl cunoști pe ${requesterName} sau nu dorești să scrii, poți ignora acest email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured — email not sent. Token:", token);
      return new Response(JSON.stringify({ ok: true, method: "email_invite", warning: "email_not_sent_no_api_key" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const emailRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "SportRise <onboarding@resend.dev>",
        to: [targetEmail],
        subject: `${requesterName} te roagă să scrii o recomandare`,
        html: emailHtml,
      }),
    });

    if (!emailRes.ok) {
      const errBody = await emailRes.text();
      console.error("Resend error:", errBody);
      return new Response(JSON.stringify({ error: `Email send failed: ${errBody}` }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, method: "email_invite" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
