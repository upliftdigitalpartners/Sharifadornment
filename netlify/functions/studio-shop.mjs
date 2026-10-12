/* POST /api/studio/shop  (Authorization: Bearer <session>)
 * Everything in the Studio's Shop tab, plus stock counts and reviews waiting for approval:
 *   { codes: "list" } | { codes: { set: {code, kind, value, minSubtotal, expires, maxUses, active} } } | { codes: { remove: CODE } }
 *   { telegram: "status" | "find" | "test" } | { telegram: { add: { id, name } } } | { telegram: { remove: id } }
 *   { stock: "get" } | { stock: { set: { pieceId: number | null } } }
 *   { reviews: "list" } | { reviews: { remove: orderId } }
 */
import { checkSession, configured, cors, env, json } from "../lib/studio.mjs";
import { Bad, alert, normCode, reviews, setStock, shopStore, stockLevels, telegram } from "../lib/orders.mjs";

const num = (v) => { const n = Number(String(v ?? "").replace(/[^\d.]/g, "")); return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0; };

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (!configured()) return json(req, { error: "The Studio isn't set up yet." }, 503);
  if (!(await checkSession(req))) return json(req, { error: "Please sign in again." }, 401);
  let b = {};
  try { b = await req.json(); } catch { /* empty */ }
  const shop = shopStore();

  try {
    /* Discount codes */
    if (b.codes) {
      const codes = (await shop.get("codes", { type: "json" })) || {};
      if (b.codes.set) {
        const s = b.codes.set, code = normCode(s.code);
        if (code.length < 3) throw new Bad("Codes need at least 3 letters or numbers.");
        const value = num(s.value);
        if (!value) throw new Bad("Add how much the code takes off.");
        if (s.kind === "percent" && value > 90) throw new Bad("Percent codes can take off up to 90%.");
        codes[code] = {
          kind: s.kind === "percent" ? "percent" : "amount", value, minSubtotal: num(s.minSubtotal),
          expires: /^\d{4}-\d{2}-\d{2}$/.test(s.expires || "") ? s.expires : "",
          maxUses: Math.floor(num(s.maxUses)), uses: codes[code]?.uses || 0, active: s.active !== false,
        };
      }
      if (b.codes.remove) delete codes[normCode(b.codes.remove)];
      if (b.codes.set || b.codes.remove) await shop.setJSON("codes", codes);
      return json(req, { codes });
    }

    /* Telegram alerts */
    if (b.telegram) {
      const t = (await shop.get("telegram", { type: "json" })) || { chats: [] };
      if (b.telegram === "find") {
        // Chats that recently messaged the bot, so the admin can pick theirs
        const updates = await telegram("getUpdates", { limit: 50 });
        const seen = new Map();
        for (const u of updates) {
          const c = (u.message || u.channel_post || u.my_chat_member)?.chat;
          if (c) seen.set(String(c.id), { id: String(c.id), name: c.title || [c.first_name, c.last_name].filter(Boolean).join(" ") || c.username || "Chat" });
        }
        return json(req, { configured: true, chats: t.chats, found: [...seen.values()] });
      }
      if (b.telegram.add) {
        const { id, name } = b.telegram.add;
        if (!/^-?\d{1,20}$/.test(String(id))) throw new Bad("That chat can't be added.");
        if (!t.chats.some((c) => c.id === String(id))) t.chats.push({ id: String(id), name: String(name || "Chat").slice(0, 60) });
        await shop.setJSON("telegram", t);
        await telegram("sendMessage", { chat_id: String(id), text: "✨ Sharif Adornment: new orders will be sent here." }).catch(() => {});
      }
      if (b.telegram.remove) { t.chats = t.chats.filter((c) => c.id !== String(b.telegram.remove)); await shop.setJSON("telegram", t); }
      if (b.telegram === "test") {
        if (!t.chats.length) throw new Bad("Connect a phone first.");
        await alert("🔔 Test alert from the Sharif Adornment Studio. Alerts are working.");
      }
      return json(req, { configured: Boolean(env("TELEGRAM_BOT_TOKEN")), chats: t.chats });
    }

    /* Stock counts */
    if (b.stock) {
      if (b.stock.set) {
        const changes = {};
        for (const [id, n] of Object.entries(b.stock.set)) {
          if (!/^[a-z0-9][a-z0-9-]{0,63}$/.test(id)) continue;
          changes[id] = n === null || n === "" ? null : Math.min(9999, Math.max(0, Math.floor(Number(n) || 0)));
        }
        await setStock(changes);
      }
      return json(req, { stock: await stockLevels() });
    }

    /* Reviews waiting for approval */
    if (b.reviews) {
      const st = reviews();
      if (b.reviews.remove) await st.delete(String(b.reviews.remove));
      const { blobs } = await st.list();
      const list = (await Promise.all(blobs.map((x) => st.get(x.key, { type: "json" })))).filter(Boolean)
        .sort((a, c) => c.date.localeCompare(a.date));
      return json(req, { reviews: list });
    }
    throw new Bad("Bad request.");
  } catch (x) {
    if (x instanceof Bad) return json(req, { error: x.message }, 400);
    console.error(x);
    return json(req, { error: "Something went wrong." }, 502);
  }
};

export const config = {
  path: "/api/studio/shop",
  method: ["POST", "OPTIONS"],
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 90 },
};
