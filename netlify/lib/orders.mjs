/* Shared helpers for orders: the current catalogue, totals, the order store and Stripe.
 *
 * Prices are never taken from the browser. Every order is priced here from the
 * published content (content/items.json on main), so editing a page can't change
 * what someone pays.
 *
 * Card payments use Stripe Checkout. They are off until both of these are true:
 *   - STRIPE_SECRET_KEY is set (Netlify → Environment variables, Functions scope, secret)
 *   - "Card payments" is ticked in the Studio (Pages → Ordering & checkout)
 */
import { getStore } from "@netlify/blobs";
import { BASE, BRANCH, env, github } from "./studio.mjs";

export const SITE = "https://sharifadornment.com/";
export const STATUSES = ["new", "confirmed", "delivered", "cancelled"];
export const orders = () => getStore({ name: "orders", consistency: "strong" });

/* ---------- The published content (cached for a minute per function instance) ---------- */
let cache = { at: 0, data: null };
export async function catalogue() {
  if (cache.data && Date.now() - cache.at < 60_000) return cache.data;
  const read = async (file) => {
    const f = await github(`${BASE}/contents/content/${file}?ref=${BRANCH}`);
    return JSON.parse(Buffer.from(f.content, "base64").toString("utf8"));
  };
  const [site, items] = await Promise.all([read("site.json"), read("items.json")]);
  cache = { at: Date.now(), data: { site, items } };
  return cache.data;
}

export { deliveryFor } from "../../shared/render.mjs";
export const cardsOn = (site) => Boolean(site.checkout?.cardPayments && env("STRIPE_SECRET_KEY"));

/* ---------- Order ids and secrets ---------- */
export function newId() {
  const d = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" }).replace(/-/g, "").slice(2);
  const r = crypto.getRandomValues(new Uint8Array(3));
  return `SA-${d}-${[...r].map((b) => b.toString(36).padStart(2, "0")).join("").toUpperCase().slice(0, 4)}`;
}
export const newToken = () => Buffer.from(crypto.getRandomValues(new Uint8Array(18))).toString("base64url");

/* ---------- What a customer may see of their own order ---------- */
export function publicView(o, site) {
  return {
    id: o.id, created: o.created, status: o.status, pay: o.pay, paid: o.paid,
    lines: o.lines, subtotal: o.subtotal, delivery: o.delivery, total: o.total,
    name: o.customer.name,
    payLater: o.pay === "later" ? site?.checkout?.payLater || "" : "",
  };
}

/* ---------- Stripe (plain HTTPS calls, no SDK) ---------- */
async function stripe(path, { method = "GET", form } = {}) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${env("STRIPE_SECRET_KEY")}`,
      ...(form ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: form ? new URLSearchParams(form).toString() : undefined,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const err = new Error(data?.error?.message || `Stripe said ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

export async function startCardPayment(order) {
  const form = {
    mode: "payment",
    success_url: `${SITE}order-done.html?o=${order.id}&t=${order.token}`,
    cancel_url: `${SITE}checkout.html?cancelled=1`,
    client_reference_id: order.id,
    "metadata[order]": order.id,
    "payment_intent_data[description]": `Sharif Adornment order ${order.id}`,
  };
  if (order.customer.email) form.customer_email = order.customer.email;
  const lines = [...order.lines.map((l) => ({ name: l.name, cents: Math.round(l.price * 100), qty: l.qty, image: l.image }))];
  if (order.delivery) lines.push({ name: "Delivery", cents: Math.round(order.delivery * 100), qty: 1 });
  lines.forEach((l, i) => {
    form[`line_items[${i}][quantity]`] = String(l.qty);
    form[`line_items[${i}][price_data][currency]`] = "usd";
    form[`line_items[${i}][price_data][unit_amount]`] = String(l.cents);
    form[`line_items[${i}][price_data][product_data][name]`] = l.name;
    if (l.image) form[`line_items[${i}][price_data][product_data][images][0]`] = SITE + l.image.replace(/\.webp$/i, ".jpg");
  });
  const session = await stripe("checkout/sessions", { method: "POST", form });
  return { id: session.id, url: session.url };
}

/** Ask Stripe whether a card order has been paid yet; saves the answer. */
export async function refreshPayment(order) {
  if (order.pay !== "card" || order.paid || !order.stripeSession || !env("STRIPE_SECRET_KEY")) return order;
  try {
    const s = await stripe(`checkout/sessions/${encodeURIComponent(order.stripeSession)}`);
    if (s.payment_status === "paid") {
      order.paid = true;
      order.paidAt = new Date().toISOString();
      await orders().setJSON(order.id, order);
    }
  } catch { /* Stripe unreachable: try again next time */ }
  return order;
}
