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
    const { userId, decision, reviewerNotes } = await req.json();

    if (!userId || !decision) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendKey = Deno.env.get("RESEND_API_KEY")!;
    const appUrl = (Deno.env.get("PUBLIC_APP_URL") ?? "").replace(/\/$/, "");

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Get user email
    const { data: userData, error: userError } = await adminClient.auth.admin.getUserById(userId);
    if (userError || !userData.user?.email) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = userData.user.email;

    // Get scout name
    const { data: profile } = await adminClient
      .from("scout_profiles")
      .select("first_name, last_name")
      .eq("user_id", userId)
      .maybeSingle();

    const name = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Scouter";
    const isApproved = decision === "approved";

    const subject = isApproved
      ? "Contul tău SportRise a fost aprobat"
      : "Actualizare privind contul tău SportRise";

    const html = isApproved
      ? `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0a0f0a;color:#e8f5e9;border-radius:12px">
          <h1 style="color:#4ade80;font-size:24px;margin-bottom:8px">Cont aprobat ✓</h1>
          <p style="color:#a7c4ab;margin-bottom:16px">Bună, <strong style="color:#e8f5e9">${name}</strong>,</p>
          <p style="color:#a7c4ab;line-height:1.6">
            Documentul tău de scouter a fost verificat și contul a fost <strong style="color:#4ade80">aprobat</strong>.
            Poți accesa acum platforma SportRise.
          </p>
          ${reviewerNotes ? `<div style="background:#1a2e1a;border-left:3px solid #4ade80;padding:12px 16px;margin:20px 0;border-radius:4px"><p style="margin:0;color:#a7c4ab;font-size:14px">Notă de la echipă: <em>${reviewerNotes}</em></p></div>` : ""}
          <a href="${appUrl}/auth?tab=login"
             style="display:inline-block;margin-top:24px;padding:12px 28px;background:#4ade80;color:#0a0f0a;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">
            Intră în cont
          </a>
          <p style="color:#4a6b4d;font-size:12px;margin-top:32px">SportRise — Platforma sportivilor de performanță</p>
        </div>
      `
      : `
        <div style="font-family:sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;background:#0a0f0a;color:#e8f5e9;border-radius:12px">
          <h1 style="color:#f87171;font-size:24px;margin-bottom:8px">Cerere respinsă</h1>
          <p style="color:#a7c4ab;margin-bottom:16px">Bună, <strong style="color:#e8f5e9">${name}</strong>,</p>
          <p style="color:#a7c4ab;line-height:1.6">
            În urma verificării documentului transmis, cererea ta de cont Scouter nu a putut fi aprobată.
          </p>
          ${reviewerNotes ? `<div style="background:#2e1a1a;border-left:3px solid #f87171;padding:12px 16px;margin:20px 0;border-radius:4px"><p style="margin:0;color:#a7c4ab;font-size:14px">Motiv: <em>${reviewerNotes}</em></p></div>` : ""}
          <p style="color:#a7c4ab;line-height:1.6;margin-top:16px">
            Dacă crezi că este o eroare sau dorești să transmiți un alt document, te rugăm să ne contactezi.
          </p>
          <p style="color:#4a6b4d;font-size:12px;margin-top:32px">SportRise — Platforma sportivilor de performanță</p>
        </div>
      `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "SportRise <onboarding@resend.dev>",
        to: [email],
        subject,
        html,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      return new Response(JSON.stringify({ error: err }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
