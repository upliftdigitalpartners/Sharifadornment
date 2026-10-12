/* POST /api/studio/orders  (Authorization: Bearer <session>)
 *   {}                                              → { orders: [...] } newest first
 *   { update: { id, status?, paid?, note? } }       → { orders: [...] }
 * Card orders that aren't marked paid yet are checked with Stripe as they're listed. */
import { checkSession, configured, cors, json } from "../lib/studio.mjs";
import { STATUSES, orders, refreshPayment } from "../lib/orders.mjs";

const ORDER_ID = /^SA-\d{6}-[A-Z0-9]{4}$/;

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (!configured()) return json(req, { error: "The Studio isn't set up yet." }, 503);
  if (!(await checkSession(req))) return json(req, { error: "Please sign in again." }, 401);

  let body = {};
  try { body = await req.json(); } catch { /* no body */ }
  const store = orders();

  const u = body.update;
  if (u) {
    if (!ORDER_ID.test(String(u.id))) return json(req, { error: "Unknown order." }, 400);
    const order = await store.get(u.id, { type: "json" });
    if (!order) return json(req, { error: "Unknown order." }, 404);
    if (u.status != null) {
      if (!STATUSES.includes(u.status)) return json(req, { error: "Unknown status." }, 400);
      order.status = u.status;
    }
    if (u.paid != null) { order.paid = Boolean(u.paid); order.paidAt = order.paid ? new Date().toISOString() : null; }
    if (u.note != null) order.note = String(u.note).slice(0, 1000);
    order.updated = new Date().toISOString();
    await store.setJSON(order.id, order);
  }

  const { blobs } = await store.list();
  const all = (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })))).filter(Boolean);
  // Recent unpaid card orders: ask Stripe whether they've been paid since
  const weekAgo = Date.now() - 7 * 864e5;
  await Promise.all(all.filter((o) => o.pay === "card" && !o.paid && Date.parse(o.created) > weekAgo).map(refreshPayment));
  all.sort((a, b) => b.created.localeCompare(a.created));
  return json(req, { orders: all.map(({ token, ...o }) => o) });
};

export const config = {
  path: "/api/studio/orders",
  method: ["POST", "OPTIONS"],
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 60 },
};
