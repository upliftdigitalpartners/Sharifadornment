/* The shop's engine: pricing, stock, orders, payments and alerts.
 *
 * Prices are never taken from the browser. Every quote and order is priced here
 * from the published content (content/items.json and site.json on main), plus
 * the private shop data kept in Netlify Blobs:
 *   orders   one entry per order
 *   stock    "levels": { pieceId: number left }  (only pieces whose stock is counted)
 *            "holds":  { orderId: { until, lines } }  pieces held while a card payment is open
 *   shop     "codes":  { CODE: { kind, value, minSubtotal, expires, maxUses, uses, active } }
 *            "telegram": { chats: [{ id, name }] }
 *   reviews  one entry per review sent from the site, waiting for approval
 *
 * Optional environment variables (Netlify → Environment variables, Functions, secret):
 *   STRIPE_SECRET_KEY    card payments (and "Accept card payments" ticked in the Studio)
 *   TELEGRAM_BOT_TOKEN   new-order alerts to the phones connected in Studio → Shop
 *   RESEND_API_KEY, ORDER_EMAIL_FROM   order emails to customers
 */
import { getStore } from "@netlify/blobs";
import { BASE, BRANCH, env, github } from "./studio.mjs";
import { esc, money, priceNumber, rentNumber } from "../../shared/render.mjs";

export const SITE = "https://sharifadornment.com/";
export const STATUSES = ["new", "confirmed", "shipped", "delivered", "cancelled"];
export const STATUS_NAMES = { new: "Placed", confirmed: "Confirmed", shipped: "On its way", delivered: "Delivered", cancelled: "Cancelled" };
const HOLD_MINUTES = 35; // Stripe keeps a checkout open at least 30 minutes

const store = (name) => getStore({ name, consistency: "strong" });
export const orders = () => store("orders");
const stockStore = () => store("stock");
export const shopStore = () => store("shop");
export const reviews = () => store("reviews");

class Bad extends Error {}
export { Bad };

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

/* ---------- Small helpers ---------- */
export const amount = (v) => {
  const n = Number(String(v ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
};
const round = (n) => Math.round(n * 100 + 1e-7) / 100;
export const dollars = (n) => `$${Number(n).toFixed(2).replace(/\.00$/, "")}`;
export const cardsOn = (site) => Boolean(site.checkout?.cardPayments && env("STRIPE_SECRET_KEY"));
const nyDate = () => new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });

export function newId() {
  const d = nyDate().replace(/-/g, "").slice(2);
  const r = crypto.getRandomValues(new Uint8Array(3));
  return `SA-${d}-${[...r].map((b) => b.toString(36).padStart(2, "0")).join("").toUpperCase().slice(0, 4)}`;
}
export const newToken = () => Buffer.from(crypto.getRandomValues(new Uint8Array(18))).toString("base64url");
export const trackUrl = (o) => `${SITE}order-done.html?o=${o.id}&t=${o.token}`;
export const reviewUrl = (o) => `${SITE}review.html?o=${o.id}&t=${o.token}`;

/** Read-modify-write a blob safely when two requests arrive at once */
async function update(st, key, fn, empty = {}) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const found = await st.getWithMetadata(key, { type: "json" });
    const data = found?.data ?? structuredClone(empty);
    const result = await fn(data);
    const { modified } = await st.setJSON(key, data, found ? { onlyIfMatch: found.etag } : { onlyIfNew: true });
    if (modified) return result;
    await new Promise((r) => setTimeout(r, 15 + Math.random() * 50));
  }
  throw new Error("The shop is busy. Please try again.");
}

/* ---------- Delivery choices ---------- */
export function deliveryMethods(site) {
  const d = site.checkout?.delivery || {};
  const legacy = { on: true, label: "Delivery", fee: site.checkout?.deliveryFee, freeOver: site.checkout?.freeDeliveryOver };
  const list = [
    ["local", d.local || legacy, "Local delivery"],
    ["ship", d.ship, "Shipping in the US"],
    ["pickup", d.pickup, "Pickup / meet-up"],
  ].filter(([, o]) => o?.on).map(([id, o, label]) => ({
    id, label: o.label || label, note: o.note || "",
    fee: id === "pickup" ? 0 : amount(o.fee), freeOver: id === "pickup" ? 0 : amount(o.freeOver),
    feeSet: id === "pickup" || Boolean(amount(o.fee)) || String(o.fee || "").trim() === "0",
  }));
  return list.length ? list : [{ id: "local", label: "Delivery", note: "", fee: 0, freeOver: 0, feeSet: false }];
}

