import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  evaluateOverallRisk, maxAcrossFrames, mergeMaxScores, isMinor,
  type CategoryScores, type Threshold,
} from "../_shared/moderationRiskEngine.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// First pass of the video moderation pipeline (prompt §3-5). Runs on
// sampled frames + caption text, using ONLY Google (Vision for images,
// Natural Language for text) — no OpenAI anywhere in this file. OpenAI
// Moderation was the original design, but this project's OpenAI account has
// no billing enabled: every single call (image AND text) failed with 429 in
// production, unconditionally. Keeping OpenAI as a "first attempt that
// always fails" added latency, complexity, and — critically — a real bug:
// the text-fallback path only activated when the earlier OpenAI *frame*
// call failed a specific way, so a post with both an image and abusive text
// could have its image correctly routed to the Vision fallback while its
// text was silently never checked at all (documented gap that let a slur
// through in production). Google-only, unconditionally, removes that gap
// entirely — there is now exactly one code path for images and one for
// text, always taken, never conditional on another provider's failure mode.
//
// Known coverage gap (documented, not a bug): Vision has no dedicated
// category for weapons-as-object or drugs-as-object either — those still
// route to Google Vision Object/Label Detection at the recheck stage
// (recheck-video-content), same as before.
//
// ---------------------------------------------------------------------------
// MODERATION_TEST_MODE (dev/testing only)
// ---------------------------------------------------------------------------
// Setting the Supabase secret MODERATION_TEST_MODE to the exact string
// "true" skips the real Google calls entirely for content_type "test_video"
// and substitutes a server-decided mock score set instead, so the rest of
// the pipeline (risk engine, Google Video Intelligence OAuth + polling,
// recheck-video-content, admin_review) can still be exercised end-to-end
// without spending real API quota. Any other value, or the secret being
// unset, is production behavior — real Google calls, no mocking.
//
// This is intentionally narrow: it never accepts scores from the client,
// never activates for content_type "post" (real user posts are never
// mocked), and always logs which mode produced a given result via the
// content_moderation_results.provider column ("test_mock" vs
// "google_vision"/"google_natural_language"), so a mock result can never be
// mistaken for a real one in the admin queue or in any later audit.
const isTestModeEnabled = () => Deno.env.get("MODERATION_TEST_MODE") === "true";

type TestScenario = "SAFE" | "UNCERTAIN_VIOLENCE" | "UNCERTAIN_SEXUAL" | "HIGH";

interface AnalyzeRequest {
  frames: { base64: string; atFraction: number }[];
  caption?: string;
  content_type: "post" | "scout_post" | "test_video" | "avatar" | "video_highlight";
  content_id: string;
  // Only ever honored when MODERATION_TEST_MODE=true AND content_type is
  // "test_video" — see handling below. Ignored for real posts, and ignored
  // outright in production.
  test_scenario?: TestScenario;
  // Required (and only meaningful) when content_type is "avatar" — which of
  // the two profile tables to write the decision to. Avatars have no
  // dedicated content_id row of their own (unlike posts/video_submissions),
  // so content_id here is the user_id whose pending_photo_url is being
  // reviewed, and avatar_table says where to find it.
  avatar_table?: "player_profiles" | "scout_profiles";
}

