/* POST /api/studio/orders  (Authorization: Bearer <session>)
 *   {}                                                     → { orders: [...] } newest first
 *   { update: { id, status?, paid?, note?, tracking? } }   → { orders: [...] }
 * Card orders still waiting for payment are checked with Stripe as they're listed.
 * Cancelling puts counted pieces back in stock; "On its way" and "Delivered" email
 * the customer when emails are set up. */
import { checkSession, configured, cors, json } from "../lib/studio.mjs";
import { STATUSES, cancelOrder, catalogue, changeOrder, emailCustomer, expireHolds, orders, refreshPayment, reviewUrl, takeStock, trackUrl } from "../lib/orders.mjs";

const ORDER_ID = /^SA-\d{6}-[A-Z0-9]{4}$/;
const clip = (v, n) => String(v ?? "").slice(0, n);

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (!configured()) return json(req, { error: "The Studio isn't set up yet." }, 503);
  if (!(await checkSession(req))) return json(req, { error: "Please sign in again." }, 401);

  let body = {};
  try { body = (await req.json()) || {}; } catch { /* no body */ }
  const store = orders();

  const u = body.update;
  if (u && typeof u === "object") {
    if (!ORDER_ID.test(String(u.id))) return json(req, { error: "Unknown order." }, 400);
    const before = await store.get(u.id, { type: "json" });
    if (!before) return json(req, { error: "Unknown order." }, 404);
    if (u.status != null && !STATUSES.includes(u.status)) return json(req, { error: "Unknown status." }, 400);
    const was = before.status;

    if (u.status === "cancelled" && was !== "cancelled") {
      await cancelOrder(u.id); // puts counted pieces and the code use back, exactly once
    } else if (u.status && was === "cancelled" && u.status !== "cancelled" && before.restocked) {
      // Re-opening takes the pieces out of stock again, if they're still there
      const lines = before.lines.map((l) => ({ ...l }));
      if (!(await takeStock(lines))) return json(req, { error: "Can't re-open this order: one of its pieces has sold out since. Add stock to it first." }, 409);
      await changeOrder(u.id, (o) => { o.restocked = false; o.lines = lines; });
    }
    await changeOrder(u.id, (o) => {
      if (u.status != null) { o.status = u.status; (o.times ||= {})[u.status] ||= new Date().toISOString(); }
      if (u.paid != null) {
        // Ticking "Paid in full" records the rest as paid by hand; unticking goes back to what came by card
        o.amountPaid = u.paid ? o.total : o.cardPaid || 0;
        o.paid = o.amountPaid >= o.total - 0.005;
        o.paidAt = o.paid ? new Date().toISOString() : null;
      }
      if (u.note != null) o.note = clip(u.note, 1000);
      if (u.tracking && typeof u.tracking === "object") o.tracking = { carrier: clip(u.tracking.carrier, 40), number: clip(u.tracking.number, 60) };
      o.updated = new Date().toISOString();
    });
    if (u.status && u.status !== was && (u.status === "shipped" || u.status === "delivered")) {
      const { site } = await catalogue();
      await emailCustomer(await store.get(u.id, { type: "json" }), u.status, site);
    }
  }

  await expireHolds();
  const { blobs } = await store.list();
  let all = (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })))).filter(Boolean);
  const weekAgo = Date.now() - 7 * 864e5;
  all = await Promise.all(all.map(async (o) => (o.pay !== "later" && !o.amountPaid && Date.parse(o.created) > weekAgo ? (await refreshPayment(o)).order : o)));
  all.sort((a, b) => b.created.localeCompare(a.created));
  // Links for texting the customer; the secret token itself stays on the server
  return json(req, { orders: all.map(({ token, payUrl, ...o }) => ({ ...o, trackUrl: trackUrl({ id: o.id, token }), reviewUrl: reviewUrl({ id: o.id, token }) })) });
};

export const config = {
  path: "/api/studio/orders",
  method: ["POST", "OPTIONS"],
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 60 },
};