/* ---------- Live stock ---------- */
export async function stockLevels() {
  await expireHolds();
  return (await stockStore().get("levels", { type: "json" })) || {};
}
export async function setStock(changes) {
  return update(stockStore(), "levels", (levels) => {
    for (const [id, n] of Object.entries(changes)) {
      if (n === null || n === "") delete levels[id];
      else levels[id] = Math.max(0, Math.floor(Number(n) || 0));
    }
    return levels;
  });
}
/** Read-modify-write one order safely; fn returns NO_WRITE to leave it as it is */
const NO_WRITE = Symbol("no write");
export async function changeOrder(id, fn) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const found = await orders().getWithMetadata(id, { type: "json" });
    if (!found?.data) return null;
    const order = found.data;
    const result = await fn(order);
    if (result === NO_WRITE) return { order, wrote: false };
    const { modified } = await orders().setJSON(id, order, { onlyIfMatch: found.etag });
    if (modified) return { order, wrote: true, result };
    await new Promise((r) => setTimeout(r, 15 + Math.random() * 50));
  }
  throw new Error("The shop is busy. Please try again.");
}

/** Take counted pieces out of stock; false (and nothing taken) if any has run out.
 *  Marks the lines it took from, so only those are ever put back. */
export async function takeStock(lines) {
  const buys = lines.filter((l) => l.kind === "buy");
  return update(stockStore(), "levels", (levels) => {
    for (const l of buys) delete l.counted;
    for (const l of buys) if (Object.hasOwn(levels, l.id) && levels[l.id] < l.qty) return false;
    for (const l of buys) if (Object.hasOwn(levels, l.id)) { levels[l.id] -= l.qty; l.counted = true; }
    return true;
  });
}
async function giveBackStock(lines) {
  const buys = lines.filter((l) => l.kind === "buy" && l.counted);
  if (!buys.length) return;
  await update(stockStore(), "levels", (levels) => {
    for (const l of buys) if (Object.hasOwn(levels, l.id)) levels[l.id] += l.qty;
  });
}
const addHold = (order) => update(stockStore(), "holds", (holds) => {
  holds[order.id] = { until: Date.now() + HOLD_MINUTES * 60e3 };
});
const dropHold = (id) => update(stockStore(), "holds", (holds) => { delete holds[id]; });

/** Cancel an order and put its pieces (and code use) back, exactly once even if asked twice at the same moment */
export async function cancelOrder(id, note = "") {
  const res = await changeOrder(id, (o) => {
    const first = !o.restocked;
    o.status = "cancelled";
    (o.times ||= {}).cancelled ||= new Date().toISOString();
    if (note && first) o.note = [o.note, note].filter(Boolean).join("\n");
    if (!first) return NO_WRITE;
    o.restocked = true;
    const code = o.code && !o.codeReleased ? o.code : "";
    o.codeReleased = Boolean(o.code);
    return { lines: o.lines, code };
  });
  if (!res?.wrote) return res?.order || null;
  await giveBackStock(res.result.lines);
  if (res.result.code) await releaseCodeUse(res.result.code);
  await dropHold(id);
  return res.order;
}

/** Card checkouts left unpaid past the hold time: cancel them and free the pieces */
export async function expireHolds() {
  const holds = (await stockStore().get("holds", { type: "json" })) || {};
  const due = Object.entries(holds).filter(([, h]) => h.until < Date.now()).map(([id]) => id);
  for (const id of due) {
    const order = await orders().get(id, { type: "json" });
    if (!order) { await dropHold(id); continue; }
    const { order: now, checked } = await refreshPayment(order);
    if (!checked) continue; // couldn't ask Stripe: keep holding, try again later
    if (now.amountPaid > 0) { await dropHold(id); continue; }
    // Only the request that removes the hold goes on to cancel
    const mine = await update(stockStore(), "holds", (h) => { if (!h[id]) return false; delete h[id]; return true; });
    if (mine) await cancelOrder(id, "Card payment wasn't completed, so the pieces were put back.");
  }
}

/* ---------- Discount codes ---------- */
export const normCode = (c) => String(c || "").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 24);
async function findCode(code) {
  if (!code) return null;
  const codes = (await shopStore().get("codes", { type: "json" })) || {};
  return codes[code] || null;
}
function codeProblem(c, subtotal) {
  if (!c || c.active === false) return "That code isn't valid.";
  if (c.expires && c.expires < nyDate()) return "That code has expired.";
  if (c.maxUses && (c.uses || 0) >= c.maxUses) return "That code has been fully used.";
  if (c.minSubtotal && subtotal < c.minSubtotal) return `That code needs an order of ${dollars(c.minSubtotal)} or more.`;
  return "";
}

