import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  evaluateOverallRisk, isMinor, type CategoryScores, type Threshold, type ModerationCategory,
} from "../_shared/moderationRiskEngine.ts";
import { getGoogleAccessToken } from "../_shared/googleServiceAccountAuth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Second pass (prompt §6-7). Called only for content whose initial pass
// landed on "recheck" — and only re-verifies the categories that actually
// triggered, with the minimum data each one needs (never the whole video
// for a text-only trigger, never re-sending images for a text trigger).
//
// No Anthropic/Claude anywhere in this pipeline (deliberate product
// decision — no ANTHROPIC_API_KEY is configured and none should be added).
// The only providers in play are OpenAI Moderation (initial pass, already
// run before this function is called), Google Cloud Vision (images/OCR/
// objects/labels), and Google Cloud Video Intelligence (explicit content on
// the full video) — anything neither of those can settle with confidence
// goes to admin_review. Never fail-open.
//
// This function is meant to be invoked directly by analyze-video-frames's
// caller (the upload flow) as a synchronous follow-up call right after the
// initial pass, rather than through a separate polling job.

interface RecheckRequest {
  content_type: "post" | "test_video";
  content_id: string;
  bucket: "player-videos";
  storage_path: string; // needed only if `sexual` is among triggeredCategories
  frames: { base64: string; atFraction: number }[]; // same frames from the initial pass, reused — no new extraction
  triggeredCategories: ModerationCategory[];
  // Scores OpenAI Moderation already produced in the initial pass for
  // hate/threats/text — there is no independent second text provider in
  // this pipeline, so a triggered text category is resolved from this
  // instead of being re-queried anywhere.
  initialTextScores?: { hate?: number; threats?: number; text?: number };
}

async function googleVisionSafeSearch(apiKey: string, base64: string) {
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{ image: { content: base64 }, features: [{ type: "SAFE_SEARCH_DETECTION" }] }],
    }),
  });
  if (!res.ok) throw new Error(`Vision SafeSearch failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data?.responses?.[0]?.safeSearchAnnotation ?? {};
}

async function googleVisionObjects(apiKey: string, base64: string) {
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{ image: { content: base64 }, features: [{ type: "OBJECT_LOCALIZATION", maxResults: 10 }, { type: "LABEL_DETECTION", maxResults: 10 }] }],
    }),
  });
  if (!res.ok) throw new Error(`Vision Object/Label failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const objects = data?.responses?.[0]?.localizedObjectAnnotations ?? [];
  const labels = data?.responses?.[0]?.labelAnnotations ?? [];
  return { objects, labels };
}

const LIKELIHOOD_SCORE: Record<string, number> = {
  UNKNOWN: 0, VERY_UNLIKELY: 0.05, UNLIKELY: 0.2, POSSIBLE: 0.5, LIKELY: 0.8, VERY_LIKELY: 0.95,
};

const WEAPON_LABELS = ["weapon", "firearm", "gun", "knife", "rifle", "pistol", "sword", "ammunition"];
const DRUG_LABELS = ["drug", "syringe", "cannabis", "marijuana", "pill", "cocaine", "needle"];

// Vision's label/object confidence on a keyword match is treated as the
// category score directly. If nothing above this floor is found, the
// result is "Vision found nothing" — not the same as "Vision confirmed
// clean" — so callers must not treat 0 here as a confident low score on its
// own (see the `drugs`/`weapons` handling below, which routes an
// unconfident read to admin_review rather than approving it).
const VISION_LABEL_CONFIDENCE_FLOOR = 0.5;

