/* POST /api/studio/orders  (Authorization: Bearer <session>)
 *   {}                                                     → { orders: [...] } newest first
 *   { update: { id, status?, paid?, note?, tracking? } }   → { orders: [...] }
 * Card orders still waiting for payment are checked with Stripe as they're listed.
 * Cancelling puts counted pieces back in stock; "On its way" and "Delivered" email
 * the customer when emails are set up. */
import { checkSession, configured, cors, json } from "../lib/studio.mjs";
import { STATUSES, catalogue, emailCustomer, expireHolds, orders, refreshPayment, restock, reviewUrl, setStock, stockLevels, trackUrl } from "../lib/orders.mjs";

const ORDER_ID = /^SA-\d{6}-[A-Z0-9]{4}$/;
const clip = (v, n) => String(v ?? "").slice(0, n);

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
    const was = order.status;
    if (u.status != null) {
      if (!STATUSES.includes(u.status)) return json(req, { error: "Unknown status." }, 400);
      order.status = u.status;
      (order.times ||= {})[u.status] ||= new Date().toISOString();
    }
    if (u.paid != null) {
      order.paid = Boolean(u.paid);
      order.amountPaid = order.paid ? order.total : (order.pay === "later" ? 0 : order.amountPaid);
      order.paidAt = order.paid ? new Date().toISOString() : null;
    }
    if (u.note != null) order.note = clip(u.note, 1000);
    if (u.tracking != null) order.tracking = { carrier: clip(u.tracking.carrier, 40), number: clip(u.tracking.number, 60) };
    order.updated = new Date().toISOString();

    // Stock follows cancelling and un-cancelling
    if (order.status === "cancelled" && was !== "cancelled") await restock(order);
    if (was === "cancelled" && order.status !== "cancelled" && order.restocked) {
      const levels = await stockLevels();
      const change = {};
      for (const l of order.lines) if (l.kind === "buy" && l.counted && Object.hasOwn(levels, l.id)) change[l.id] = Math.max(0, (change[l.id] ?? levels[l.id]) - l.qty);
      if (Object.keys(change).length) await setStock(change);
      order.restocked = false;
    }
    await store.setJSON(order.id, order);
    if (u.status && u.status !== was && (u.status === "shipped" || u.status === "delivered")) {
      const { site } = await catalogue();
      await emailCustomer(order, u.status, site);
    }
  }

  await expireHolds();
  const { blobs } = await store.list();
  const all = (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })))).filter(Boolean);
  const weekAgo = Date.now() - 7 * 864e5;
  await Promise.all(all.filter((o) => o.pay !== "later" && !o.amountPaid && Date.parse(o.created) > weekAgo).map(refreshPayment));
  all.sort((a, b) => b.created.localeCompare(a.created));
  // Links for texting the customer; the secret token itself stays on the server
  return json(req, { orders: all.map(({ token, payUrl, ...o }) => ({ ...o, trackUrl: trackUrl({ id: o.id, token }), reviewUrl: reviewUrl({ id: o.id, token }) })) });
};

export const config = {
  path: "/api/studio/orders",
  method: ["POST", "OPTIONS"],
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 60 },
};
