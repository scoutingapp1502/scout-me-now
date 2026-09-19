import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  evaluateOverallRisk, maxAcrossFrames, isMinor,
  type CategoryScores, type Threshold,
} from "../_shared/moderationRiskEngine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// First pass of the video moderation pipeline (prompt §3-5). Runs on
// sampled frames + caption text, using OpenAI's Moderation API — free, no
// separate billing key beyond the API key itself.
//
// Known coverage gap (documented, not a bug): OpenAI's omni-moderation model
// is strong on sexual/violence/hate/self-harm/harassment, but has no
// dedicated category for weapons-as-object, drugs-as-object, or non-violent
// "dangerous content" (e.g. risky stunts). Those gaps are why weapons/drugs
// route to Google Vision Object/Label Detection at the recheck stage
// (recheck-video-content) rather than being scored here at all — this
// function reports them as 0 (unknown-but-not-flagged-yet), and the uncertain
// band for those categories is intentionally wide so real cases still surface.
//
// ---------------------------------------------------------------------------
// MODERATION_TEST_MODE (dev/testing only)
// ---------------------------------------------------------------------------
// OpenAI billing isn't enabled yet, so OpenAI Moderation currently returns
// 429 for this project. Setting the Supabase secret MODERATION_TEST_MODE to
// the exact string "true" skips the OpenAI calls entirely for content_type
// "test_video" and substitutes a server-decided mock score set instead, so
// the rest of the pipeline (risk engine, Google Vision, Google Video
// Intelligence OAuth + polling, recheck-video-content, admin_review) can
// still be exercised end-to-end for free. Any other value, or the secret
// being unset, is production behavior — real OpenAI calls, no mocking.
//
// This is intentionally narrow: it never accepts scores from the client,
// never activates for content_type "post" (real user posts are never
// mocked), and always logs which mode produced a given result via the
// content_moderation_results.provider column ("test_mock" vs
// "openai_moderation"), so a mock result can never be mistaken for a real
// one in the admin queue or in any later audit.
const isTestModeEnabled = () => Deno.env.get("MODERATION_TEST_MODE") === "true";

type TestScenario = "SAFE" | "UNCERTAIN_VIOLENCE" | "UNCERTAIN_SEXUAL" | "HIGH";

interface AnalyzeRequest {
  frames: { base64: string; atFraction: number }[];
  caption?: string;
  content_type: "post" | "test_video";
  content_id: string;
  // Only ever honored when MODERATION_TEST_MODE=true AND content_type is
  // "test_video" — see handling below. Ignored for real posts, and ignored
  // outright in production.
  test_scenario?: TestScenario;
}

async function moderateWithOpenAI(apiKey: string, input: { type: "image_url" | "text"; value: string }[]) {
  const res = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "omni-moderation-latest",
      input: input.map((i) =>
        i.type === "image_url"
          ? { type: "image_url", image_url: { url: i.value } }
          : { type: "text", text: i.value }
      ),
    }),
  });
  if (!res.ok) throw new Error(`OpenAI Moderation failed: ${res.status} ${await res.text()}`);
  return res.json();
}

// Maps OpenAI's category_scores onto our category set. sexual/minors folds
// into "sexual" (already the most severe reading); self-harm has no
// dedicated column in our schema yet, so it folds into "violence" as the
// closest safety-relevant bucket rather than being silently dropped.
function mapOpenAiScores(categoryScores: Record<string, number>): CategoryScores {
  return {
    sexual: Math.max(categoryScores["sexual"] ?? 0, categoryScores["sexual/minors"] ?? 0),
    violence: Math.max(
      categoryScores["violence"] ?? 0,
      categoryScores["violence/graphic"] ?? 0,
      categoryScores["self-harm"] ?? 0,
      categoryScores["self-harm/intent"] ?? 0,
      categoryScores["self-harm/instructions"] ?? 0
    ),
    hate: Math.max(categoryScores["hate"] ?? 0, categoryScores["hate/threatening"] ?? 0),
    threats: Math.max(categoryScores["harassment"] ?? 0, categoryScores["harassment/threatening"] ?? 0),
  };
}

async function ocrFrame(apiKey: string, base64: string): Promise<string> {
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{ image: { content: base64 }, features: [{ type: "TEXT_DETECTION", maxResults: 1 }] }],
    }),
  });
  if (!res.ok) { console.error("Vision OCR failed:", res.status, await res.text()); return ""; }
  const data = await res.json();
  return data?.responses?.[0]?.fullTextAnnotation?.text ?? "";
}

const LIKELIHOOD_SCORE: Record<string, number> = {
  UNKNOWN: 0, VERY_UNLIKELY: 0.05, UNLIKELY: 0.2, POSSIBLE: 0.5, LIKELY: 0.8, VERY_LIKELY: 0.95,
};
const WEAPON_LABELS = ["weapon", "firearm", "gun", "knife", "rifle", "pistol", "sword", "ammunition"];
const DRUG_LABELS = ["drug", "syringe", "cannabis", "marijuana", "pill", "cocaine", "needle"];

