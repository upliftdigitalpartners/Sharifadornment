/* Sharif Adornment — HTML building blocks.
 * Pure functions with no dependencies, shared by:
 *   - js/app.js (in the browser: quick view, preview mode, live re-render)
 *   - shared/pages.mjs (the full pages, built by tools/build-pages.mjs and by
 *     the Studio's publish function on Netlify)
 * so a piece looks the same wherever it's rendered. */

export const esc = (s = "") =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/** *words* become gold italics */
export const rich = (s = "") => esc(s).replace(/\*(.+?)\*/g, "<em>$1</em>");

/** Every photo has a 640px copy next to it: name.jpg -> name-sm.jpg */
export const sm = (src = "") => (/\.(jpe?g|png|webp)$/i.test(src) && !/-sm\.\w+$/.test(src) ? src.replace(/(\.\w+)$/, "-sm$1") : src);

export const isVideo = (src = "") => /\.(mp4|webm|mov)$/i.test(src);

/** A responsive <img>. If the small copy is missing, it falls back to the full photo. */
export function img(src, alt = "", { sizes = "(max-width: 680px) 50vw, 25vw", lazy = true, cls = "", attrs = "" } = {}) {
  if (!src) return "";
  return `<img${cls ? ` class="${cls}"` : ""} src="${esc(src)}" srcset="${esc(sm(src))} 640w, ${esc(src)} 1200w" sizes="${sizes}" alt="${esc(alt)}"${lazy ? ' loading="lazy"' : ""} decoding="async" onerror="this.removeAttribute('srcset');this.onerror=null"${attrs ? ` ${attrs}` : ""} />`;
}

export const pad = (n) => String(n).padStart(2, "0");

export const HEART = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 8 3.3 4.5 6.9 4.5c2.1 0 3.7 1.2 5.1 3 1.4-1.8 3-3 5.1-3 3.6 0 5.5 3.5 4.2 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>';

export const LOTUS =
  '<svg viewBox="0 0 44 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linejoin="round">' +
  '<path d="M22 2.5c3.2 4.2 3.2 9.6 0 14c-3.2-4.4-3.2-9.8 0-14z"/>' +
  '<path d="M21.6 16.5c-2-5-7-7.6-12.6-6.6c2.3 4.5 7.5 7.4 12.6 6.6z"/>' +
  '<path d="M22.4 16.5c2-5 7-7.6 12.6-6.6c-2.3 4.5-7.5 7.4-12.6 6.6z"/>' +
  '<path d="M14 20.5h16"/><circle cx="6" cy="20.5" r=".9" fill="currentColor" stroke="none"/>' +
  '<circle cx="38" cy="20.5" r=".9" fill="currentColor" stroke="none"/></svg>';

export const motif = (extra = "") => `<div class="motif${extra ? ` ${extra}` : ""}" aria-hidden="true">${LOTUS}</div>`;

export const collectionName = (site, id) => (site.collections || []).find((c) => c.id === id)?.name || "";

export const pieceUrl = (it) => `p/${encodeURIComponent(it.id)}.html`;

export function badges(it) {
  const b = [];
  if (it.soldOut) b.push('<span class="badge badge--sold">Sold out</span>');
  else if (it.lastOne) b.push('<span class="badge">Last one</span>');
  if (it.isNew) b.push('<span class="badge badge--gold">New</span>');
  if (it.rent) b.push('<span class="badge">For rent</span>');
  return b.join("");
}

/** "40" and "40$" read as "$40"; anything else is shown as typed. */
export const money = (v = "") => {
  const t = String(v).trim();
  const m = t.match(/^\$?\s*(\d[\d,]*(?:\.\d{1,2})?)\s*\$?$/);
  return m ? `$${m[1]}` : t;
};

export function priceLine(it) {
  const buy = money(it.price) || "Price on request";
  return it.rent && it.rentPrice ? `${buy} · Rent ${money(it.rentPrice)}` : buy;
}

/** A piece in a grid. The link goes to the piece's own page; on the Collections
 *  page the script opens a quick view instead. */
