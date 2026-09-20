// Extracts sample frames from a video file entirely client-side, before
// upload, for the moderation pipeline's first pass (see
// VIDEO_MODERATION_IMPLEMENTATION_PROMPT.md §2).
//
// Deliberate deviation from the prompt's suggested ffmpeg.wasm: ffmpeg.wasm
// ships a ~30MB wasm binary just to grab 6 JPEG thumbnails, which the
// browser's own <video>+<canvas> decoding already does natively, for free,
// with no bundle cost. ffmpeg.wasm remains the fallback if a browser is ever
// found where native seeking is unreliable, but none has needed it so far.
const SAMPLE_FRACTIONS = [0, 0.2, 0.4, 0.6, 0.8, 1] as const;
const MAX_FRAME_DIMENSION = 640;
const JPEG_QUALITY = 0.6;

export interface ExtractedFrame {
  base64: string; // no data: prefix
  atFraction: number;
}

// A hard ceiling on video length, checked client-side before upload even
// starts — keeps both the moderation pipeline's per-upload cost (frame
// extraction/OpenAI/Vision calls scale with nothing here, but Video
// Intelligence's recheck stage bills by video duration) and Supabase
// Storage usage bounded and predictable. Not a moderation decision, just a
// resource limit — enforced the same way for every uploader.
export const MAX_VIDEO_DURATION_SECONDS = 60;

// Reads a video file's duration without extracting any frames — used for
// a fast client-side reject right at file-selection time, before the user
// waits through an entire upload only to have it rejected. Loads only
// <video> metadata (not the full file), so this is cheap even for a
// near-limit-size file.
export function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.src = url;
    const cleanup = () => { URL.revokeObjectURL(url); video.removeAttribute("src"); video.load(); };
    video.addEventListener("loadedmetadata", () => {
      const duration = video.duration;
      cleanup();
      if (!isFinite(duration) || duration <= 0) reject(new Error("Video has no readable duration"));
      else resolve(duration);
    }, { once: true });
    video.addEventListener("error", () => { cleanup(); reject(new Error("Video metadata failed to load")); }, { once: true });
  });
}

function seekTo(video: HTMLVideoElement, time: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSeeked = () => { cleanup(); resolve(); };
    const onError = () => { cleanup(); reject(new Error("Video seek failed")); };
    const cleanup = () => {
      video.removeEventListener("seeked", onSeeked);
      video.removeEventListener("error", onError);
    };
    video.addEventListener("seeked", onSeeked);
    video.addEventListener("error", onError);
    video.currentTime = time;
  });
}

export async function extractSampleFrames(file: File): Promise<ExtractedFrame[]> {
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;

  try {
    await new Promise<void>((resolve, reject) => {
      video.addEventListener("loadedmetadata", () => resolve(), { once: true });
      video.addEventListener("error", () => reject(new Error("Video metadata failed to load")), { once: true });
    });

    const duration = video.duration;
    if (!isFinite(duration) || duration <= 0) {
      throw new Error("Video has no readable duration");
    }

    const scale = Math.min(1, MAX_FRAME_DIMENSION / Math.max(video.videoWidth, video.videoHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(video.videoWidth * scale));
    canvas.height = Math.max(1, Math.round(video.videoHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");

    const frames: ExtractedFrame[] = [];
    for (const fraction of SAMPLE_FRACTIONS) {
      // Never seek exactly to `duration` — some browsers refuse/hang on it.
      const time = Math.min(duration * fraction, Math.max(0, duration - 0.05));
      await seekTo(video, time);
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
      frames.push({ base64: dataUrl.split(",")[1], atFraction: fraction });
    }
    return frames;
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute("src");
    video.load();
  }
}