/** Count one use of a code, refusing if it's no longer valid or fully used (safe when orders arrive together) */
export async function claimCodeUse(code, subtotal) {
  return update(shopStore(), "codes", (codes) => {
    const problem = codeProblem(codes[code], subtotal);
    if (problem) return problem;
    codes[code].uses = (codes[code].uses || 0) + 1;
    return "";
  });
}
export async function releaseCodeUse(code) {
  await update(shopStore(), "codes", (codes) => { if (codes[code]) codes[code].uses = Math.max(0, (codes[code].uses || 0) - 1); });
}

/* ---------- Pricing: one place that works out every total ---------- */
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
export async function quote({ wanted = [], code = "", method = "", pay = "" } = {}) {
  const { site, items } = await catalogue();
  const levels = await stockLevels();
  const c = site.checkout || {};
  const lines = [], problems = [];
  for (const w of (Array.isArray(wanted) ? wanted : []).slice(0, 30)) {
    const id = String(w?.id || "");
    const it = ID.test(id) && items.find((x) => x.id === id);
    if (!it) { problems.push("A piece in your bag is no longer on the site, so it was removed."); continue; }
    if (w.kind === "rent") {
      const price = rentNumber(it);
      const real = /^\d{4}-\d{2}-\d{2}$/.test(w.date) && !Number.isNaN(Date.parse(`${w.date}T12:00:00Z`)) && new Date(`${w.date}T12:00:00Z`).toISOString().slice(0, 10) === w.date;
      const date = real && w.date >= nyDate() ? w.date : "";
      if (price == null) { problems.push(`The ${it.name} can't be rented online. Please message us about it.`); continue; }
      if (!date) { problems.push(`Please pick an event date for renting the ${it.name}.`); continue; }
      if (lines.some((l) => l.kind === "rent" && l.id === id && l.date === date)) continue;
      lines.push({ key: `${id}:rent:${date}`, id, kind: "rent", date, name: it.name, price, qty: 1, image: it.image || "" });
      continue;
    }
    const price = priceNumber(it);
    const left = Object.hasOwn(levels, id) ? levels[id] : Infinity;
    if (it.soldOut || left <= 0) { problems.push(`Sorry, the ${it.name} is sold out.`); continue; }
    if (price == null) { problems.push(`The ${it.name} is priced on request. Please message us about it.`); continue; }
    const asked = Math.min(1e6, Math.max(1, Math.floor(Number(w.qty) || 1)));
    const qty = Math.min(5, left, asked);
    if (qty < asked) problems.push(left < asked && left < 5 ? `Only ${left} of the ${it.name} left, so your bag was updated.` : `You can order up to 5 of the ${it.name} at a time, so your bag was updated.`);
    if (lines.some((l) => l.kind === "buy" && l.id === id)) continue;
    lines.push({ key: id, id, kind: "buy", name: it.name, price, qty, image: it.image || "", left: Number.isFinite(left) ? left : null });
  }
  const subtotal = round(lines.reduce((s, l) => s + l.price * l.qty, 0));

  // Discount code
  let discount = 0, codeError = "", codeUsed = "";
  const cc = normCode(code);
  if (cc) {
    const found = await findCode(cc);
    codeError = codeProblem(found, subtotal);
    if (!codeError) {
      discount = found.kind === "percent" ? round(subtotal * Math.min(100, found.value) / 100) : Math.min(subtotal, amount(found.value));
      codeUsed = cc;
    }
  }

  // Delivery
  const methods = deliveryMethods(site);
  const m = methods.find((x) => x.id === method) || methods[0];
  const after = subtotal - discount;
  const delivery = m.freeOver && after >= m.freeOver ? 0 : m.fee;

  // Rental deposits (refundable), sales tax
  const rentals = lines.filter((l) => l.kind === "rent").length;
  const rentDeposit = round(rentals * amount(c.rentDeposit));
  // A percentage like 8.875 keeps all its decimals (amounts of money are rounded to cents)
  const taxRate = Math.min(20, Math.max(0, Number(String(c.taxRate ?? "").replace(/[^\d.]/g, "")) || 0));
  const tax = taxRate ? Math.round((after + delivery) * taxRate + 1e-7) / 100 : 0;
  const total = round(after + delivery + tax + rentDeposit);

  // Payment choices
  const cards = cardsOn(site);
  const depPct = Math.min(90, amount(c.deposit?.percent));
  const depositAmount = cards && depPct && total >= amount(c.deposit?.over) ? round(total * depPct / 100) : 0;
  // Stripe can't take less than 50¢, so tiny or free orders are always "pay after we confirm"
  const pays = total >= 0.5 ? [cards && "card", depositAmount && "deposit", "later"].filter(Boolean) : ["later"];
  const payChoice = pays.includes(pay) ? pay : pays[0];

  return {
    site, lines, problems, subtotal, discount, code: codeUsed, codeError,
    methods: methods.map(({ id, label, note, fee, freeOver, feeSet }) => ({ id, label, note, fee, freeOver, feeSet })),
    method: m.id, methodLabel: m.label, deliveryKnown: m.feeSet || Boolean(m.freeOver && after >= m.freeOver),
    delivery, taxRate, taxLabel: c.taxLabel || "Sales tax", tax, rentDeposit, total,
    pays, pay: payChoice, depositPercent: depPct, depositAmount, payMethods: c.payMethods || "Zelle, Cash App or PayPal",
  };
}
/** The quote without anything the browser doesn't need */
export const publicQuote = ({ site, ...q }) => ({ ...q, lines: q.lines.map(({ left, ...l }) => l) });

