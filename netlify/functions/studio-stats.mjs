/* POST /api/studio/stats  (Authorization: Bearer <session>)
 *   {}                         → { months: { "2026-10": {...} }, subscribers: [...] }
 *   { "unsubscribe": "email" } → removes one address from the list */
import { getStore } from "@netlify/blobs";
import { checkSession, configured, cors, json } from "../lib/studio.mjs";

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (!configured()) return json(req, { error: "The Studio isn't set up yet." }, 503);
  if (!(await checkSession(req))) return json(req, { error: "Please sign in again." }, 401);

  let body = {};
  try { body = (await req.json()) || {}; } catch { /* no body */ }
  const subs = getStore("subscribers");
  if (typeof body.unsubscribe === "string") await subs.delete(body.unsubscribe.toLowerCase());

  const stats = getStore({ name: "stats", consistency: "strong" });
  const months = {};
  const d = new Date();
  for (let i = 0; i < 6; i++) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1)).toISOString().slice(0, 7);
    months[m] = (await stats.get(m, { type: "json" })) || {};
  }
  const { blobs } = await subs.list();
  const subscribers = (await Promise.all(blobs.map((b) => subs.get(b.key, { type: "json" })))).filter(Boolean)
    .sort((a, b) => b.date.localeCompare(a.date));
  return json(req, { months, subscribers });
};

export const config = {
  path: "/api/studio/stats",
  method: ["POST", "OPTIONS"],
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 60 },
};
