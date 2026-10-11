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
  if (e === "page" ? !PAGE.test(key) : !(e === "book" && !key) && !ID.test(key)) return new Response(null, { status: 400 });

  const month = new Date().toISOString().slice(0, 7);
  const store = getStore({ name: "stats", consistency: "strong" });
  const k = key || "all";
  // Read, add one, and write back only if nobody else wrote in between (otherwise retry),
  // so visits arriving at the same moment are all counted
  for (let attempt = 0; attempt < 6; attempt++) {
    const found = await store.getWithMetadata(month, { type: "json" });
    const data = found?.data || {};
    const bucket = Object.hasOwn(data, e) ? data[e] : (data[e] = {});
    const known = Object.hasOwn(bucket, k);
    if (!known && Object.keys(bucket).length >= MAX_KEYS) break;
    bucket[k] = (known ? bucket[k] : 0) + 1;
    const { modified } = await store.setJSON(month, data, found ? { onlyIfMatch: found.etag } : { onlyIfNew: true });
    if (modified) break;
    await new Promise((r) => setTimeout(r, 20 + Math.random() * 60));
  }
  return new Response(null, { status: 204 });
};

export const config = {
  path: "/api/track",
  method: "POST",
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 60 },
};
