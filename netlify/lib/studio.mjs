/* Shared helpers for the Studio API (Netlify Functions).
 *
 * The Studio (sharifadornment.com/studio/) never sees the GitHub token. It signs
 * in with the Studio password here, gets a short-lived signed session, and sends
 * GitHub requests through /api/studio/github, which checks the session, allows
 * only the few calls the Studio needs, and adds the token.
 *
 * Environment variables (Netlify → Project configuration → Environment variables,
 * scope: Functions, marked secret):
 *   STUDIO_PASSWORD   the Studio password
 *   GITHUB_TOKEN      fine-grained token: Sharifadornment repo, Contents read/write
 *   STUDIO_ORIGINS    optional, comma-separated sites allowed to call the API
 */

export const OWNER = "upliftdigitalpartners";
export const REPO = "Sharifadornment";
export const BRANCH = "main";
const SESSION_HOURS = 8;
const DEFAULT_ORIGINS = [
  "https://sharifadornment.com",
  "https://www.sharifadornment.com",
  "https://upliftdigitalpartners.github.io",
];

const enc = new TextEncoder();
const env = (k) => (globalThis.Netlify ? Netlify.env.get(k) : process.env[k]) || "";

/* ---------- CORS: only the site itself may call the API ---------- */
export function cors(req) {
  const allowed = env("STUDIO_ORIGINS") ? env("STUDIO_ORIGINS").split(",").map((s) => s.trim()) : DEFAULT_ORIGINS;
  const origin = req.headers.get("origin") || "";
  return allowed.includes(origin)
    ? {
        "Access-Control-Allow-Origin": origin,
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "600",
        Vary: "Origin",
      }
    : { Vary: "Origin" };
}

export const json = (req, body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...cors(req) },
  });

/* ---------- Constant-time comparison ---------- */
async function digest(text) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(text)));
}
export async function safeEqual(a, b) {
  const [x, y] = await Promise.all([digest(String(a)), digest(String(b))]);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

/* ---------- Sessions: HMAC-signed { exp }, keyed from the secrets ----------
 * Changing the password or the token signs everyone out. */
const b64url = (bytes) => Buffer.from(bytes).toString("base64url");
async function hmacKey() {
  const secret = `studio-session:${env("STUDIO_PASSWORD")}:${env("GITHUB_TOKEN")}`;
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign", "verify"]);
}
export async function newSession() {
  const payload = b64url(enc.encode(JSON.stringify({ exp: Date.now() + SESSION_HOURS * 3600e3 })));
  const sig = new Uint8Array(await crypto.subtle.sign("HMAC", await hmacKey(), enc.encode(payload)));
  return `${payload}.${b64url(sig)}`;
}
export async function checkSession(req) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  const [payload, sig] = token.split(".");
  if (!payload || !sig) return false;
  const ok = await crypto.subtle.verify("HMAC", await hmacKey(), Buffer.from(sig, "base64url"), enc.encode(payload));
  if (!ok) return false;
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString()).exp > Date.now();
  } catch {
    return false;
  }
}

export const configured = () => Boolean(env("STUDIO_PASSWORD") && env("GITHUB_TOKEN"));
export const password = () => env("STUDIO_PASSWORD");
export const githubToken = () => env("GITHUB_TOKEN");

/* ---------- What the Studio is allowed to ask GitHub for ---------- */
const BASE = `/repos/${OWNER}/${REPO}`;
const SHA = "[0-9a-f]{40}";
// Files the Studio may write: the two content files and uploaded photos. Nothing else
// (not the pages, scripts, the Studio itself or the domain settings).
const WRITABLE = /^(content\/(site|items)\.json|assets\/uploads\/[a-z0-9][a-z0-9._-]{0,90}\.(jpg|jpeg|png|webp))$/;

export function vet(method, path, body) {
  const [p, q = ""] = path.split("?");
  if (method === "GET") {
    if (p === BASE && !q) return null;
    if (new RegExp(`^${BASE}/contents/content/(site|items)\\.json$`).test(p) && q === `ref=${BRANCH}`) return null;
    if (p === `${BASE}/git/ref/heads/${BRANCH}` && !q) return null;
    if (new RegExp(`^${BASE}/git/commits/${SHA}$`).test(p) && !q) return null;
    return "This request isn't allowed.";
  }
  if (q) return "This request isn't allowed.";
  if (method === "POST" && p === `${BASE}/git/blobs`) {
    if (!body || typeof body.content !== "string" || !["base64", "utf-8"].includes(body.encoding)) return "Bad blob.";
    return null;
  }
  if (method === "POST" && p === `${BASE}/git/trees`) {
    if (!body || !new RegExp(`^${SHA}$`).test(body.base_tree || "") || !Array.isArray(body.tree) || !body.tree.length) return "Bad tree.";
    for (const t of body.tree) {
      if (Object.keys(t).sort().join() !== "mode,path,sha,type" || t.mode !== "100644" || t.type !== "blob" ||
          !new RegExp(`^${SHA}$`).test(t.sha) || !WRITABLE.test(t.path)) {
        return `The Studio can't change ${t.path || "that file"}.`;
      }
    }
    return null;
  }
  if (method === "POST" && p === `${BASE}/git/commits`) {
    if (!body || !new RegExp(`^${SHA}$`).test(body.tree || "") || !Array.isArray(body.parents) || body.parents.length !== 1 ||
        !new RegExp(`^${SHA}$`).test(body.parents[0]) || typeof body.message !== "string") return "Bad commit.";
    return null;
  }
  if (method === "PATCH" && p === `${BASE}/git/refs/heads/${BRANCH}`) {
    if (!body || !new RegExp(`^${SHA}$`).test(body.sha || "") || body.force) return "Bad update.";
    return null;
  }
  return "This request isn't allowed.";
}
