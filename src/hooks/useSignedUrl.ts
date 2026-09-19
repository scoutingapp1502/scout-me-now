import { useEffect, useState } from "react";
import { getSignedMediaUrl, peekSignedUrl } from "@/lib/signedMedia";

// Resolves a stored storage URL to something an <img>/<video>/<a> can load.
// Non-private URLs come back synchronously; private ones are null until the
// signed URL arrives (cached hits are synchronous too).
export function useSignedUrl(url: string | null | undefined): string | null {
  const [signed, setSigned] = useState<string | null>(() => peekSignedUrl(url));

  useEffect(() => {
    let alive = true;
    const immediate = peekSignedUrl(url);
    setSigned(immediate);
    if (immediate || !url) return;
    getSignedMediaUrl(url).then((u) => { if (alive) setSigned(u); });
    return () => { alive = false; };
  }, [url]);

  return signed;
}

// Same for a list; the result keeps the input order and length, with null
// for entries that are still resolving or could not be signed.
export function useSignedUrls(urls: (string | null | undefined)[]): (string | null)[] {
  const key = urls.join("\n");
  const [signed, setSigned] = useState<(string | null)[]>(() => urls.map((u) => peekSignedUrl(u)));

  useEffect(() => {
    let alive = true;
    const immediate = urls.map((u) => peekSignedUrl(u));
    setSigned(immediate);
    if (immediate.every((s, i) => s || !urls[i])) return;
    Promise.all(urls.map((u) => getSignedMediaUrl(u))).then((res) => { if (alive) setSigned(res); });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return signed;
}
