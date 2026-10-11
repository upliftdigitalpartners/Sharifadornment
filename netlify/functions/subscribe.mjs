/* POST /api/subscribe  {"email":"name@example.com"}
 * Adds an email to the "new arrivals" list. Only the Studio can read the list. */
import { getStore } from "@netlify/blobs";
import { cors, json } from "../lib/studio.mjs";

const EMAIL = /^(?![/%.])[^\s@<>"'/\\%]{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,24}$/i;

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  let email = "";
  try { email = String((await req.json()).email || "").trim().toLowerCase(); } catch { /* empty */ }
  if (!EMAIL.test(email)) return json(req, { error: "Please enter a valid email address." }, 400);
  const store = getStore("subscribers");
  if (!(await store.get(email))) await store.setJSON(email, { email, date: new Date().toISOString() });
  return json(req, { ok: true });
};

export const config = {
  path: "/api/subscribe",
  method: ["POST", "OPTIONS"],
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 10 },
};
