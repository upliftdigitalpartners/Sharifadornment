/* GET or POST /api/unsubscribe?e=<email>&t=<token>
 * The link at the bottom of every newsletter. The token proves the link came from
 * an email we sent, so nobody can remove someone else's address. */
import { getStore } from "@netlify/blobs";
import { safeEqual, sign } from "../lib/studio.mjs";

const page = (title, text) => new Response(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>${title} — Sharif Adornment</title>
<style>body{font:17px/1.6 Georgia,serif;color:#1b1917;background:#f6f3ee;max-width:460px;margin:18vh auto;padding:0 24px;text-align:center}h1{font-weight:400;font-size:34px}a{color:#7d5f33}</style></head>
<body><h1>${title}</h1><p>${text}</p><p><a href="https://sharifadornment.com/">Back to Sharif Adornment</a></p></body></html>`, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });

export default async (req) => {
  const u = new URL(req.url);
  const email = (u.searchParams.get("e") || "").trim().toLowerCase();
  const token = u.searchParams.get("t") || "";
  if (!email || !token || !(await safeEqual(token, await sign(`unsubscribe:${email}`)))) {
    return page("That link didn't work", "Please use the unsubscribe link from our latest email, or message us and we'll take you off the list.");
  }
  await getStore("subscribers").delete(email);
  return page("You're unsubscribed", "We won't email you again. Thank you for having been with us.");
};

export const config = {
  path: "/api/unsubscribe",
  method: ["GET", "POST"],
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 20 },
};
