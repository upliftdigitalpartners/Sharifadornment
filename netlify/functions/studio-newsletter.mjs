/* POST /api/studio/newsletter  (Authorization: Bearer <session>)
 *   {}                                                        → { ready, count, sent: [{ date, subject, to }] }
 *   { send: { subject, message, pieces: [id], test: "me@…" } } → sends one test email
 *   { send: { subject, message, pieces: [id] } }               → sends to every subscriber
 *
 * Needs RESEND_API_KEY and ORDER_EMAIL_FROM (the same ones order emails use). Every
 * email ends with the shop's location and a one-click unsubscribe link. */
import { getStore } from "@netlify/blobs";
import { checkSession, configured, cors, env, json, sign } from "../lib/studio.mjs";
import { SITE, catalogue, shopStore } from "../lib/orders.mjs";
import { esc, priceLine, pieceUrl, shareImg } from "../../shared/render.mjs";

const API_BASE = "https://sharif-adornment-studio.netlify.app/api";
const EMAIL = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-z]{2,24}$/i;
const clip = (v, n) => String(v ?? "").replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ").trim().slice(0, n);

async function emailHTML({ message, pieces, site }, email) {
  const unsub = `${API_BASE}/unsubscribe?e=${encodeURIComponent(email)}&t=${await sign(`unsubscribe:${email}`)}`;
  const paras = message.split(/\n\s*\n/).map((p) => `<p style="margin:0 0 16px">${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
  const cards = pieces.map((it) => `<tr><td style="padding:0 0 28px">
    <a href="${SITE}${pieceUrl(it)}" style="color:#1b1917;text-decoration:none">
      <img src="${SITE}${esc(shareImg(it.image))}" alt="${esc(it.name)}" width="520" style="display:block;width:100%;max-width:520px;height:auto;border:0" />
      <span style="display:block;font-size:20px;margin-top:10px">${esc(it.name)}</span>
      <span style="display:block;font-family:Arial,sans-serif;font-size:14px;color:#6e6860">${esc(it.soldOut ? "Sold out" : priceLine(it))}</span>
    </a></td></tr>`).join("");
  return { unsub, html: `<div style="background:#f6f3ee;padding:24px 12px"><div style="font-family:Georgia,serif;color:#1b1917;font-size:17px;line-height:1.6;max-width:520px;margin:0 auto">
    <p style="font-size:22px;letter-spacing:.12em;margin:0 0 24px"><a href="${SITE}" style="color:#1b1917;text-decoration:none">SHARIF <i style="letter-spacing:0;color:#9c7a45">Adornment</i></a></p>
    ${paras}
    ${cards ? `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:8px">${cards}</table>` : ""}
    <p style="margin:8px 0 32px"><a href="${SITE}collections.html" style="display:inline-block;background:#1b1917;color:#ffffff;padding:13px 24px;text-decoration:none;font-family:Arial,sans-serif;font-size:14px;letter-spacing:.06em">SEE THE COLLECTION</a></p>
    <p style="font-family:Arial,sans-serif;font-size:12px;color:#6e6860;border-top:1px solid #ddd6c9;padding-top:16px">Sharif Adornment${site.business?.location ? ` · ${esc(site.business.location)}` : ""}<br>
    You're getting this because you signed up at sharifadornment.com. <a href="${unsub}" style="color:#6e6860">Unsubscribe</a></p>
  </div></div>` };
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (!configured()) return json(req, { error: "The Studio isn't set up yet." }, 503);
  if (!(await checkSession(req))) return json(req, { error: "Please sign in again." }, 401);
  let b = {};
  try { b = (await req.json()) || {}; } catch { /* empty */ }

  const ready = Boolean(env("RESEND_API_KEY") && env("ORDER_EMAIL_FROM"));
  const subs = getStore("subscribers");
  const shop = shopStore();
  const log = (await shop.get("newsletters", { type: "json" })) || [];
  const list = async () => (await Promise.all((await subs.list()).blobs.map((x) => subs.get(x.key, { type: "json" })))).filter((s) => s && EMAIL.test(s.email || ""));

  if (!b.send) return json(req, { ready, count: (await list()).length, sent: log });
  if (!ready) return json(req, { error: "Emails aren't set up yet. Add RESEND_API_KEY and ORDER_EMAIL_FROM on Netlify (see the README)." }, 400);

  const subject = clip(b.send.subject, 120), message = clip(b.send.message, 4000);
  if (subject.length < 3) return json(req, { error: "Add a subject." }, 400);
  if (message.length < 10) return json(req, { error: "Write a short message first." }, 400);
  const { site, items } = await catalogue();
  const pieces = (Array.isArray(b.send.pieces) ? b.send.pieces : []).slice(0, 6).map((id) => items.find((x) => x.id === id)).filter((x) => x?.image);

  const test = b.send.test != null;
  const to = test ? [clip(b.send.test, 200).toLowerCase()] : (await list()).map((s) => s.email.toLowerCase());
  if (test && !EMAIL.test(to[0])) return json(req, { error: "That email address doesn't look right." }, 400);
  if (!to.length) return json(req, { error: "Nobody has signed up yet." }, 400);
  // The same newsletter can't go out twice by accident (a double tap, or a retry)
  if (!test && log[0] && log[0].subject === subject && Date.now() - Date.parse(log[0].date) < 10 * 60e3) {
    return json(req, { error: "That newsletter was sent a few minutes ago. Change the subject to send another." }, 409);
  }

  let sent = 0, problem = "";
  for (let i = 0; i < to.length; i += 100) {
    const batch = await Promise.all(to.slice(i, i + 100).map(async (email) => {
      const { html, unsub } = await emailHTML({ message, pieces, site }, email);
      return { from: env("ORDER_EMAIL_FROM"), to: [email], subject: test ? `[Test] ${subject}` : subject, html, headers: { "List-Unsubscribe": `<${unsub}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } };
    }));
    try {
      const res = await fetch("https://api.resend.com/emails/batch", {
        method: "POST", headers: { Authorization: `Bearer ${env("RESEND_API_KEY")}`, "Content-Type": "application/json" }, body: JSON.stringify(batch),
      });
      if (!res.ok) { problem = (await res.json().catch(() => ({}))).message || `Resend said ${res.status}`; break; }
      sent += batch.length;
    } catch { problem = "Couldn't reach the email service."; break; }
  }
  if (!test && sent) {
    log.unshift({ date: new Date().toISOString(), subject, to: sent });
    await shop.setJSON("newsletters", log.slice(0, 20));
  }
  if (problem && !sent) return json(req, { error: `Not sent: ${problem}` }, 502);
  return json(req, { ready, count: test ? (await list()).length : to.length, sent: log.slice(0, 20), delivered: sent, problem });
};

export const config = {
  path: "/api/studio/newsletter",
  method: ["POST", "OPTIONS"],
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 20 },
};
