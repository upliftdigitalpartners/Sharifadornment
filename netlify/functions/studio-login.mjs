/* POST /api/studio/login  { password }  →  { session }
 * Rate-limited per visitor, and every wrong guess is slowed down, so the
 * password can't be guessed by trying many times. */
import { configured, json, newSession, password, safeEqual, cors } from "../lib/studio.mjs";

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (!configured()) return json(req, { error: "The Studio isn't set up yet." }, 503);

  let given = "";
  try { given = String((await req.json()).password || ""); } catch { /* empty body */ }

  if (!given || !(await safeEqual(given, password()))) {
    await new Promise((r) => setTimeout(r, 1500));
    return json(req, { error: "That password isn't right." }, 401);
  }
  return json(req, { session: await newSession() });
};

export const config = {
  path: "/api/studio/login",
  method: ["POST", "OPTIONS"],
  // At most 8 tries per 3 minutes from one visitor (preflight requests count too)
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 180, windowLimit: 16 },
};
