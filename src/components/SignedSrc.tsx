import type { AnchorHTMLAttributes, ImgHTMLAttributes, VideoHTMLAttributes, ReactNode } from "react";
import { useSignedUrl } from "@/hooks/useSignedUrl";

// Render-prop wrapper for places where a hook can't be used directly
// (inside .map() callbacks). `signed` is null while resolving.
export function SignedSrc({ url, children }: { url: string | null | undefined; children: (signed: string | null) => ReactNode }) {
  const signed = useSignedUrl(url);
  return <>{children(signed)}</>;
}

type SignedImgProps = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & { src: string | null | undefined };

export function SignedImg({ src, ...rest }: SignedImgProps) {
  const signed = useSignedUrl(src);
  if (!signed) return null;
  return <img src={signed} {...rest} />;
}

type SignedVideoProps = Omit<VideoHTMLAttributes<HTMLVideoElement>, "src"> & { src: string | null | undefined };

export function SignedVideo({ src, ...rest }: SignedVideoProps) {
  const signed = useSignedUrl(src);
  if (!signed) return null;
  return <video src={signed} {...rest} />;
}

type SignedLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & { href: string | null | undefined };

// Keeps the anchor in the DOM (layout, keyboard focus) but without a
// destination until the signed URL is ready.
export function SignedLink({ href, children, ...rest }: SignedLinkProps) {
  const signed = useSignedUrl(href);
  return <a href={signed ?? undefined} aria-disabled={!signed} {...rest}>{children}</a>;
}
