/* POST /api/order
 *   { action: "quote", items, code?, method?, pay? }  → prices, delivery choices, tax, payment choices
 *   { action: "place", items, code?, method, pay, customer: {...}, website: "" } → { id, token, url? }
 *   { action: "status", id, token }                    → the order as the customer may see it
 *   { action: "stock" }                                → { stock: { pieceId: left } } for counted pieces
 * items: [{ id, qty }] to buy, or [{ id, kind: "rent", date: "YYYY-MM-DD" }] to rent.
 *
 * Public: every price comes from the published content, and an order can only be
 * looked up with the secret token it was created with. */
import { cors, json } from "../lib/studio.mjs";
import { Bad, cancelOrder, catalogue, orders, place, publicQuote, publicView, quote, refreshPayment, stockLevels } from "../lib/orders.mjs";

const ORDER_ID = /^SA-\d{6}-[A-Z0-9]{4}$/;

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  let body;
  try { body = await req.json(); } catch { return json(req, { error: "Bad request." }, 400); }
  if (!body || typeof body !== "object") return json(req, { error: "Bad request." }, 400);

  try {
    switch (body.action) {
      case "quote":
        return json(req, publicQuote(await quote({ wanted: body.items, code: body.code, method: body.method, pay: body.pay })));
      case "stock":
        return json(req, { stock: await stockLevels() });
      case "status": {
        if (!ORDER_ID.test(String(body.id)) || typeof body.token !== "string") throw new Bad("Order not found.");
        let order = await orders().get(body.id, { type: "json" });
        if (!order || order.token !== body.token) return json(req, { error: "Order not found." }, 404);
        ({ order } = await refreshPayment(order));
        const { site } = await catalogue();
        return json(req, { order: publicView(order, site) });
      }
      case "abandon": {
        // The customer cancelled on Stripe's page: free the held pieces straight away
        if (!ORDER_ID.test(String(body.id)) || typeof body.token !== "string") throw new Bad("Order not found.");
        const order = await orders().get(body.id, { type: "json" });
        if (!order || order.token !== body.token) return json(req, { error: "Order not found." }, 404);
        const { order: now, checked } = await refreshPayment(order);
        if (checked && now.pay !== "later" && !now.amountPaid && now.status === "new") {
          await cancelOrder(now.id, "Customer cancelled the card payment.");
        }
        return json(req, { ok: true });
      }
      case "place": {
        const order = await place(body);
        return json(req, { id: order.id, token: order.token, url: order.payUrl });
      }
      default:
        throw new Bad("Bad request.");
    }
  } catch (x) {
    if (x instanceof Bad) return json(req, { error: x.message }, 400);
    console.error(x);
    return json(req, { error: "Something went wrong. Please try again, or message us and we'll take it from there." }, 502);
  }
};

export const config = {
  path: "/api/order",
  method: ["POST", "OPTIONS"],
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 60 },
};
