// Generates a Google Cloud OAuth 2.0 access token from a Service Account,
// using the JWT Bearer flow (RFC 7523) — no external library, just Web
// Crypto (available in the Deno Edge Function runtime). Used to call Video
// Intelligence with `Authorization: Bearer <token>` instead of an API key
// (Video Intelligence's long-running-operation model authenticates better
// via a Service Account than a bare API key for this call pattern).
//
// Never logs, returns, or otherwise exposes the private key or the minted
// access token — both stay server-side, used only for the outgoing
// Authorization header of this function's own Google API calls.

const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/cloud-platform";

// A GOOGLE_CLOUD_PRIVATE_KEY secret pasted via a dashboard/CLI can end up
// with either real newlines or literal "\n" two-character sequences,
// depending on how it was entered — normalize both to real newlines.
function normalizePrivateKey(raw: string): string {
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

function base64UrlEncode(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let binary = "";
  for (const b of arr) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function pemToDer(pem: string): ArrayBuffer {
  const stripped = pem
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(stripped);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function importSigningKey(pem: string): Promise<CryptoKey> {
  const der = pemToDer(pem);
  return crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

interface CachedToken {
  accessToken: string;
  expiresAt: number; // epoch ms
}

// Module-scope cache: Edge Function instances can be reused across
// invocations, so avoid minting a fresh token (and hitting Google's token
// endpoint) on every single request within the same instance's lifetime.
let cached: CachedToken | null = null;

export async function getGoogleAccessToken(): Promise<string> {
  if (cached && cached.expiresAt - 60_000 > Date.now()) {
    return cached.accessToken;
  }

  const clientEmail = Deno.env.get("GOOGLE_CLOUD_CLIENT_EMAIL");
  const privateKeyRaw = Deno.env.get("GOOGLE_CLOUD_PRIVATE_KEY");
  const projectId = Deno.env.get("GOOGLE_CLOUD_PROJECT_ID");
  if (!clientEmail || !privateKeyRaw || !projectId) {
    throw new Error("Google service account credentials are not fully configured");
  }

  const privateKeyPem = normalizePrivateKey(privateKeyRaw);
  const key = await importSigningKey(privateKeyPem);

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claimSet = {
    iss: clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  };

  const encoder = new TextEncoder();
  const unsigned = `${base64UrlEncode(encoder.encode(JSON.stringify(header)))}.${base64UrlEncode(encoder.encode(JSON.stringify(claimSet)))}`;
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    encoder.encode(unsigned)
  );
  const assertion = `${unsigned}.${base64UrlEncode(signature)}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!res.ok) {
    // Deliberately do not include response body verbatim in a thrown error
    // that might get surfaced to a client — log server-side only.
    const text = await res.text();
    console.error("Google OAuth token exchange failed:", res.status, text);
    throw new Error("Failed to obtain Google Cloud access token");
  }

  const data = await res.json();
  const accessToken = data.access_token as string;
  const expiresIn = (data.expires_in as number) ?? 3600;
  cached = { accessToken, expiresAt: Date.now() + expiresIn * 1000 };
  return accessToken;
}
