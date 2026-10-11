/* POST /api/track  {"e":"view","id":"red-zardozi-potli","p":"/collections.html"}
 * Anonymous counts for the Studio's Stats tab: page views, piece views, saves,
 * questions, shares and booking requests, per month. No cookies, no IP
 * addresses or personal data are stored. Sent with navigator.sendBeacon. */
import { getStore } from "@netlify/blobs";

const EVENTS = new Set(["page", "view", "save", "ask", "share", "book"]);
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const PAGE = /^\/[a-z0-9/_.-]{0,100}$/i;
const MAX_KEYS = 400; // per event per month, so junk can't grow the store

export default async (req) => {
  let d;
  try { d = JSON.parse(await req.text()); } catch { return new Response(null, { status: 400 }); }
  const e = String(d?.e || "");
  if (!EVENTS.has(e)) return new Response(null, { status: 400 });
  const key = e === "page" ? String(d.p || "") : String(d.id || "");
  if (e === "page" ? !PAGE.test(key) : e !== "book" && !ID.test(key)) return new Response(null, { status: 400 });

  const month = new Date().toISOString().slice(0, 7);
  const store = getStore({ name: "stats", consistency: "strong" });
  const data = (await store.get(month, { type: "json" })) || {};
  const bucket = (data[e] ||= {});
  const k = key || "all";
  if (bucket[k] != null || Object.keys(bucket).length < MAX_KEYS) bucket[k] = (bucket[k] || 0) + 1;
  await store.setJSON(month, data);
  return new Response(null, { status: 204 });
};

export const config = {
  path: "/api/track",
  method: "POST",
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 60 },
};