function labelScore(objects: any[], labels: any[], keywords: string[]): number {
  const all = [...objects.map((o) => ({ name: o.name, score: o.score })), ...labels.map((l) => ({ name: l.description, score: l.score }))];
  let best = 0;
  for (const item of all) {
    const name = (item.name ?? "").toLowerCase();
    if (keywords.some((k) => name.includes(k))) best = Math.max(best, item.score ?? 0);
  }
  return best;
}

// Fallback first pass, used ONLY when OpenAI Moderation itself is
// unavailable (billing not enabled, rate limited, network error) — never
// runs alongside a successful OpenAI call. Google Vision has no OpenAI
// equivalent for hate/threats text classification, so this covers
// sexual/violence (SafeSearch) and weapons/drugs (Object/Label Detection)
// per frame; hate/threats/text stay at 0 here (nothing to derive them from
// without OpenAI or a caption keyword list), which is a known, accepted gap
// of this fallback — not silently pretending they were checked.
async function moderateFrameWithVision(apiKey: string, base64: string): Promise<CategoryScores> {
  const res = await fetch(`https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: [{
        image: { content: base64 },
        features: [
          { type: "SAFE_SEARCH_DETECTION" },
          { type: "OBJECT_LOCALIZATION", maxResults: 10 },
          { type: "LABEL_DETECTION", maxResults: 10 },
        ],
      }],
    }),
  });
  if (!res.ok) throw new Error(`Vision fallback failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const r = data?.responses?.[0] ?? {};
  const safeSearch = r.safeSearchAnnotation ?? {};
  const objects = r.localizedObjectAnnotations ?? [];
  const labels = r.labelAnnotations ?? [];
  return {
    sexual: LIKELIHOOD_SCORE[safeSearch.adult] ?? 0,
    violence: Math.max(LIKELIHOOD_SCORE[safeSearch.violence] ?? 0, LIKELIHOOD_SCORE[safeSearch.racy] ?? 0),
    weapons: labelScore(objects, labels, WEAPON_LABELS),
    drugs: labelScore(objects, labels, DRUG_LABELS),
  };
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    await new Promise((r) => setTimeout(r, 2000));
    return fn();
  }
}

// Spacing between sequential OpenAI calls (6 frames + 1 text call per
// upload) so they don't trip the free tier's per-minute rate limit on their
// own. Revisit/lower once billing is enabled on the OpenAI account.
const OPENAI_CALL_SPACING_MS = 2500;