/* ---------- Placing an order ---------- */
const text = (v, max) => String(v ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, max);
export async function place(body) {
  if (body.website) throw new Bad("Bad request."); // a field only bots fill in
  const c = body.customer || {};
  const customer = {
    name: text(c.name, 80), phone: text(c.phone, 30), email: text(c.email, 120),
    address: text(c.address, 160), city: text(c.city, 60), state: text(c.state, 30), zip: text(c.zip, 12),
    notes: text(c.notes, 600),
  };
  if (!customer.name) throw new Bad("Please add your name.");
  if (customer.phone.replace(/\D/g, "").length < 10) throw new Bad("Please add a phone number we can text.");
  if (customer.email && !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(customer.email)) throw new Bad("That email address doesn't look right.");

  const q = await quote({ wanted: body.items, code: body.code, method: body.method, pay: body.pay });
  if (q.problems.length) throw new Bad(q.problems[0]);
  if (!q.lines.length) throw new Bad("Your bag is empty.");
  if (body.code && q.codeError) throw new Bad(q.codeError);
  if (q.method !== "pickup" && (!customer.address || !customer.city || !customer.zip)) throw new Bad("Please add the delivery address.");
  if (body.pay && body.pay !== q.pay) throw new Bad("That way of paying isn't available for this order. Please choose another.");

  const order = {
    id: newId(), token: newToken(), created: new Date().toISOString(), status: "new",
    pay: q.pay, paid: false, amountPaid: 0, customer,
    lines: q.lines.map(({ left, ...l }) => l),
    subtotal: q.subtotal, discount: q.discount, code: q.code,
    method: q.method, methodLabel: q.methodLabel, delivery: q.delivery, deliveryKnown: q.deliveryKnown,
    taxRate: q.taxRate, tax: q.tax, rentDeposit: q.rentDeposit, total: q.total,
    due: q.pay === "deposit" ? q.depositAmount : q.total, note: "", times: { new: new Date().toISOString() },
  };
  const st = orders();
  while (await st.get(order.id)) order.id = newId();
  if (order.code) {
    const problem = await claimCodeUse(order.code, order.subtotal);
    if (problem) throw new Bad(problem);
  }
  if (!(await takeStock(order.lines))) {
    if (order.code) await releaseCodeUse(order.code);
    throw new Bad("Sorry, one of your pieces just sold out. Please check your bag.");
  }
  try {
    if (order.pay !== "later") {
      await addHold(order);
      const s = await startCardPayment(order);
      order.stripeSession = s.id;
      order.payUrl = s.url;
    }
    await st.setJSON(order.id, order);
  } catch (x) {
    await giveBackStock(order.lines);
    if (order.code) await releaseCodeUse(order.code);
    await dropHold(order.id);
    throw x;
  }
  await afterStock(order);
  await alert(orderAlert(order, order.pay === "later" ? "🛍 New order" : "🛍 New order — waiting for card payment"));
  if (order.pay === "later") await emailCustomer(order, "placed", q.site);
  return order;
}