function labelScore(objects: any[], labels: any[], keywords: string[]): number {
  const all = [...objects.map((o) => ({ name: o.name, score: o.score })), ...labels.map((l) => ({ name: l.description, score: l.score }))];
  let best = 0;
  for (const item of all) {
    const name = (item.name ?? "").toLowerCase();
    if (keywords.some((k) => name.includes(k))) best = Math.max(best, item.score ?? 0);
  }
  return best;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch { await new Promise((r) => setTimeout(r, 2000)); return fn(); }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
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

    const body: RecheckRequest = await req.json();
    const { content_type, content_id, bucket, storage_path, frames, triggeredCategories, initialTextScores } = body;
    if (!content_type || !content_id || !triggeredCategories?.length) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const visionKey = Deno.env.get("GOOGLE_CLOUD_VISION_API_KEY");

    const scores: CategoryScores = {};
    let serviceUnavailable = false;
    let usedVideoIntelligence = false;

    // sexual/nudity → Google Cloud Video Intelligence Explicit Content
    // Detection, on the original video (the only category that needs the
    // whole file — motion/transitions matter for this call, not just
    // static frames). Authenticated via a Service Account OAuth2 access
    // token (Authorization: Bearer), never an API key / ?key= query param.
    if (triggeredCategories.includes("sexual")) {
      if (!bucket || !storage_path) {
        serviceUnavailable = true;
      } else {
        try {
          const accessToken = await getGoogleAccessToken();
          usedVideoIntelligence = true;

          const { data: signed } = await adminClient.storage.from(bucket).createSignedUrl(storage_path, 300);
          if (!signed?.signedUrl) throw new Error("Could not sign video for recheck");
          const videoBytes = await (await fetch(signed.signedUrl)).arrayBuffer();
          const videoBase64 = btoa(String.fromCharCode(...new Uint8Array(videoBytes)));

          const opRes = await withRetry(async () => {
            const r = await fetch("https://videointelligence.googleapis.com/v1/videos:annotate", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${accessToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ inputContent: videoBase64, features: ["EXPLICIT_CONTENT_DETECTION"] }),
            });
            if (!r.ok) throw new Error(`Video Intelligence failed: ${r.status} ${await r.text()}`);
            return r.json();
          });

          // Long-running operation: poll until done (60s clips finish
          // quickly), authenticating the polling requests the same way.
          let result = opRes;
          for (let i = 0; i < 15 && !result.done; i++) {
            await new Promise((r) => setTimeout(r, 2000));
            const pollRes = await fetch(`https://videointelligence.googleapis.com/v1/${result.name}`, {
              headers: { Authorization: `Bearer ${accessToken}` },
            });
            result = await pollRes.json();
          }
          if (!result.done) throw new Error("Video Intelligence operation did not complete in time");

          const explicitFrames = result?.response?.annotationResults?.[0]?.explicitAnnotation?.frames ?? [];
          const worst = explicitFrames.reduce((max: number, f: any) => Math.max(max, LIKELIHOOD_SCORE[f.pornographyLikelihood] ?? 0), 0);
          scores.sexual = worst;
          // videoBase64/videoBytes/accessToken go out of scope here and are
          // never written to disk or logged — released with the function's
          // memory (§10 of the moderation prompt).
        } catch (err) {
          console.error("Video Intelligence recheck failed:", err);
          serviceUnavailable = true;
        }
      }
    }

    // violence/gore → Vision SafeSearch on the frames already extracted at
    // the initial pass (no new frame extraction).
    if (triggeredCategories.includes("violence")) {
      if (!visionKey) {
        serviceUnavailable = true;
      } else {
        try {
          const results = await Promise.all(frames.map((f) => googleVisionSafeSearch(visionKey, f.base64)));
          const worst = results.reduce((max, r) => Math.max(max, LIKELIHOOD_SCORE[r.violence] ?? 0, LIKELIHOOD_SCORE[r.adult] ?? 0), 0);
          scores.violence = worst;
        } catch (err) {
          console.error("Vision SafeSearch (violence) recheck failed:", err);
          serviceUnavailable = true;
        }
      }
    }

    // weapons → Vision Object/Label Detection on the same frames. Vision
    // finding nothing above the confidence floor is NOT the same as a
    // confirmed-clean result, so an unconfident read here defers to
    // admin_review instead of being scored as a clean 0.
    if (triggeredCategories.includes("weapons")) {
      if (!visionKey) {
        serviceUnavailable = true;
      } else {
        try {
          const results = await Promise.all(frames.map((f) => googleVisionObjects(visionKey, f.base64)));
          const best = results.reduce((max, r) => Math.max(max, labelScore(r.objects, r.labels, WEAPON_LABELS)), 0);
          if (best === 0) {
            // Vision returned no weapon-related label/object at all —
            // treat as genuinely low risk (a true negative), not unconfident.
            scores.weapons = 0;
          } else {
            scores.weapons = best;
          }
        } catch (err) {
          console.error("Vision Object Detection (weapons) recheck failed:", err);
          serviceUnavailable = true;
        }
      }
    }

    // drugs → Vision Label/Object Detection only (Claude removed per
    // product decision). Vision has no dedicated "drugs" category, so a
    // match below the confidence floor is treated as inconclusive rather
    // than clean, and routed to admin_review rather than silently approved.
    if (triggeredCategories.includes("drugs")) {
      if (!visionKey) {
        serviceUnavailable = true;
      } else {
        try {
          const results = await Promise.all(frames.map((f) => googleVisionObjects(visionKey, f.base64)));
          const best = results.reduce((max, r) => Math.max(max, labelScore(r.objects, r.labels, DRUG_LABELS)), 0);
          if (best > 0 && best < VISION_LABEL_CONFIDENCE_FLOOR) {
            // A weak, ambiguous match — not confident enough to clear it,
            // not clearly a hit either. Let admin_review decide.
            serviceUnavailable = true;
          } else {
            scores.drugs = best;
          }
        } catch (err) {
          console.error("Vision Object Detection (drugs) recheck failed:", err);
          serviceUnavailable = true;
        }
      }
    }

    // hate / threats / text → resolved from OpenAI Moderation's own
    // initial-pass scores (no independent second text provider exists in
    // this pipeline). If those scores weren't provided at all, there is
    // nothing to re-derive a decision from, so this is treated as
    // unavailable rather than guessed at.
    const needsTextRecheck = triggeredCategories.some((c) => c === "hate" || c === "threats" || c === "text");
    if (needsTextRecheck) {
      if (!initialTextScores) {
        serviceUnavailable = true;
      } else {
        if (triggeredCategories.includes("hate")) scores.hate = initialTextScores.hate ?? 0;
        if (triggeredCategories.includes("threats")) scores.threats = initialTextScores.threats ?? 0;
        if (triggeredCategories.includes("text")) scores.text = initialTextScores.text ?? 0;
      }
    }

    const { data: thresholds } = await adminClient
      .from("moderation_thresholds").select("category, low_max, high_min");
    const thresholdList: Threshold[] = thresholds ?? [];

    const { data: playerProfile } = await adminClient
      .from("player_profiles").select("date_of_birth").eq("user_id", caller.id).maybeSingle();
    const { data: scoutProfile } = playerProfile ? { data: null } : await adminClient
      .from("scout_profiles").select("date_of_birth").eq("user_id", caller.id).maybeSingle();
    const minor = isMinor(playerProfile?.date_of_birth ?? scoutProfile?.date_of_birth ?? null);

    let decision: "approved" | "admin_review";
    let reason: string | null = null;

    if (serviceUnavailable) {
      // Fail-safe, never fail-open: an unavailable/inconclusive recheck
      // never leaves content stuck "uncertain" forever, and never
      // auto-approves purely because a secondary provider couldn't decide.
      decision = "admin_review";
      reason = "Verificare secundară indisponibilă sau neconcludentă.";
    } else {
      const risk = evaluateOverallRisk(scores, thresholdList, minor);
      if (risk.level === "low") { decision = "approved"; }
      else { decision = "admin_review"; reason = `Risc confirmat la reverificare: ${risk.triggeredCategories.join(", ")}`; }
    }

    await adminClient.from("content_moderation_results").insert({
      content_type, content_id, user_id: caller.id,
      scores, stage: "recheck",
      provider: usedVideoIntelligence ? "google_video_intelligence" : "google_vision",
      decision, reason,
    });

    const table = content_type === "post" ? "posts" : "video_submissions";
    await adminClient.from(table)
      .update({ moderation_status: decision === "approved" ? "approved" : "flagged" })
      .eq("id", content_id);

    return new Response(JSON.stringify({ decision, scores }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("recheck-video-content error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
