import { supabase } from "@/integrations/supabase/client";
import { extractSampleFrames, type ExtractedFrame } from "@/lib/videoFrameExtraction";
import { extractImageFrame } from "@/lib/imageFrameExtraction";

export type ModerationContentType = "post" | "scout_post" | "test_video" | "avatar" | "video_highlight";
export type TestScenario = "SAFE" | "UNCERTAIN_VIOLENCE" | "UNCERTAIN_SEXUAL" | "HIGH";
export type AvatarTable = "player_profiles" | "scout_profiles";

export interface ModerationOutcome {
  decision: "approved" | "recheck" | "admin_review";
  scores: Record<string, number>;
  triggeredCategories?: string[];
  initialTextScores?: { hate?: number; threats?: number; text?: number };
}

// Shared core: run the initial pass on whatever frames were extracted
// (zero for text-only, one for a photo, six for a video), then the recheck
// pass if the initial one comes back "recheck" (prompt §0, §3-7). Never
// throws — a failure here must not block the user's post; worst case the
// content sits at moderation_status='pending' until an admin looks at it.
async function runModerationPipeline(params: {
  frames: ExtractedFrame[];
  bucket: "player-videos" | null;
  storagePath: string | null;
  contentType: ModerationContentType;
  contentId: string;
  caption?: string;
  testScenario?: TestScenario;
  avatarTable?: AvatarTable;
}): Promise<ModerationOutcome | null> {
  const framePayload = params.frames.map((f) => ({ base64: f.base64, atFraction: f.atFraction }));

  const { data: initial, error: initialError } = await supabase.functions.invoke("analyze-video-frames", {
    body: {
      frames: framePayload,
      caption: params.caption,
      content_type: params.contentType,
      content_id: params.contentId,
      // Sent for "post" too, but the server ignores it unless contentType
      // is "test_video" — never gated only on the client.
      test_scenario: params.testScenario,
      avatar_table: params.avatarTable,
    },
  });
  if (initialError) {
    console.error("Initial moderation pass failed:", initialError);
    return null;
  }

  if (initial.decision !== "recheck") {
    return initial as ModerationOutcome;
  }

  // Recheck needs the original file (bucket/storagePath) only when the
  // triggered category is "sexual" (Video Intelligence reads the whole
  // file) — for a text-only or photo post there's nothing there, and
  // recheck-video-content only reaches into storage if that category is
  // actually among triggeredCategories.
  const { data: recheck, error: recheckError } = await supabase.functions.invoke("recheck-video-content", {
    body: {
      content_type: params.contentType,
      content_id: params.contentId,
      bucket: params.bucket,
      storage_path: params.storagePath,
      frames: framePayload,
      triggeredCategories: initial.triggeredCategories ?? [],
      initialTextScores: initial.initialTextScores,
      avatar_table: params.avatarTable,
    },
  });
  if (recheckError) {
    console.error("Recheck moderation pass failed:", recheckError);
    return initial as ModerationOutcome;
  }
  return recheck as ModerationOutcome;
}

// Video-specific entry point (test-performance videos, and video posts) —
// kept as its own function since every existing call site already passes a
// video File and a player-videos storage path.
export async function moderateUploadedVideo(params: {
  file: File;
  bucket: "player-videos";
  storagePath: string;
  contentType: ModerationContentType;
  contentId: string;
  caption?: string;
  // Dev/testing only: routes the initial pass to a server-decided mock
  // score set instead of calling OpenAI, so the rest of the pipeline can be
  // exercised without OpenAI billing enabled. The server only honors this
  // when MODERATION_TEST_MODE=true AND contentType is "test_video" — it is
  // always ignored for real posts, and ignored outright in production
  // regardless of what's passed here.
  testScenario?: TestScenario;
}): Promise<ModerationOutcome | null> {
  let frames: ExtractedFrame[];
  try {
    frames = await extractSampleFrames(params.file);
  } catch (err) {
    console.error("Frame extraction failed, leaving content pending for admin review:", err);
    return null;
  }
  return runModerationPipeline({ ...params, frames });
}

// General entry point for a feed post, which may carry a video, a photo, or
// neither (text only) — all three go through the same pipeline so that
// "pending until approved" and the admin queue behave identically
// regardless of what kind of content triggered it.
export async function moderateUploadedPost(params: {
  videoFile?: File | null;
  videoBucket?: "player-videos";
  videoStoragePath?: string | null;
  imageFile?: File | null;
  contentId: string;
  caption?: string;
  // Defaults to "post" (player posts/PostCard edits). Pass "scout_post" for
  // a Descoperitor's own scout_posts row — same pipeline, different table
  // (see 20261016090000_scout_posts_same_pipeline_as_posts.sql).
  contentType?: "post" | "scout_post";
}): Promise<ModerationOutcome | null> {
  let frames: ExtractedFrame[] = [];
  try {
    if (params.videoFile) {
      frames = await extractSampleFrames(params.videoFile);
    } else if (params.imageFile) {
      frames = await extractImageFrame(params.imageFile);
    }
    // Neither present: text-only post, frames stays [].
  } catch (err) {
    console.error("Frame extraction failed, leaving content pending for admin review:", err);
    return null;
  }

  return runModerationPipeline({
    frames,
    bucket: params.videoFile ? params.videoBucket ?? "player-videos" : null,
    storagePath: params.videoFile ? params.videoStoragePath ?? null : null,
    contentType: params.contentType ?? "post",
    contentId: params.contentId,
    caption: params.caption,
  });
}

// Profile photo (avatar) entry point. Unlike a post, an avatar has no
// dedicated content row — contentId here is the uploader's own user_id, and
// avatarTable says which profile table to stage/promote pending_photo_url
// on (see 20261006090000_avatar_moderation.sql). The caller is responsible
// for having already uploaded the file to a NEW path (not overwriting the
// currently-approved avatar) and staged its URL into pending_photo_url
// before calling this — this function only runs the analysis, it does not
// touch storage or pending_photo_url itself.
export async function moderateUploadedAvatar(params: {
  imageFile: File;
  userId: string;
  avatarTable: AvatarTable;
}): Promise<ModerationOutcome | null> {
  let frames: ExtractedFrame[] = [];
  try {
    frames = await extractImageFrame(params.imageFile);
  } catch (err) {
    console.error("Frame extraction failed, leaving avatar pending for admin review:", err);
    return null;
  }

  return runModerationPipeline({
    frames,
    bucket: null,
    storagePath: null,
    contentType: "avatar",
    contentId: params.userId,
    avatarTable: params.avatarTable,
  });
}
