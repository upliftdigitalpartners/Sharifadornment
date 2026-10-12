/* POST /api/track  {"e":"page","p":"/collections.html","n":1,"s":"facebook","d":"phone"}
 *                  {"e":"view","id":"red-zardozi-potli"}
 * Anonymous counts for the Studio's Analytics tab, per month: page views and
 * visits per day, where visits came from and on what kind of device, and piece
 * views, saves, questions and shares. No cookies, no IP addresses, nothing
 * personal is stored. Sent with navigator.sendBeacon. */
import { getStore } from "@netlify/blobs";

const EVENTS = new Set(["page", "view", "save", "ask", "share", "bag"]);
const SOURCES = new Set(["direct", "facebook", "instagram", "google", "whatsapp", "other"]);
const DEVICES = new Set(["phone", "tablet", "computer"]);
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const PAGE = /^\/[a-z0-9/_.-]{0,100}$/i;
const MAX_KEYS = 400; // per list per month, so junk can't grow the store

// Days are counted in the shop's own time zone
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }); // 2026-10-11

export default async (req) => {
  let d;
  try { d = JSON.parse(await req.text()); } catch { return new Response(null, { status: 400 }); }
  const e = String(d?.e || "");
  if (!EVENTS.has(e)) return new Response(null, { status: 400 });

  const date = today();
  const day = date.slice(8);
  const adds = []; // [list, key] pairs to add one to
  if (e === "page") {
    const p = String(d.p || "");
    if (!PAGE.test(p)) return new Response(null, { status: 400 });
    adds.push(["page", p], ["dayPages", day]);
    // The first page of a visit also says where the visitor came from and on what
    if (d.n) {
      adds.push(["visit", "all"], ["dayVisits", day],
        ["source", SOURCES.has(d.s) ? d.s : "other"], ["device", DEVICES.has(d.d) ? d.d : "computer"]);
    }
  } else {
    const id = String(d.id || "");
    if (!ID.test(id)) return new Response(null, { status: 400 });
    adds.push([e, id]);
  }

  const month = date.slice(0, 7);
  const store = getStore({ name: "stats", consistency: "strong" });
  // Read, add, and write back only if nobody else wrote in between (otherwise retry),
  // so visits arriving at the same moment are all counted
  for (let attempt = 0; attempt < 6; attempt++) {
    const found = await store.getWithMetadata(month, { type: "json" });
    const data = found?.data || {};
    for (const [list, key] of adds) {
      const bucket = Object.hasOwn(data, list) ? data[list] : (data[list] = {});
      const known = Object.hasOwn(bucket, key);
      if (known || Object.keys(bucket).length < MAX_KEYS) bucket[key] = (known ? bucket[key] : 0) + 1;
    }
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