export function itemCard(it, site, { sizes } = {}) {
  return `<article class="item reveal${it.soldOut ? " is-sold" : ""}" data-item="${esc(it.id)}">
  <a class="item__link" href="${pieceUrl(it)}" data-open="${esc(it.id)}">
    <div class="item__img">${img(it.image, it.name, { sizes })}<div class="item__badges">${badges(it)}</div></div>
    <span class="item__col">${esc(collectionName(site, it.collection))}</span>
    <span class="item__name">${esc(it.name)}</span>
    <span class="item__price">${esc(priceLine(it))}</span>
  </a>
  <button class="heart" type="button" data-save="${esc(it.id)}" aria-pressed="false" aria-label="Save ${esc(it.name)}">${HEART}</button>
</article>`;
}

/** Collections that have at least one piece (empty ones would lead to an empty page) */
export const withPieces = (site, items) => (site.collections || []).filter((c) => items.some((i) => i.collection === c.id));

export function collectionCard(c, i) {
  return `<a class="piece reveal" href="collections.html?c=${encodeURIComponent(c.id)}">
  <div class="piece__img">${img(c.image, c.name, { sizes: "(max-width: 560px) 50vw, 33vw" })}</div>
  <div class="piece__meta"><span>${pad(i + 1)}</span><h3>${esc(c.name)}</h3></div>
  <p>${esc(c.text)}</p>
</a>`;
}

/** Up to three pieces to wear with this one: the Studio's picks, otherwise
 *  pieces from other collections (featured first). */
export function pairsFor(it, items) {
  const picked = (it.pairs || []).map((id) => items.find((x) => x.id === id)).filter(Boolean);
  if (picked.length) return picked.slice(0, 3);
  const others = items.filter((x) => x.collection !== it.collection && !x.soldOut);
  const seen = new Set();
  return [...others.filter((x) => x.featured), ...others]
    .filter((x) => (seen.has(x.collection) ? false : seen.add(x.collection)))
    .slice(0, 3);
}

/** The full detail of one piece: photos and video, facts, actions, and pieces
 *  to complete the look. Used on piece pages and in the quick view. */