/** Tell the admin when a counted piece has just run out */
async function afterStock(order) {
  const levels = (await stockStore().get("levels", { type: "json" })) || {};
  const out = order.lines.filter((l) => l.kind === "buy" && levels[l.id] === 0);
  if (out.length) await alert(`📦 Now out of stock: ${out.map((l) => l.name).join(", ")}`);
}

/* ---------- What a customer may see of their own order ---------- */
export function publicView(o, site) {
  return {
    id: o.id, created: o.created, status: o.status, statusName: STATUS_NAMES[o.status] || o.status, times: o.times || {},
    pay: o.pay, paid: o.paid, amountPaid: o.amountPaid || 0, due: o.due,
    lines: o.lines, subtotal: o.subtotal, discount: o.discount || 0, code: o.code || "",
    methodLabel: o.methodLabel || "Delivery", delivery: o.delivery, deliveryKnown: o.deliveryKnown !== false,
    tax: o.tax || 0, taxLabel: site?.checkout?.taxLabel || "Sales tax", rentDeposit: o.rentDeposit || 0, total: o.total,
    tracking: o.tracking || null, name: o.customer.name,
    payLater: site?.checkout?.payLater || "", payUrl: !o.amountPaid && o.status === "new" ? o.payUrl || "" : "",
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
    success_url: trackUrl(order),
    cancel_url: `${SITE}checkout.html?cancelled=${order.id}&t=${order.token}`,
    client_reference_id: order.id,
    "metadata[order]": order.id,
    "payment_intent_data[description]": `Sharif Adornment order ${order.id}`,
    expires_at: String(Math.floor(Date.now() / 1000) + 31 * 60),
  };
  if (order.customer.email) form.customer_email = order.customer.email;
  // Itemised when it adds up exactly; otherwise (code, deposit) one line for the amount due
  const itemised = order.pay === "card" && !order.discount;
  const lines = itemised
    ? [
      ...order.lines.map((l) => ({ name: l.kind === "rent" ? `${l.name} (rental for ${l.date})` : l.name, cents: Math.round(l.price * 100), qty: l.qty, image: l.image })),
      order.delivery && { name: order.methodLabel || "Delivery", cents: Math.round(order.delivery * 100), qty: 1 },
      order.rentDeposit && { name: "Refundable rental deposit", cents: Math.round(order.rentDeposit * 100), qty: 1 },
      order.tax && { name: "Sales tax", cents: Math.round(order.tax * 100), qty: 1 },
    ].filter(Boolean)
    : [{ name: order.pay === "deposit" ? `Deposit for order ${order.id}` : `Order ${order.id}${order.code ? ` (code ${order.code})` : ""}`, cents: Math.round(order.due * 100), qty: 1 }];
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

/** Ask Stripe whether a card order has been paid yet. Records the payment exactly once (with
 *  one alert and one email) without overwriting anything else on the order.
 *  Returns { order, checked }: checked is false when Stripe couldn't be asked. */
export async function refreshPayment(order) {
  if (order.pay === "later" || order.amountPaid || !order.stripeSession) return { order, checked: true };
  if (!env("STRIPE_SECRET_KEY")) return { order, checked: true }; // card payments are switched off
  let s;
  try { s = await stripe(`checkout/sessions/${encodeURIComponent(order.stripeSession)}`); } catch { return { order, checked: false }; }
  if (s.payment_status !== "paid") return { order, checked: true };
  // Stripe reports the amount in cents; fall back to what was due if it's missing
  const paid = round((s.amount_total > 0 ? s.amount_total : Math.round(order.due * 100)) / 100);
  const res = await changeOrder(order.id, (o) => {
    if (o.amountPaid) return NO_WRITE;
    o.amountPaid = paid;
    o.cardPaid = paid; // what came in by card, kept if the rest is later marked paid by hand
    o.paid = paid >= o.total - 0.005;
    o.paidAt = new Date().toISOString();
    o.payUrl = "";
  });
  if (!res) return { order, checked: true };
  if (!res.wrote) return { order: res.order, checked: true };
  const o = res.order;
  await dropHold(o.id);
  if (o.status === "cancelled") {
    await alert(`⚠️ Payment came in for cancelled order ${o.id} (${o.customer.name}, ${dollars(paid)}). Its pieces were put back in stock: re-open the order in the Studio, or refund it in Stripe.`);
  } else {
    await alert(`✅ ${o.paid ? "Paid" : `Deposit paid (${dollars(paid)})`}: order ${o.id}, ${o.customer.name}, ${dollars(paid)} by card`);
    const { site } = await catalogue();
    await emailCustomer(o, "placed", site);
  }
  return { order: o, checked: true };
}

/* ---------- Telegram alerts ---------- */
export async function telegram(method, params) {
  const token = env("TELEGRAM_BOT_TOKEN");
  if (!token) throw new Bad("Add TELEGRAM_BOT_TOKEN on Netlify first (see the README).");
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(params || {}),
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Bad(data.description || "Telegram didn't accept that.");
  return data.result;
}
export async function alert(message) {
  if (!env("TELEGRAM_BOT_TOKEN")) return;
  try {
    const { chats = [] } = (await shopStore().get("telegram", { type: "json" })) || {};
    await Promise.all(chats.map((c) => telegram("sendMessage", { chat_id: c.id, text: message, disable_web_page_preview: true }).catch(() => {})));
  } catch { /* alerts must never stop an order */ }
}
export function orderAlert(o, title) {
  const c = o.customer;
  return [
    `${title}: ${o.id}`,
    `${c.name} · ${c.phone}`,
    ...o.lines.map((l) => `• ${l.name}${l.kind === "rent" ? ` (rent, ${l.date})` : ""}${l.qty > 1 ? ` × ${l.qty}` : ""} — ${dollars(l.price * l.qty)}`),
    `${o.methodLabel}${o.method === "pickup" ? "" : `: ${[c.address, c.city, c.zip].filter(Boolean).join(", ")}`}`,
    `Total ${dollars(o.total)}${o.code ? ` (code ${o.code})` : ""} · ${o.pay === "later" ? "pay after confirming" : o.pay === "deposit" ? "deposit by card" : "card"}`,
    c.notes ? `Note: ${c.notes}` : "",
    `${SITE}studio/`,
  ].filter(Boolean).join("\n");
}

/* ---------- Emails to customers (only when Resend is set up) ---------- */
export async function emailCustomer(o, kind, site) {
  if (!o.customer.email || !env("RESEND_API_KEY") || !env("ORDER_EMAIL_FROM")) return;
  const first = o.customer.name.split(" ")[0];
  const rows = o.lines.map((l) => `<tr><td style="padding:6px 0">${esc(l.name)}${l.kind === "rent" ? ` <small>(rental, ${esc(l.date)})</small>` : ""}${l.qty > 1 ? ` × ${l.qty}` : ""}</td><td align="right">${dollars(l.price * l.qty)}</td></tr>`).join("");
  const subjects = { placed: `Your order ${o.id}`, shipped: `Your order ${o.id} is on its way`, delivered: `Your order ${o.id} was delivered` };
  const intro = {
    placed: o.amountPaid >= o.total - 0.005 ? "Thank you — your payment came through and we're getting your order ready."
      : o.amountPaid ? `Thank you — your deposit of ${dollars(o.amountPaid)} came through. The balance of ${dollars(o.total - o.amountPaid)} is due once we confirm your order.`
      : (site?.checkout?.thanks || "We've got your order and will text you shortly to confirm it."),
    shipped: `Good news — your order is on its way.${o.tracking?.number ? ` Tracking: ${o.tracking.carrier || ""} ${o.tracking.number}` : ""}`,
    delivered: "Your order was delivered. We hope you love it!",
  }[kind];
  const html = `<div style="font-family:Georgia,serif;color:#1b1917;max-width:520px">
    <p style="font-size:22px">Hi ${esc(first)},</p><p>${esc(intro)}</p>
    <table width="100%" style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">${rows}
      <tr><td style="border-top:1px solid #ddd;padding-top:8px"><b>Total</b></td><td align="right" style="border-top:1px solid #ddd;padding-top:8px"><b>${dollars(o.total)}</b></td></tr></table>
    ${kind === "placed" && o.amountPaid < o.total - 0.005 && site?.checkout?.payLater ? `<p style="font-family:Arial,sans-serif;font-size:14px"><b>How to pay</b><br>${esc(site.checkout.payLater).replace(/\n/g, "<br>")}<br>Please add ${o.id} to the payment note.</p>` : ""}
    <p><a href="${trackUrl(o)}" style="color:#7d5f33">See your order</a></p><p>— Sharif Adornment</p></div>`;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from: env("ORDER_EMAIL_FROM"), to: [o.customer.email], subject: subjects[kind], html }),
    });
  } catch { /* emails must never stop an order */ }
}

export { money };
