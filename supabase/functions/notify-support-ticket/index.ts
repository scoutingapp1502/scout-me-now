import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CATEGORY_LABELS: Record<string, string> = {
  bug: "O funcție nu merge",
  account: "Probleme cu contul",
  report_user: "Raportare utilizator",
  payment: "Plăți și abonamente",
  other: "Altceva",
};

// Called from HelpSection.tsx (and PostCard.tsx's "report post" flow) right
// after a row is inserted into support_tickets, so the admin gets an email
// instead of having to check the admin panel. Best-effort: a failure here
// never fails the ticket submission for the user, it only gets logged.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { id } = await req.json();
    if (typeof id !== "string" || !id) {
      return new Response(JSON.stringify({ error: "Missing id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Re-read the row server-side rather than trusting the client's payload
    // for the message content, so this can't be used to send arbitrary
    // emails through the admin's inbox.
    const { data: ticket, error: fetchError } = await adminClient
      .from("support_tickets")
      .select("user_id, category, message, created_at")
      .eq("id", id)
      .single();

    if (fetchError || !ticket) {
      return new Response(JSON.stringify({ error: fetchError?.message || "Not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: userRes } = await adminClient.auth.admin.getUserById(ticket.user_id);
    const reporterEmail = userRes?.user?.email || "necunoscut";

    const [playerRes, scoutRes] = await Promise.all([
      adminClient.from("player_profiles").select("first_name, last_name").eq("user_id", ticket.user_id).maybeSingle(),
      adminClient.from("scout_profiles").select("first_name, last_name").eq("user_id", ticket.user_id).maybeSingle(),
    ]);
    const profile = playerRes.data || scoutRes.data;
    const reporterName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Utilizator";

    const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");
    if (!sendgridApiKey) {
      console.error("SENDGRID_API_KEY not configured — notification not sent for", id);
      return new Response(JSON.stringify({ ok: true, emailed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Straight to the admin Gmail rather than suport@sportrise.ro, so the
    // mail doesn't pass through ImprovMX, which rejects SendGrid shared IPs
    // that are on SpamCop's blocklist (see notify-public-contact).
    const adminInbox = Deno.env.get("CONTACT_NOTIFY_EMAIL") || "scoutingapp1502@gmail.com";
    const escapeHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const categoryLabel = CATEGORY_LABELS[ticket.category] || ticket.category;
    const subject = `🆘 Raport nou din aplicație — ${reporterName} (${categoryLabel})`;
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background: #fafafa; color: #222;">
        <h2 style="color: #f97316; margin-bottom: 4px;">Raport nou din Ajutor și asistență</h2>
        <p style="color: #888; margin-top: 0; font-size: 13px;">${new Date(ticket.created_at).toLocaleString("ro-RO")}</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 4px 12px 4px 0; color: #666;"><strong>Utilizator:</strong></td><td>${escapeHtml(reporterName)}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #666;"><strong>Email:</strong></td><td>${escapeHtml(reporterEmail)}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #666;"><strong>Categorie:</strong></td><td>${escapeHtml(categoryLabel)}</td></tr>
        </table>
        <div style="background: #fff; border: 1px solid #eee; border-radius: 8px; padding: 16px; white-space: pre-wrap;">${escapeHtml(ticket.message)}</div>
        <p style="color: #888; font-size: 13px; margin-top: 20px;">
          Vezi și gestionează raportul din panoul de admin al aplicației (Rapoarte utilizatori).
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
        personalizations: [{ to: [{ email: adminInbox }] }],
        from: { email: "suport@sportrise.ro", name: "SportRise" },
        reply_to: { email: reporterEmail, name: reporterName },
        subject,
        content: [{ type: "text/html", value: html }],
      }),
    });

    if (!emailRes.ok) {
      console.error("SendGrid error:", await emailRes.text());
      return new Response(JSON.stringify({ ok: true, emailed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, emailed: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