export function pieceDetail(it, site, items, { heading = "h2" } = {}) {
  const media = [it.video && { video: it.video }, it.image && { src: it.image }, ...(it.images || []).map((src) => ({ src }))].filter(Boolean);
  const slides = media.map((m, i) => m.video
    ? `<figure class="slide slide--video"><video src="${esc(m.video)}" poster="${esc(it.image)}" muted loop playsinline preload="metadata" aria-label="Video of ${esc(it.name)}"></video></figure>`
    : `<figure class="slide"><button class="slide__zoom" type="button" data-zoom="${esc(m.src)}" aria-label="View photo ${i + 1} full screen">${img(m.src, `${it.name}${i ? ` — photo ${i + 1}` : ""}`, { sizes: "(max-width: 760px) 100vw, 50vw", lazy: i > 0 })}</button></figure>`).join("");
  const dots = media.length > 1 ? `<div class="dots" aria-hidden="true">${media.map((_, i) => `<span${i ? "" : ' class="is-on"'}></span>`).join("")}</div>` : "";
  const facts = [
    it.size && ["Size", it.size],
    it.rent && ["Rent", it.rentPrice ? `${money(it.rentPrice)} — ask about dates` : "Available to rent — ask about dates"],
  ].filter(Boolean);
  const pairs = pairsFor(it, items);
  const H = heading;
  return `<div class="detail" data-detail="${esc(it.id)}">
  <div class="detail__media"><div class="slides" data-slides>${slides}</div>${dots}</div>
  <div class="detail__body">
    <p class="label">${esc(collectionName(site, it.collection))}</p>
    <${H} class="detail__name">${esc(it.name)}</${H}>
    <p class="detail__price">${esc(it.soldOut ? "Sold out" : priceLine(it))}</p>
    <div class="detail__badges">${badges(it)}</div>
    ${it.description ? `<p class="detail__desc">${esc(it.description)}</p>` : ""}
    ${facts.length ? `<dl class="detail__facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>` : ""}
    <div class="detail__actions">
      <button class="btn" type="button" data-ask="${esc(it.id)}" data-kind="${it.soldOut ? "notify" : "ask"}">${it.soldOut ? "Tell me when it's back" : "Ask about this piece"}</button>
      <button class="btn btn--ghost save-btn" type="button" data-save="${esc(it.id)}" aria-pressed="false">${HEART}<span>Save</span></button>
    </div>
    <div class="detail__more">
      <button class="link" type="button" data-share="${esc(it.id)}">Share</button>
      ${it.soldOut ? "" : `<button class="link" type="button" data-ask="${esc(it.id)}" data-kind="gift">Buying as a gift?</button>`}
      <a class="link" href="contact.html?piece=${encodeURIComponent(it.id)}">Enquiry form</a>
    </div>
    ${pairs.length ? `<div class="pairs"><p class="label">Complete the look</p><div class="pairs__row">${pairs.map((p) => `
      <a class="pair" href="${pieceUrl(p)}" data-open="${esc(p.id)}">${img(p.image, p.name, { sizes: "120px" })}<span>${esc(p.name)}</span><span class="pair__price">${esc(priceLine(p))}</span></a>`).join("")}</div></div>` : ""}
  </div>
</div>`;
}

export const stepsHTML = (steps = []) =>
  steps.map((s, i) => `<li class="reveal"><span>${pad(i + 1)}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`).join("");

export const pillarsHTML = (pillars = []) =>
  pillars.map((p) => `<div><dt>${esc(p.title)}</dt><dd>${esc(p.text)}</dd></div>`).join("");

export const paragraphsHTML = (ps = []) => ps.map((p) => `<p>${esc(p)}</p>`).join("");

export const faqHTML = (items = []) =>
  items.map((f) => `<details class="faq__item reveal"><summary>${esc(f.q)}</summary><p>${esc(f.a)}</p></details>`).join("");

export const reviewsHTML = (items = []) =>
  items.map((r) => `<figure class="review reveal">
  ${r.image ? `<div class="review__img">${img(r.image, r.name ? `${r.name}` : "", { sizes: "(max-width: 760px) 100vw, 33vw" })}</div>` : ""}
  <blockquote>${esc(r.text)}</blockquote>
  <figcaption>${esc(r.name)}${r.occasion ? ` <span>· ${esc(r.occasion)}</span>` : ""}</figcaption>
</figure>`).join("");

export function lookHTML(look, items, i) {
  const pieces = (look.pieces || []).map((id) => items.find((x) => x.id === id)).filter(Boolean);
  return `<article class="look reveal${i % 2 ? " look--flip" : ""}">
  <div class="look__img">${img(look.image, look.title, { sizes: "(max-width: 860px) 100vw, 55vw", lazy: i > 0 })}</div>
  <div class="look__body">
    <span class="look__num">${pad(i + 1)}</span>
    <h2>${rich(look.title)}</h2>
    <p>${esc(look.text)}</p>
    ${pieces.length ? `<p class="label">In this look</p><div class="pairs__row">${pieces.map((p) => `
      <a class="pair" href="${pieceUrl(p)}">${img(p.image, p.name, { sizes: "120px" })}<span>${esc(p.name)}</span><span class="pair__price">${esc(priceLine(p))}</span></a>`).join("")}</div>` : ""}
  </div>
</article>`;
}

export const galleryHTML = (images = []) =>
  images.map((g) => isVideo(g.src)
    ? `<figure class="reveal"><video src="${esc(g.src)}" muted loop playsinline preload="metadata" aria-hidden="true"></video></figure>`
    : `<figure class="reveal"><button class="slide__zoom" type="button" data-zoom="${esc(g.src)}" aria-label="View full screen">${img(g.src, g.alt, { sizes: "(max-width: 860px) 50vw, 25vw" })}</button></figure>`).join("");

export const bannerHTML = (b) =>
  b?.on && b.text ? `<div class="banner" data-banner><p>${rich(b.text)}${b.link && b.linkText ? ` <a href="${esc(b.link)}">${esc(b.linkText)}</a>` : ""}</p><button type="button" class="banner__close" data-banner-close aria-label="Dismiss">×</button></div>` : "";

/** WhatsApp number in international form, digits only (US numbers get a 1) */
export const waNumber = (n = "") => {
  const d = String(n).replace(/[^\d]/g, "");
  return d.length === 10 ? `1${d}` : d;
};