// Normalizes common evasion tricks BEFORE any text is sent to Google — a
// purely local, deterministic string transform, no API call. Without this,
// leetspeak/character-substitution ("$ugi pwla",
// "v4 tai") sails past every classifier because the substituted string
// simply isn't a word in any language model's vocabulary; normalizing first
// turns it back into the real word so the actual moderation providers get a
// fair shot at it. Deliberately conservative: only maps unambiguous
// look-alike substitutions, and only used for moderation scoring — never
// mutates what's actually stored/shown as the post's caption.
function normalizeForModeration(text: string): string {
  let out = text.toLowerCase();
  // Only unambiguous digit/symbol → letter look-alikes, and only when
  // adjacent to actual letters (so a real number like a score "5-0" or a
  // year is left alone). Deliberately does NOT map plain-letter look-alikes
  // such as w→v or ph→f — those misfire constantly on ordinary Romanian/
  // English words (e.g. "phenomenal", "wow", any word containing "w" or
  // "ph") and would corrupt normal captions rather than catch evasion.
  const substitutions: [RegExp, string][] = [
    [/\$/g, "s"], [/@/g, "a"],
    [/(?<=[a-z])0(?=[a-z])|^0(?=[a-z])|(?<=[a-z])0$/g, "o"],
    [/(?<=[a-z])[1!|]|[1!|](?=[a-z])/g, "i"],
    [/(?<=[a-z])3(?=[a-z])|^3(?=[a-z])|(?<=[a-z])3$/g, "e"],
    [/(?<=[a-z])7(?=[a-z])/g, "t"],
    [/(?<=[a-z])\+(?=[a-z])/g, "t"],
    [/(?<=[a-z])8(?=[a-z])/g, "b"],
    [/(?<=[a-z])9(?=[a-z])/g, "g"],
  ];
  for (const [pattern, replacement] of substitutions) out = out.replace(pattern, replacement);
  // Collapse letter-by-letter spacing/punctuation used to break up a word
  // for a keyword filter ("p u l a", "p.u.l.a", "p-u-l-a") — only between
  // single letters, so normal spaced-out words/sentences are untouched.
  out = out.replace(/\b([a-z])[\s.\-_]+(?=[a-z]\b)/g, "$1");
  // Collapse repeated characters used to dodge exact-match filters
  // ("vaaaa taaaai" → "vaa taai"), but keep up to 2 in a row so genuine
  // doubled letters in real words survive.
  out = out.replace(/(.)\1{2,}/g, "$1$1");
  return out;
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

// The (only) image moderation pass — Google Vision SafeSearch for
// sexual/violence, Object/Label Detection for weapons/drugs. Vision has no
// text-sentiment capability, so hate/threats/text always come from the
// separate text pass below (moderateTextWithNaturalLanguage), never from
// here — this function never claims a reading on those three categories.
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
  if (!res.ok) throw new Error(`Vision image moderation failed: ${res.status} ${await res.text()}`);
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

// The (only) text moderation pass — Google Cloud Natural Language API's
// moderateText endpoint (Perspective API, used here previously, is being
// wound down and became unreliable). Runs unconditionally on every post's
// caption + any OCR'd text, regardless of what happened with the image
// pass — this used to only run as a fallback after an OpenAI text call
// failed, which meant a post's text was skipped entirely whenever its
// separate image call had already failed a different way (see this file's
// header comment). Lives on the same Google Cloud project as Vision —
// reuses GOOGLE_CLOUD_VISION_API_KEY, no separate key/service to provision.
// IMPORTANT: its supported-language list does NOT include Romanian
// (confirmed live) — text is machine-translated to English first
// (translateToEnglish) specifically to work around this.
// https://cloud.google.com/natural-language/docs/moderating-text
//
// Category mapping onto our schema: "Toxic"/"Insult"/"Profanity" fold into
// the overall text score; "Death, Harm & Tragedy"/"Violent" → violence;
// "Firearms & Weapons" → weapons; "Drugs" → drugs; "Sexual" → sexual;
// "Toxic" (as the closest identity/hate-adjacent category Natural Language
// exposes) also feeds hate; there is no dedicated "threats" category, so it
// takes the same reading as hate (both are conservative proxies here, not a
// perfect match — documented gap, not silently invented precision).
//
// IMPORTANT: moderateText's supported-language list does NOT include
// Romanian, which is why `text` is expected to already be pre-translated to
// English by the caller (see translateToEnglish below) before reaching this
// function — untranslated Romanian text returns HTTP 200 with
// `languageSupported: false` and near-zero scores even on an unambiguous
// threat. `languageSupported` is still returned here for visibility/logging,
// but the caller uses the category scores regardless of its value (product
// decision — see the call site's comment for the tradeoff this accepts).
async function moderateTextWithNaturalLanguage(apiKey: string, text: string): Promise<{ text: number; hate: number; threats: number; violence: number; weapons: number; drugs: number; sexual: number; languageSupported: boolean }> {
  const res = await fetch(`https://language.googleapis.com/v2/documents:moderateText?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      document: { type: "PLAIN_TEXT", content: text },
    }),
  });
  if (!res.ok) throw new Error(`Natural Language moderateText failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const categories: { name: string; confidence: number }[] = data?.moderationCategories ?? [];
  const score = (name: string) => categories.find((c) => c.name === name)?.confidence ?? 0;

  const toxic = Math.max(score("Toxic"), score("Insult"), score("Profanity"));
  const violence = Math.max(score("Violent"), score("Death, Harm & Tragedy"));
  const weapons = score("Firearms & Weapons");
  const drugs = score("Drugs");
  const sexual = score("Sexual");
  const hate = toxic;
  const threats = toxic;
  const text_ = Math.max(toxic, violence, weapons, drugs, sexual);
  return { text: text_, hate, threats, violence, weapons, drugs, sexual, languageSupported: data?.languageSupported !== false };
}

// Translates arbitrary-language text to English via MyMemory Translation API
// before it reaches Google's moderateText, since that endpoint's model only
// actually understands a fixed set of languages (English, Chinese, French,
// German, Italian, Japanese, Korean, Portuguese, Spanish) and Romanian is
// not among them — confirmed live: it returns confidently-shaped but
// meaningless near-zero scores instead of an error for unsupported
// languages, which is worse than failing loudly.
//
// Deliberately MyMemory, not Google Cloud Translation or Azure Translator:
// no account, no API key, no signup at all — a plain HTTP GET — so there's
// nothing to be rate-limited or fraud-blocked on signup (Azure account
// creation was blocked here for "unusual activity"). Per MyMemory's own
// published limits (mymemory.translated.net/doc/usagelimits.php): anonymous
// usage is 5,000 CHARACTERS/day; attaching a contact email via the `de`
// parameter raises that to 50,000 characters/day, still with no account or
// API key created anywhere — the email is just a contact-in-case-of-abuse
// field MyMemory asks for, not a signup. MODERATION_CONTACT_EMAIL is that
// address (this project's own account email, not a personal one). This is
// the one deliberately low-effort spot in an otherwise carefully
// provisioned pipeline — if MyMemory's daily quota is ever exhausted, the
// caller below treats a failed/empty translation exactly like any other
// provider failure (→ admin_review), never silently approved on an
// untranslated reading.
async function translateToEnglish(text: string): Promise<string> {
  const contactEmail = Deno.env.get("MODERATION_CONTACT_EMAIL");
  const emailParam = contactEmail ? `&de=${encodeURIComponent(contactEmail)}` : "";
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ro|en${emailParam}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`MyMemory Translation failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  // MyMemory reports quota/errors inside a 200 response via responseStatus
  // and quotaFinished, not always via HTTP status — must be checked
  // explicitly or a quota rejection silently passes through as an "empty"
  // translation.
  if (data?.quotaFinished === true) {
    throw new Error("MyMemory Translation daily quota exhausted");
  }
  if (data?.responseStatus && data.responseStatus !== 200) {
    throw new Error(`MyMemory Translation error: ${data.responseStatus} ${data?.responseDetails ?? ""}`);
  }
  const translated = data?.responseData?.translatedText;
  if (typeof translated !== "string" || !translated.trim()) throw new Error("MyMemory Translation returned no text");
  return translated;
}

async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    await new Promise((r) => setTimeout(r, 2000));
    return fn();
  }
}

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
    const { frames = [], caption, content_type, content_id, test_scenario, avatar_table } = body;
    if (!content_type || !content_id) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (content_type === "avatar") {
      if (avatar_table !== "player_profiles" && avatar_table !== "scout_profiles") {
        return new Response(JSON.stringify({ error: "Missing/invalid avatar_table" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Unlike a post/video_submission row (whose ownership RLS already
      // gates), an avatar's content_id IS the profile's user_id directly —
      // must be pinned to the caller's own id, or any authenticated user
      // could pass someone else's user_id and trigger moderation (and, on
      // approval, promote a pending_photo_url) on an account that isn't
      // theirs.
      if (content_id !== caller.id) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
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
    // the real Google path below.
    const useTestMock = isTestModeEnabled() && content_type === "test_video" && !!test_scenario;

    let scores: CategoryScores = {};
    let textScoresForRecheck: { hate: number; threats: number; text: number } = { hate: 0, threats: 0, text: 0 };
    let serviceUnavailable = false;
    let provider = "unavailable";
    // Tracked outside the block below so the final admin_review reason can
    // say specifically which half of the check (image, text, or both)
    // actually failed, instead of a single generic message.
    let imageCheckFailedOuter = false;
    let textCheckFailedOuter = false;

    if (useTestMock) {
      scores = buildMockScores(test_scenario!, thresholdList);
      textScoresForRecheck = { hate: scores.hate ?? 0, threats: scores.threats ?? 0, text: scores.text ?? 0 };
      provider = "test_mock";
    } else {
      const visionKey = Deno.env.get("GOOGLE_CLOUD_VISION_API_KEY");

      let perFrameScores: CategoryScores[] = [];
      let ocrText = "";
      let imageCheckFailed = false;

      // Image pass — Vision SafeSearch + Object/Label Detection on every
      // extracted frame. Skipped only when there are no frames at all (a
      // text-only post has nothing to check here — not a failure).
      if (frames.length > 0) {
        if (!visionKey) {
          console.error("GOOGLE_CLOUD_VISION_API_KEY not configured — no automated image check could run.");
          imageCheckFailed = true;
        } else {
          try {
            perFrameScores = await Promise.all(frames.map((f) => moderateFrameWithVision(visionKey, f.base64)));
          } catch (err) {
            console.error("Vision image moderation failed:", err);
            imageCheckFailed = true;
          }
        }
      }

      // OCR runs once per frame regardless of the image-moderation outcome
      // above — dangerous text can ride on an otherwise-innocuous frame,
      // and OCR'd text feeds into the text pass below either way.
      if (visionKey && frames.length > 0) {
        const ocrResults = await Promise.all(
          frames.map((f) => ocrFrame(visionKey, f.base64).catch(() => ""))
        );
        ocrText = ocrResults.filter(Boolean).join("\n");
      }

      // Text pass — runs UNCONDITIONALLY whenever there's a caption or
      // OCR'd text, regardless of what happened with the image pass above.
      // This is the fix for the real bug the old OpenAI-first design had:
      // text used to only be checked as a "fallback" after a separate,
      // independent image-call failure, so a post with an image AND
      // abusive text could have its image correctly routed to Vision while
      // its text was silently never checked at all.
      let textScores: CategoryScores = {};
      let textCategoryScores: CategoryScores = {};
      let textCheckFailed = false;
      const rawCombinedText = [caption, ocrText].filter(Boolean).join("\n").trim();
      // Normalized before reaching Natural Language — without this,
      // leetspeak/character-substitution evasion ("$ugi pwla") sails
      // through because the substituted string isn't a real word in any
      // language model's vocabulary. Never changes what's stored/displayed,
      // only what's scored.
      const combinedText = normalizeForModeration(rawCombinedText);
      if (combinedText) {
        const naturalLanguageKey = Deno.env.get("GOOGLE_CLOUD_VISION_API_KEY");
        if (naturalLanguageKey) {
          try {
            // Natural Language's moderateText does NOT understand Romanian
            // (confirmed live: it answers HTTP 200 with
            // languageSupported: false rather than erroring — which very
            // nearly let a real threat, "vă tai pe toți", through as
            // "approved" before the MyMemory translation step below was
            // added). So the caption is machine-translated to English first
            // via MyMemory (free, no account/key — see translateToEnglish).
            //
            // languageSupported can still come back false even AFTER
            // translation — confirmed happening on plain nonsense text like
            // "asdlasd;ald" (MyMemory has nothing real to translate, so its
            // output isn't reliably recognizable as English either). Explicit
            // product decision: Google's returned category scores are used
            // as-is regardless of that flag, rather than treating it as a
            // provider failure (which routed every such case to admin_review
            // for no real reason — nonsense text has nothing dangerous in it
            // for the classifier to score highly in the first place). This
            // does mean a genuine abusive message that happens to translate
            // into something Google doesn't recognize as valid English would
            // also be scored (and possibly approved) rather than escalated —
            // an accepted tradeoff, not an oversight.
            const englishText = await withRetry(() => translateToEnglish(combinedText));
            const nl = await withRetry(() => moderateTextWithNaturalLanguage(naturalLanguageKey, englishText));
            textScores = { text: nl.text, hate: nl.hate, threats: nl.threats };
            // Natural Language's category set also reads violence/weapons/
            // drugs/sexual signal directly out of the text, so fold those in
            // too rather than leaving them at 0 purely because there was no
            // image (or the image check failed).
            textCategoryScores = { violence: nl.violence, weapons: nl.weapons, drugs: nl.drugs, sexual: nl.sexual };
          } catch (err) {
            console.error("Google Natural Language (translation + moderateText) failed:", err);
            textCheckFailed = true;
          }
        } else {
          console.error("GOOGLE_CLOUD_VISION_API_KEY not configured — no text check could run.");
          textCheckFailed = true;
        }
      }

      // Fail-safe, never fail-open: if EITHER the image pass (when there
      // were frames to check) or the text pass (when there was text to
      // check) genuinely couldn't run/complete, this whole thing is
      // "unavailable" and goes to admin_review — never silently approved on
      // half a check.
      if (imageCheckFailed || textCheckFailed) {
        serviceUnavailable = true;
        imageCheckFailedOuter = imageCheckFailed;
        textCheckFailedOuter = textCheckFailed;
      }
      provider = frames.length > 0 && combinedText
        ? "google_vision_and_natural_language"
        : frames.length > 0
        ? "google_vision"
        : "google_natural_language";

      // mergeMaxScores, not spread: textCategoryScores and the image scores
      // share the same 4 keys (sexual/violence/weapons/drugs) — a plain
      // {...imageScores, ...textCategoryScores} let the text pass's
      // (usually near-zero, caption-derived) score silently overwrite a
      // real, dangerous Vision score for the image whenever a caption was
      // present, which is exactly why an image-only-dangerous post with any
      // caption at all was sailing through undetected. hate/threats/text
      // only ever come from textScores, so max() is a no-op for those.
      scores = mergeMaxScores(maxAcrossFrames(perFrameScores), textScores, textCategoryScores);
      textScoresForRecheck = { hate: textScores.hate ?? 0, threats: textScores.threats ?? 0, text: textScores.text ?? 0 };
    }

    let decision: "approved" | "recheck" | "admin_review";
    let reason: string | null = null;
    let triggeredCategories: string[] = [];

    if (serviceUnavailable) {
      decision = "admin_review";
      reason = imageCheckFailedOuter && textCheckFailedOuter
        ? "Verificare automată indisponibilă (Google Vision și Google Natural Language)."
        : imageCheckFailedOuter
        ? "Verificare imagine indisponibilă (Google Vision)."
        : "Verificare text indisponibilă (Google Natural Language sau traducere MyMemory).";
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
    const newStatus = decision === "approved" ? "approved" : decision === "admin_review" ? "flagged" : "pending";
    if (content_type === "avatar") {
      // Avatars use a different shape than posts/video_submissions: there's
      // no separate row to flip a status on, just pending_photo_url +
      // avatar_moderation_status staged on the profile row itself (see
      // 20261006090000_avatar_moderation.sql). Approval promotes the staged
      // URL into photo_url via approve_pending_avatar; recheck/admin_review
      // leaves pending_photo_url untouched and just updates the status so
      // the author sees "pending"/"flagged" instead of the file going live.
      if (decision === "approved") {
        await adminClient.rpc("approve_pending_avatar", { p_user_id: content_id, p_table: avatar_table });
      } else {
        await adminClient.from(avatar_table!).update({
          avatar_moderation_status: newStatus === "approved" ? null : newStatus,
        }).eq("user_id", content_id);
      }
    } else if (content_type === "video_highlight") {
      // Same staged-approval shape as avatars: content_id here is the
      // video_highlight_submissions.id (see
      // 20261015090000_video_highlights_moderation.sql). Approval appends
      // the url/description into player_profiles' live arrays via
      // approve_video_highlight; recheck/admin_review just flips this
      // row's own status column (a real column here, unlike avatars).
      if (decision === "approved") {
        await adminClient.rpc("approve_video_highlight", { p_submission_id: content_id });
      } else {
        await adminClient.from("video_highlight_submissions").update({ moderation_status: newStatus }).eq("id", content_id);
      }
    } else {
      // "scout_post" mirrors "post" exactly (see
      // 20261016090000_scout_posts_same_pipeline_as_posts.sql) — a
      // Descoperitor's own post row, just in a different table.
      const table = content_type === "post" ? "posts" : content_type === "scout_post" ? "scout_posts" : "video_submissions";
      await adminClient.from(table).update({ moderation_status: newStatus }).eq("id", content_id);
    }

    // initialTextScores lets recheck-video-content resolve a triggered
    // hate/threats/text category from this pass's own Google Natural
    // Language (or test-mode mock) results, without re-querying any text
    // provider a second time.
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