// Builds a CategoryScores set for a test scenario using the thresholds
// already loaded from moderation_thresholds, instead of hardcoding
// fragile numeric assumptions. Decided entirely server-side; the client
// only ever names which scenario it wants (and only for test_video).
//
// UNCERTAIN_VIOLENCE and UNCERTAIN_SEXUAL each raise exactly one category
// into its uncertain band and keep every other category comfortably low, so
// recheck-video-content is driven to exercise exactly one real provider:
// "violence" → Google Vision SafeSearch (frame-based), "sexual" → Google
// Cloud Video Intelligence Explicit Content Detection (whole-video, via the
// Service Account OAuth path) — never both, and never mocked at the
// recheck stage.
function buildMockScores(scenario: TestScenario, thresholds: Threshold[]): CategoryScores {
  const scores: CategoryScores = {};
  const baseline = (t: Threshold) => Math.max(0, t.low_max * 0.2);

  if (scenario === "SAFE") {
    // Comfortably under every category's low_max.
    for (const t of thresholds) scores[t.category as keyof CategoryScores] = baseline(t);
    return scores;
  }

  if (scenario === "UNCERTAIN_VIOLENCE" || scenario === "UNCERTAIN_SEXUAL") {
    const targetCategory = scenario === "UNCERTAIN_VIOLENCE" ? "violence" : "sexual";
    const target = thresholds.find((t) => t.category === targetCategory);
    for (const t of thresholds) {
      scores[t.category as keyof CategoryScores] = t.category === targetCategory
        ? Math.min(target ? (target.low_max + target.high_min) / 2 : 0.4, 0.94)
        : baseline(t);
    }
    return scores;
  }

  // HIGH: comfortably over high_min for "violence" — must resolve straight
  // to admin_review with no recheck spent on it.
  const violence = thresholds.find((t) => t.category === "violence");
  for (const t of thresholds) {
    scores[t.category as keyof CategoryScores] = t.category === "violence"
      ? Math.min((violence?.high_min ?? 0.75) + 0.1, 0.99)
      : baseline(t);
  }
  return scores;
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

    const body: AnalyzeRequest = await req.json();
    // frames may legitimately be empty — a text-only post has nothing to
    // sample, and goes through the same pipeline for its caption alone.
    const { frames = [], caption, content_type, content_id, test_scenario } = body;
    if (!content_type || !content_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: thresholds } = await adminClient
      .from("moderation_thresholds")
      .select("category, low_max, high_min");
    const thresholdList: Threshold[] = thresholds ?? [];

    const { data: playerProfile } = await adminClient
      .from("player_profiles").select("date_of_birth").eq("user_id", caller.id).maybeSingle();
    const { data: scoutProfile } = playerProfile ? { data: null } : await adminClient
      .from("scout_profiles").select("date_of_birth").eq("user_id", caller.id).maybeSingle();
    const dob = playerProfile?.date_of_birth ?? scoutProfile?.date_of_birth ?? null;
    const minor = isMinor(dob);

    // test_scenario is only ever honored under both conditions at once —
    // test mode enabled AND this is a test_video, never a real post. A
    // scenario named for a "post" is silently ignored and falls through to
    // the real OpenAI path below.
    const useTestMock = isTestModeEnabled() && content_type === "test_video" && !!test_scenario;

    let scores: CategoryScores = {};
    let textScoresForRecheck: { hate: number; threats: number; text: number } = { hate: 0, threats: 0, text: 0 };
    let serviceUnavailable = false;
    let provider = "unavailable";

    if (useTestMock) {
      scores = buildMockScores(test_scenario!, thresholdList);
      textScoresForRecheck = { hate: scores.hate ?? 0, threats: scores.threats ?? 0, text: scores.text ?? 0 };
      provider = "test_mock";
    } else {
      const openaiKey = Deno.env.get("OPENAI_API_KEY");
      const visionKey = Deno.env.get("GOOGLE_CLOUD_VISION_API_KEY");

      let perFrameScores: CategoryScores[] = [];
      let ocrText = "";
      let openAiUnavailable = false;

      // A text-only post has no frames at all — nothing to run image
      // moderation against, so this whole leg is skipped rather than
      // wastefully failing on an out-of-bounds frame.
      if (frames.length === 0) {
        // Not a failure — just nothing to check here.
      } else if (!openaiKey) {
        console.error("OPENAI_API_KEY not configured — falling back to Google Vision for the initial pass.");
        openAiUnavailable = true;
      } else {
        try {
          // OpenAI's Moderation API accepts exactly one image per request,
          // and this project's OpenAI account has no billing enabled — its
          // free-tier rate limit is low enough that even one request per
          // frame, spaced out, still triggers 429 (confirmed in production
          // logs). So only ONE frame — the middle one, most representative
          // of the clip — is sent to OpenAI; the other frames are still
          // available to the Google Vision fallback/recheck stage if
          // needed, they're just not spent on OpenAI. Revisit sending all
          // frames once billing is enabled and the real rate limit is much
          // higher. A single-image post (exactly one frame) always uses
          // that one frame.
          const middleFrame = frames[Math.floor(frames.length / 2)];
          const result: any = await withRetry(() =>
            moderateWithOpenAI(openaiKey, [{ type: "image_url" as const, value: `data:image/jpeg;base64,${middleFrame.base64}` }])
          );
          perFrameScores = [mapOpenAiScores(result.results?.[0]?.category_scores ?? {})];
        } catch (err) {
          console.error("OpenAI Moderation (frames) failed after retry, falling back to Google Vision:", err);
          openAiUnavailable = true;
        }
      }

      // OCR runs once per frame on the already-extracted frames (no new
      // frames), regardless of the image-moderation outcome — dangerous
      // text can ride on an otherwise-innocuous frame.
      if (visionKey) {
        const ocrResults = await Promise.all(
          frames.map((f) => ocrFrame(visionKey, f.base64).catch(() => ""))
        );
        ocrText = ocrResults.filter(Boolean).join("\n");
      } else {
        console.error("GOOGLE_CLOUD_VISION_API_KEY not configured — OCR skipped for this upload.");
      }

      let textScores: CategoryScores = {};
      if (openAiUnavailable) {
        // Fallback path: OpenAI is down/unconfigured. Run Google Vision
        // SafeSearch + Object/Label Detection on the frames directly instead
        // of giving up — this is a real automated first pass, not a mock,
        // and only ever engages when OpenAI genuinely could not be reached.
        // Only fail the whole pass (→ admin_review) if Vision ALSO isn't
        // configured or fails — two independent providers both down is the
        // only case treated as "no automated check ran at all".
        if (!visionKey) {
          console.error("Vision fallback unavailable (no GOOGLE_CLOUD_VISION_API_KEY) — no automated check could run.");
          serviceUnavailable = true;
        } else {
          try {
            perFrameScores = await Promise.all(frames.map((f) => moderateFrameWithVision(visionKey, f.base64)));
            provider = "google_vision_fallback";
          } catch (err) {
            console.error("Vision fallback failed:", err);
            serviceUnavailable = true;
          }
        }
        // hate/threats/text have no signal in this fallback (Vision doesn't
        // classify text sentiment) — left at 0 rather than guessed at. This
        // is a known, accepted gap of running without OpenAI: text-based
        // abuse (harassment, hate speech in a caption) is not caught until
        // OpenAI is available again or a user reports it.
      } else {
        provider = "openai_moderation";
        const combinedText = [caption, ocrText].filter(Boolean).join("\n").trim();
        if (combinedText && openaiKey) {
          try {
            // Spaced out from the last frame call above for the same
            // rate-limit reason.
            await new Promise((r) => setTimeout(r, OPENAI_CALL_SPACING_MS));
            const textResult = await withRetry(() => moderateWithOpenAI(openaiKey, [{ type: "text", value: combinedText }]));
            const mapped = mapOpenAiScores(textResult.results?.[0]?.category_scores ?? {});
            textScores = { text: Math.max(mapped.sexual ?? 0, mapped.violence ?? 0, mapped.hate ?? 0, mapped.threats ?? 0), hate: mapped.hate, threats: mapped.threats };
          } catch (err) {
            // OpenAI succeeded on frames but failed on text — there is no
            // independent second text provider in this pipeline (Vision
            // fallback above only covers images), so this must still route
            // to admin_review, never approved on frame-only confidence.
            console.error("OpenAI Moderation (text) failed after retry:", err);
            serviceUnavailable = true;
          }
        }
      }

      scores = { ...maxAcrossFrames(perFrameScores), ...textScores };
      // weapons/drugs get a mid-band placeholder only when OpenAI actually
      // ran on an actual frame (it never scores them at all — see file
      // header); the Vision fallback above already computes real
      // weapons/drugs scores per frame, so it must not be overwritten here.
      // A text-only post (no frames at all) has nothing depicting a weapon
      // or drug to begin with, so both stay unset/low rather than flagged
      // as "uncertain" purely for lacking an image.
      if (provider === "openai_moderation" && frames.length > 0) {
        const weaponsThreshold = thresholdList.find((t) => t.category === "weapons");
        const drugsThreshold = thresholdList.find((t) => t.category === "drugs");
        if (weaponsThreshold) scores.weapons = weaponsThreshold.low_max + 0.01;
        if (drugsThreshold) scores.drugs = drugsThreshold.low_max + 0.01;
      }

      textScoresForRecheck = { hate: textScores.hate ?? 0, threats: textScores.threats ?? 0, text: textScores.text ?? 0 };
    }

    let decision: "approved" | "recheck" | "admin_review";
    let reason: string | null = null;
    let triggeredCategories: string[] = [];

    if (serviceUnavailable) {
      decision = "admin_review";
      reason = provider === "unavailable"
        ? "Prima verificare automată indisponibilă (OpenAI Moderation și Google Vision)."
        : "Verificare text indisponibilă (OpenAI Moderation).";
    } else {
      const risk = evaluateOverallRisk(scores, thresholdList, minor);
      triggeredCategories = risk.triggeredCategories;
      if (risk.level === "high") { decision = "admin_review"; reason = `Risc ridicat: ${risk.highCategories.join(", ")}`; }
      else if (risk.level === "uncertain") { decision = "recheck"; reason = `Categorii incerte: ${risk.triggeredCategories.join(", ")}`; }
      else { decision = "approved"; }
    }
    if (useTestMock) {
      reason = reason ? `[TEST MODE: ${test_scenario}] ${reason}` : `[TEST MODE: ${test_scenario}]`;
    }

    await adminClient.from("content_moderation_results").insert({
      content_type, content_id, user_id: caller.id,
      scores, stage: "initial", provider, decision, reason,
    });

    // 'pending' means "still being processed by the pipeline"; once a
    // decision of admin_review has actually been reached, the row must move
    // to 'flagged' — otherwise it's indistinguishable from a post whose
    // moderation hasn't run yet at all, and both the author-facing badge and
    // the admin queue lose the ability to tell "waiting" from "needs a human".
    const table = content_type === "post" ? "posts" : "video_submissions";
    const newStatus = decision === "approved" ? "approved" : decision === "admin_review" ? "flagged" : "pending";
    await adminClient.from(table).update({ moderation_status: newStatus }).eq("id", content_id);

    // initialTextScores lets recheck-video-content resolve a triggered
    // hate/threats/text category from this pass's own OpenAI (or test-mode
    // mock) results — there is no independent second text provider in this
    // pipeline.
    return new Response(JSON.stringify({
      decision, scores, triggeredCategories,
      initialTextScores: textScoresForRecheck,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("analyze-video-frames error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
