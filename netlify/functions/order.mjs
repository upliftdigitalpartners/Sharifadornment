/* POST /api/order
 *   { action: "place", items: [{ id, qty }], pay: "card" | "later",
 *     customer: { name, phone, email, address, city, state, zip, notes } }
 *     → { id, token, url? }   (url = Stripe's payment page, for card orders)
 *   { action: "status", id, token } → the order as the customer may see it
 *
 * Public, but prices, stock and delivery come from the published content, and
 * an order can only be looked up again with the secret token it was created with. */
import { cors, json } from "../lib/studio.mjs";
import { cardsOn, catalogue, deliveryFor, newId, newToken, orders, publicView, refreshPayment, startCardPayment } from "../lib/orders.mjs";
import { priceNumber } from "../../shared/render.mjs";

const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const ORDER_ID = /^SA-\d{6}-[A-Z0-9]{4}$/;
const text = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);

class Bad extends Error {}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  let body;
  try { body = await req.json(); } catch { return json(req, { error: "Bad request." }, 400); }

  try {
    if (body.action === "status") {
      if (!ORDER_ID.test(String(body.id)) || typeof body.token !== "string") throw new Bad("Order not found.");
      let order = await orders().get(body.id, { type: "json" });
      if (!order || order.token !== body.token) return json(req, { error: "Order not found." }, 404);
      order = await refreshPayment(order);
      const { site } = await catalogue();
      return json(req, { order: publicView(order, site) });
    }

    if (body.action !== "place") throw new Bad("Bad request.");
    if (body.website) throw new Bad("Bad request."); // a field only bots fill in

    // Who and where
    const c = body.customer || {};
    const customer = {
      name: text(c.name, 80), phone: text(c.phone, 30), email: text(c.email, 120),
      address: text(c.address, 160), city: text(c.city, 60), state: text(c.state, 30), zip: text(c.zip, 12),
      notes: text(c.notes, 600),
    };
    if (!customer.name) throw new Bad("Please add your name.");
    if (customer.phone.replace(/\D/g, "").length < 10) throw new Bad("Please add a phone number we can text.");
    if (customer.email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(customer.email)) throw new Bad("That email address doesn't look right.");
    if (!customer.address || !customer.city || !customer.zip) throw new Bad("Please add the delivery address.");

    // What: priced from the published catalogue, never from the browser
    const { site, items } = await catalogue();
    const wanted = Array.isArray(body.items) ? body.items.slice(0, 30) : [];
    const lines = [];
    for (const w of wanted) {
      const id = String(w?.id || "");
      const qty = Math.min(5, Math.max(1, Math.floor(Number(w?.qty) || 1)));
      const it = ID.test(id) && items.find((x) => x.id === id);
      if (!it) throw new Bad("One of the pieces in your bag is no longer available. Please check your bag.");
      if (it.soldOut) throw new Bad(`Sorry, the ${it.name} has just sold out. Please remove it from your bag.`);
      const price = priceNumber(it);
      if (price == null) throw new Bad(`The ${it.name} is priced on request. Please message us about it instead.`);
      if (!lines.some((l) => l.id === id)) lines.push({ id, name: it.name, price, qty, image: it.image || "" });
    }
    if (!lines.length) throw new Bad("Your bag is empty.");
    const subtotal = Math.round(lines.reduce((s, l) => s + l.price * l.qty, 0) * 100) / 100;
    const delivery = deliveryFor(site, subtotal);

    const pay = body.pay === "card" ? "card" : "later";
    if (pay === "card" && !cardsOn(site)) throw new Bad("Card payments aren't available right now. Please choose to pay after we confirm.");

    const order = {
      id: newId(), token: newToken(), created: new Date().toISOString(),
      status: "new", pay, paid: false, customer, lines, subtotal, delivery,
      total: Math.round((subtotal + delivery) * 100) / 100, note: "",
    };
    const store = orders();
    while (await store.get(order.id)) order.id = newId();

    let url;
    if (pay === "card") {
      const s = await startCardPayment(order);
      order.stripeSession = s.id;
      url = s.url;
    }
    await store.setJSON(order.id, order);
    return json(req, { id: order.id, token: order.token, url });
  } catch (x) {
    if (x instanceof Bad) return json(req, { error: x.message }, 400);
    console.error(x);
    return json(req, { error: "Something went wrong placing your order. Please try again, or message us and we'll take it from there." }, 502);
  }
};

export const config = {
  path: "/api/order",
  method: ["POST", "OPTIONS"],
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 20 },
};
