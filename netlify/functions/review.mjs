/* POST /api/review { id, token, rating, text, name }
 * A customer's review of a delivered order, from the link in their order. It waits in
 * the Studio (Reviews → Waiting for approval) until approved; nothing goes on the site
 * by itself. */
import { cors, json } from "../lib/studio.mjs";
import { alert, orders, reviews } from "../lib/orders.mjs";

const ORDER_ID = /^SA-\d{6}-[A-Z0-9]{4}$/;
const text = (v, max) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").trim().slice(0, max);

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  let b;
  try { b = await req.json(); } catch { return json(req, { error: "Bad request." }, 400); }
  if (!b || typeof b !== "object") return json(req, { error: "Bad request." }, 400);
  if (!ORDER_ID.test(String(b.id)) || typeof b.token !== "string") return json(req, { error: "Order not found." }, 404);
  const order = await orders().get(b.id, { type: "json" });
  if (!order || order.token !== b.token) return json(req, { error: "Order not found." }, 404);

  const review = {
    id: order.id, date: new Date().toISOString(),
    rating: Math.min(5, Math.max(1, Math.round(Number(b.rating) || 5))),
    text: text(b.text, 1200), name: text(b.name, 60) || order.customer.name.split(" ")[0],
    pieces: order.lines.map((l) => l.name),
  };
  if (review.text.length < 3) return json(req, { error: "Please write a few words." }, 400);
  await reviews().setJSON(order.id, review); // one review per order; sending again replaces it
  await alert(`⭐ New review (${"★".repeat(review.rating)}) from ${review.name}: “${review.text.slice(0, 200)}”\nApprove it in Studio → Reviews.`);
  return json(req, { ok: true });
};

export const config = {
  path: "/api/review",
  method: ["POST", "OPTIONS"],
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 10 },
};
