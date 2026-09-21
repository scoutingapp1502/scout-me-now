import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Called from PublicContact.tsx right after a row is inserted into
// public_contact_messages, so the admin gets an email instead of having to
// poll the table. Best-effort: a failure here never fails the form
// submission for the visitor, it only gets logged.
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
    const { data: msg, error: fetchError } = await adminClient
      .from("public_contact_messages")
      .select("full_name, phone, email, message, created_at")
      .eq("id", id)
      .single();

    if (fetchError || !msg) {
      return new Response(JSON.stringify({ error: fetchError?.message || "Not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");
    if (!sendgridApiKey) {
      console.error("SENDGRID_API_KEY not configured — notification not sent for", id);
      return new Response(JSON.stringify({ ok: true, emailed: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Sent to suport@ (which forwards to the same inbox via ImprovMX)
    // rather than straight to the personal Gmail, so that Gmail's default
    // "Reply" picks the suport@ send-as identity instead of the personal one.
    const adminInbox = Deno.env.get("CONTACT_NOTIFY_EMAIL") || "suport@sportrise.ro";
    const escapeHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const subject = `📩 Mesaj nou de contact — ${msg.full_name}`;
    const html = `
      <div style="font-family: Arial, sans-serif; padding: 20px; background: #fafafa; color: #222;">
        <h2 style="color: #f97316; margin-bottom: 4px;">Mesaj nou din formularul de contact</h2>
        <p style="color: #888; margin-top: 0; font-size: 13px;">${new Date(msg.created_at).toLocaleString("ro-RO")}</p>
        <table style="border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 4px 12px 4px 0; color: #666;"><strong>Nume:</strong></td><td>${escapeHtml(msg.full_name)}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #666;"><strong>Email:</strong></td><td>${escapeHtml(msg.email)}</td></tr>
          <tr><td style="padding: 4px 12px 4px 0; color: #666;"><strong>Telefon:</strong></td><td>${msg.phone ? escapeHtml(msg.phone) : "—"}</td></tr>
        </table>
        <div style="background: #fff; border: 1px solid #eee; border-radius: 8px; padding: 16px; white-space: pre-wrap;">${escapeHtml(msg.message)}</div>
        <p style="color: #888; font-size: 13px; margin-top: 20px;">
          Răspunde direct la <a href="mailto:${escapeHtml(msg.email)}" style="color:#f97316;">${escapeHtml(msg.email)}</a>,
          sau folosește contul suport@sportrise.ro.
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
        from: { email: "noreply@sportrise.ro", name: "SportRise" },
        reply_to: { email: msg.email, name: msg.full_name },
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
