// Produces a single moderation-ready JPEG frame from an uploaded image file,
// entirely client-side — the image counterpart of extractSampleFrames in
// videoFrameExtraction.ts, used so a photo post goes through the exact same
// analyze-video-frames pipeline as a video (just with one frame instead of
// six).
import type { ExtractedFrame } from "@/lib/videoFrameExtraction";

const MAX_FRAME_DIMENSION = 640;
const JPEG_QUALITY = 0.6;

export async function extractImageFrame(file: File): Promise<ExtractedFrame[]> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Image failed to load"));
      el.src = url;
    });

    const scale = Math.min(1, MAX_FRAME_DIMENSION / Math.max(img.naturalWidth, img.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas 2D context unavailable");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL("image/jpeg", JPEG_QUALITY);
    return [{ base64: dataUrl.split(",")[1], atFraction: 0 }];
  } finally {
    URL.revokeObjectURL(url);
  }
}
