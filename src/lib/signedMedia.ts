import { supabase } from "@/integrations/supabase/client";

// Buckets that are private: a stored URL from one of these can't be loaded
// directly and has to be exchanged for a short-lived signed URL first.
const PRIVATE_BUCKETS = new Set([
  "player-videos",
  "player-documents",
  "scout-reports",
  "stories",
  "message-attachments",
  "group-attachments",
]);

// Long enough that an open tab keeps working through a normal session;
// short enough that a leaked link is not permanent.
const TTL_SECONDS = 4 * 60 * 60;
// Re-sign a bit before expiry so an in-flight render never gets a dead URL.
const REFRESH_MARGIN_MS = 5 * 60 * 1000;

const STORAGE_MARKER = "/storage/v1/object/";

export function parseStorageUrl(url: string): { bucket: string; path: string } | null {
  const idx = url.indexOf(STORAGE_MARKER);
  if (idx === -1) return null;
  let rest = url.slice(idx + STORAGE_MARKER.length);
  const q = rest.indexOf("?");
  if (q !== -1) rest = rest.slice(0, q);
  // Public/signed/authenticated URL variants all carry a leading mode segment.
  rest = rest.replace(/^(public|sign|authenticated)\//, "");
  const slash = rest.indexOf("/");
  if (slash === -1) return null;
  const bucket = rest.slice(0, slash);
  let path = rest.slice(slash + 1);
  try { path = decodeURI(path); } catch { /* keep as-is */ }
  if (!bucket || !path) return null;
  return { bucket, path };
}

export function isPrivateStorageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const parsed = parseStorageUrl(url);
  return !!parsed && PRIVATE_BUCKETS.has(parsed.bucket);
}

type CacheEntry = { url: string; expiresAt: number };
const cache = new Map<string, CacheEntry>();
const inflight = new Map<string, Promise<string | null>>();

function cacheKey(bucket: string, path: string) {
  return `${bucket}/${path}`;
}

export function peekSignedUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const parsed = parseStorageUrl(url);
  if (!parsed || !PRIVATE_BUCKETS.has(parsed.bucket)) return url;
  const hit = cache.get(cacheKey(parsed.bucket, parsed.path));
  if (hit && hit.expiresAt - REFRESH_MARGIN_MS > Date.now()) return hit.url;
  return null;
}

// Requests made in the same tick are coalesced into one createSignedUrls
// call per bucket, so a feed of 30 images costs one round trip, not 30.
type Waiter = { resolve: (u: string | null) => void };
const queue = new Map<string, Map<string, Waiter[]>>();
let flushScheduled = false;

function enqueue(bucket: string, path: string): Promise<string | null> {
  return new Promise((resolve) => {
    let paths = queue.get(bucket);
    if (!paths) { paths = new Map(); queue.set(bucket, paths); }
    let waiters = paths.get(path);
    if (!waiters) { waiters = []; paths.set(path, waiters); }
    waiters.push({ resolve });
    if (!flushScheduled) {
      flushScheduled = true;
      queueMicrotask(flush);
    }
  });
}

async function flush() {
  flushScheduled = false;
  const batches = [...queue.entries()];
  queue.clear();
  await Promise.all(batches.map(async ([bucket, paths]) => {
    const pathList = [...paths.keys()];
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(pathList, TTL_SECONDS);
    if (error || !data) {
      console.error(`signing ${bucket} failed:`, error);
      paths.forEach((waiters) => waiters.forEach((w) => w.resolve(null)));
      return;
    }
    const byPath = new Map<string, string | null>();
    data.forEach((item, i) => byPath.set(pathList[i], item.signedUrl ?? null));
    paths.forEach((waiters, path) => {
      const signed = byPath.get(path) ?? null;
      if (signed) cache.set(cacheKey(bucket, path), { url: signed, expiresAt: Date.now() + TTL_SECONDS * 1000 });
      waiters.forEach((w) => w.resolve(signed));
    });
  }));
}

// Returns the URL to actually load: unchanged for anything that isn't a
// private-bucket URL (public buckets, external links), a signed URL
// otherwise, or null if signing failed (no access, missing object).
export async function getSignedMediaUrl(url: string | null | undefined): Promise<string | null> {
  if (!url) return null;
  const parsed = parseStorageUrl(url);
  if (!parsed || !PRIVATE_BUCKETS.has(parsed.bucket)) return url;

  const key = cacheKey(parsed.bucket, parsed.path);
  const hit = cache.get(key);
  if (hit && hit.expiresAt - REFRESH_MARGIN_MS > Date.now()) return hit.url;

  const pending = inflight.get(key);
  if (pending) return pending;

  const p = enqueue(parsed.bucket, parsed.path).finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

export async function getSignedMediaUrls(urls: (string | null | undefined)[]): Promise<(string | null)[]> {
  return Promise.all(urls.map((u) => getSignedMediaUrl(u)));
}

// window.open() after an await is blocked by most popup blockers, so the
// tab is opened synchronously (inside the click) and pointed at the signed
// URL once it arrives.
export async function openSignedUrl(url: string) {
  const cached = peekSignedUrl(url);
  if (cached) {
    window.open(cached, "_blank", "noopener");
    return;
  }
  const tab = window.open("", "_blank");
  const signed = (await getSignedMediaUrl(url)) ?? url;
  if (tab) tab.location.href = signed;
  else window.open(signed, "_blank", "noopener");
}
