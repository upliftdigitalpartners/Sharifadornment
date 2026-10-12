/* Sharif Adornment — site script.
 * The pages arrive fully built (shared/pages.mjs); this adds the interactive
 * parts: quick view, saved pieces, asking about a piece, search and filters,
 * photo zoom, forms, night mode and the Studio's preview mode. */
import { buyable, rentNumber, dollars, priceNumber, sm, esc, rich, withPieces, bannerHTML, pieceDetail, itemCard, collectionCard, stepsHTML, pillarsHTML, paragraphsHTML, faqHTML, reviewsHTML, lookHTML, galleryHTML, priceLine, money, pieceUrl, waNumber } from "../shared/render.mjs";

const API = "https://sharif-adornment-studio.netlify.app/api";
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const params = new URLSearchParams(location.search);
const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
const coarse = matchMedia("(pointer: coarse)").matches;
const small = matchMedia("(max-width: 860px)").matches;
const saveData = Boolean(navigator.connection?.saveData);
const get = (obj, path) => path.split(".").reduce((v, k) => (v == null ? v : v[k]), obj);
const store = {
  get: (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch (_) { return fallback; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) { /* private mode */ } },
};
const siteRoot = new URL(document.querySelector("base")?.href || "./", location.href);
const absUrl = (path) => new URL(path, siteRoot).href;

let site = null;
let items = [];
const byId = (id) => items.find((i) => i.id === id);

/* ---------- Toast ---------- */
let toastTimer;
function toast(msg) {
  const t = $("[data-toast]");
  if (!t) return;
  t.textContent = msg;
  // A popover sits in the top layer, so the message shows above an open quick view too
  if (t.showPopover) { try { t.hidePopover(); t.showPopover(); } catch (_) { /* not supported */ } }
  requestAnimationFrame(() => t.classList.add("is-on"));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    t.classList.remove("is-on");
    toastTimer = setTimeout(() => { try { t.hidePopover?.(); } catch (_) { /* ignore */ } }, 400);
  }, 4200);
}

/* ---------- Stats (anonymous counts, no cookies) ---------- */
const PREVIEW = params.has("preview");
const tracking = !PREVIEW && navigator.doNotTrack !== "1" && !/^(localhost|127\.)/.test(location.hostname);
function track(e, id = "", extra = {}) {
  if (!tracking) return;
  try { navigator.sendBeacon(`${API}/track`, JSON.stringify({ e, id, p: location.pathname.replace(/\/$/, "/index.html"), ...extra })); } catch (_) { /* ignore */ }
}
// The first page of a visit (per browser tab) also says, in one word each, where the
// visitor came from and what kind of device it is. Nothing identifies the person.
function visitInfo() {
  try { if (sessionStorage.getItem("sa-visit")) return {}; sessionStorage.setItem("sa-visit", "1"); } catch (_) { return {}; }
  let from = "";
  try { from = new URL(document.referrer).hostname; } catch (_) { /* typed in or bookmarked */ }
  const s = params.has("fbclid") || /(^|\.)(facebook|fb|messenger)\.com$|^fb\.me$/.test(from) ? "facebook"
    : params.has("igshid") || /(^|\.)instagram\.com$/.test(from) ? "instagram"
    : /(^|\.)google\.[a-z.]+$/.test(from) ? "google"
    : /(^|\.)(whatsapp\.com|wa\.me)$/.test(from) ? "whatsapp"
    : !from || from === location.hostname ? "direct" : "other";
  const touch = matchMedia("(pointer: coarse)").matches;
  const d = !touch ? "computer" : Math.min(screen.width, screen.height) < 600 ? "phone" : "tablet";
  return { n: 1, s, d };
}
track("page", "", visitInfo());

/* ---------- Night mode ---------- */
const root = document.documentElement;
// The icon in the header, and on small phones a "Night mode" line in the menu
const themeBtns = $$("[data-theme-toggle]");
const setThemeLabel = () => {
  const dark = root.dataset.theme === "dark";
  themeBtns.forEach((b) => {
    if (b.classList.contains("nav__theme")) { b.textContent = dark ? "Day mode" : "Night mode"; return; }
    b.setAttribute("aria-label", dark ? "Switch to day mode" : "Switch to night mode");
    b.setAttribute("title", dark ? "Day mode" : "Night mode");
  });
  $('meta[name="theme-color"]')?.setAttribute("content", dark ? "#151413" : "#f6f3ee");
};
setThemeLabel();
themeBtns.forEach((b) => b.addEventListener("click", () => {
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
  try { localStorage.setItem("sa-theme", root.dataset.theme); } catch (_) { /* private mode */ }
  setThemeLabel();
}));

/* ---------- Banner ---------- */
function setupBanner() {
  const banner = $("[data-banner]");
  if (!banner) { root.style.setProperty("--banner-h", "0px"); return; }
  const key = `sa-banner:${banner.textContent.trim().slice(0, 80)}`;
  const setH = () => root.style.setProperty("--banner-h", `${banner.isConnected ? banner.offsetHeight : 0}px`);
  try { if (sessionStorage.getItem(key)) banner.remove(); } catch (_) { /* ignore */ }
  setH();
  addEventListener("resize", setH);
  $("[data-banner-close]", banner)?.addEventListener("click", () => {
    banner.remove();
    setH();
    try { sessionStorage.setItem(key, "1"); } catch (_) { /* ignore */ }
  });
}
setupBanner();

/* ---------- Nav (menu keeps keyboard focus inside while open) ---------- */
const nav = $(".nav");
const toggle = $(".nav__toggle");
const menu = $("#menu");
const onScroll = () => nav.classList.toggle("is-scrolled", scrollY > 24);
addEventListener("scroll", onScroll, { passive: true });
onScroll();
function setMenu(open) {
  nav.classList.toggle("is-open", open);
  toggle.setAttribute("aria-expanded", open);
  toggle.textContent = open ? "Close" : "Menu";
  document.body.style.overflow = open ? "hidden" : "";
  if (open) $("a", menu)?.focus();
  else if (document.activeElement && menu.contains(document.activeElement)) toggle.focus();
}
toggle.addEventListener("click", () => setMenu(!nav.classList.contains("is-open")));
matchMedia("(max-width: 1100px)").addEventListener("change", (e) => { if (!e.matches && nav.classList.contains("is-open")) setMenu(false); });
$$("a", menu).forEach((a) => a.addEventListener("click", () => setMenu(false)));
addEventListener("keydown", (e) => {
  if (!nav.classList.contains("is-open")) return;
  if (e.key === "Escape") setMenu(false);
  if (e.key === "Tab") {
    const focusables = [...$$("a", menu), toggle];
    const i = focusables.indexOf(document.activeElement);
    if (e.shiftKey && i <= 0) { e.preventDefault(); focusables.at(-1).focus(); }
    else if (!e.shiftKey && i === focusables.length - 1) { e.preventDefault(); focusables[0].focus(); }
  }
});
$$(".js-year").forEach((el) => { el.textContent = new Date().getFullYear(); });

/* ---------- Reveal on scroll ---------- */
const io = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (!e.isIntersecting) return;
  e.target.classList.add("is-in");
  io.unobserve(e.target);
}), { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
function reveal(scope = document) {
  $$(".reveal:not(.is-in)", scope).forEach((el) => {
    const siblings = $$(":scope > .reveal", el.parentElement);
    el.style.setProperty("--d", `${Math.min(siblings.indexOf(el), 5) * 0.08}s`);
    io.observe(el);
  });
}
reveal();

/* ---------- Phone dock: shows after the first screen, hides at forms ---------- */
const dock = $("[data-dock]");
if (dock) {
  let past = false, atForm = false;
  const update = () => dock.classList.toggle("is-visible", past && !atForm);
  addEventListener("scroll", () => { past = scrollY > innerHeight * 0.55; update(); }, { passive: true });
  const forms = $$(".enquiry");
  if (forms.length) new IntersectionObserver((es) => { atForm = es.some((e) => e.isIntersecting); update(); }).observe(forms[0]);
}

/* ---------- Videos play only while on screen ---------- */
const vio = new IntersectionObserver((entries) => entries.forEach((e) => {
  if (e.isIntersecting) e.target.play().catch(() => {});
  else e.target.pause();
}), { threshold: 0.25 });
const watchVideos = (scope = document) => { if (!reduceMotion) $$("video", scope).forEach((v) => { v.muted = true; vio.observe(v); }); };

/* ---------- Hero video (skipped with Data Saver or reduced motion) ---------- */
const hero = $("[data-hero]");
function startHero() {
  if (!hero || hero.querySelector("video")) return;
  const src = (small && hero.dataset.videoMobile) || hero.dataset.video;
  if (!src || reduceMotion || saveData) return;
  const v = document.createElement("video");
  Object.assign(v, { muted: true, loop: true, playsInline: true, autoplay: true, preload: "auto" });
  v.setAttribute("aria-hidden", "true");
  v.addEventListener("playing", () => hero.classList.add("is-playing"), { once: true });
  v.src = src;
  hero.appendChild(v);
}

/* ---------- Saved pieces ---------- */
let saved = store.get("sa-saved", []);
function syncSaved() {
  saved = saved.filter((id) => !items.length || byId(id));
  store.set("sa-saved", saved);
  $$("[data-save]").forEach((b) => {
    const on = saved.includes(b.dataset.save);
    b.setAttribute("aria-pressed", on);
    b.classList.toggle("is-on", on);
    const label = $("span", b);
    if (label) label.textContent = on ? "Saved" : "Save";
  });
  const count = $("[data-saved-count]");
  if (count) { count.textContent = saved.length; count.hidden = !saved.length; }
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-save]");
  if (!b) return;
  e.preventDefault();
  e.stopPropagation();
  const id = b.dataset.save;
  const on = !saved.includes(id);
  saved = on ? [...saved, id] : saved.filter((x) => x !== id);
  if (on) { track("save", id); toast("Saved. Find your list under the heart at the top."); }
  syncSaved();
  if ($("[data-saved]")?.open) drawSaved();
});
function drawSaved() {
  const list = $("[data-saved-list]");
  const pieces = saved.map(byId).filter(Boolean);
  $("[data-saved-empty]").hidden = pieces.length > 0;
  $("[data-saved-actions]").hidden = !pieces.length;
  list.innerHTML = pieces.map((it) => `<div class="saved__row">
    <a href="${pieceUrl(it)}" data-open="${esc(it.id)}"><img src="${esc(it.image)}" alt="" /></a>
    <div><a href="${pieceUrl(it)}" data-open="${esc(it.id)}" class="saved__name">${esc(it.name)}</a><span>${esc(it.soldOut ? "Sold out" : priceLine(it))}</span></div>
    <button type="button" class="link" data-unsave="${esc(it.id)}">Remove</button></div>`).join("");
}
$("[data-saved-open]")?.addEventListener("click", () => { drawSaved(); $("[data-saved]").showModal(); });
$("[data-saved-close]")?.addEventListener("click", () => $("[data-saved]").close());
$("[data-saved]")?.addEventListener("click", (e) => {
  if (e.target === e.currentTarget) e.currentTarget.close();
  const u = e.target.closest("[data-unsave]");
  if (u) { saved = saved.filter((x) => x !== u.dataset.unsave); syncSaved(); drawSaved(); }
});

/* ---------- Asking about a piece: WhatsApp, text message or Messenger ---------- */
function message(kind, pieces) {
  const line = (it) => `${it.name} — ${absUrl(pieceUrl(it))}`;
  if (pieces.length > 1) return `Hi! I'm interested in these pieces:\n${pieces.map((p) => `• ${line(p)}`).join("\n")}`;
  const it = pieces[0];
  if (kind === "notify") return `Hi! Please let me know when the ${it.name} is back in stock. ${absUrl(pieceUrl(it))}`;
  if (kind === "gift") return `Hi! I'd like to buy the ${it.name} as a gift. ${absUrl(pieceUrl(it))}`;
  return `Hi! I'm interested in the ${it.name}${it.price ? ` (${money(it.price)})` : ""}. ${absUrl(pieceUrl(it))}`;
}
async function sendMessage(text) {
  const b = site?.business || {};
  const phone = String(b.phone || "").replace(/[^\d]/g, "").slice(-10);
  if (b.whatsapp) { open(`https://wa.me/${waNumber(b.whatsapp)}?text=${encodeURIComponent(text)}`, "_blank", "noopener"); return; }
  if (coarse && phone) { location.href = `sms:+1${phone}?&body=${encodeURIComponent(text)}`; return; }
  try { await navigator.clipboard.writeText(text); } catch (_) { /* clipboard blocked */ }
  toast("Your message is copied — paste it into Messenger and we'll reply there.");
  open(b.messenger || b.facebook || "contact.html", "_blank", "noopener");
}
document.addEventListener("click", (e) => {
  const a = e.target.closest("[data-ask]");
  if (a) {
    const it = byId(a.dataset.ask);
    if (!it) return;
    track("ask", it.id);
    sendMessage(message(a.dataset.kind, [it]));
  }
  if (e.target.closest("[data-ask-saved]")) {
    const pieces = saved.map(byId).filter(Boolean);
    pieces.forEach((p) => track("ask", p.id));
    if (pieces.length) sendMessage(message("ask", pieces));
  }
});

/* ---------- Share ---------- */
document.addEventListener("click", async (e) => {
  const s = e.target.closest("[data-share]");
  if (!s) return;
  const it = byId(s.dataset.share);
  if (!it) return;
  const url = absUrl(pieceUrl(it));
  track("share", it.id);
  try {
    if (navigator.share) await navigator.share({ title: it.name, text: `${it.name} — Sharif Adornment`, url });
    else { await navigator.clipboard.writeText(url); toast("Link copied."); }
  } catch (_) { /* share cancelled */ }
});

/* ---------- Photos: slides, dots and full-screen zoom ---------- */
function setupSlides(scope) {
  $$("[data-slides]", scope).forEach((track) => {
    const dots = $$(".dots span", track.parentElement);
    if (!dots.length) return;
    track.addEventListener("scroll", () => {
      const i = Math.round(track.scrollLeft / track.clientWidth);
      dots.forEach((d, j) => d.classList.toggle("is-on", i === j));
    }, { passive: true });
  });
  watchVideos(scope);
}
const zoom = $("[data-zoom-view]");
document.addEventListener("click", (e) => {
  const z = e.target.closest("[data-zoom]");
  if (!z || !zoom) return;
  const im = $("img", zoom);
  im.src = z.dataset.zoom;
  im.alt = $("img", z)?.alt || "";
  zoom.classList.remove("is-zoomed");
  zoom.showModal();
});
$("[data-zoom-close]")?.addEventListener("click", () => zoom.close());
zoom?.addEventListener("click", (e) => {
  if (e.target.closest("[data-zoom-close]")) return;
  const im = $("img", zoom);
  if (e.target !== im) { zoom.close(); return; }
  const r = im.getBoundingClientRect();
  im.style.transformOrigin = `${((e.clientX - r.left) / r.width) * 100}% ${((e.clientY - r.top) / r.height) * 100}%`;
  zoom.classList.toggle("is-zoomed");
});

/* ---------- Quick view ---------- */
const sheet = $("[data-sheet]");
const onPiecePage = document.body.dataset.page === "piece";
function openPiece(id, { push = true } = {}) {
  const it = byId(id);
  if (!it || !sheet) return false;
  $("[data-sheet-body]", sheet).innerHTML = pieceDetail(it, site, items);
  syncSaved();
  applyStock(sheet);
  setupSlides(sheet);
  if (!sheet.open) sheet.showModal();
  sheet.scrollTop = 0;
  document.body.style.overflow = "hidden";
  if (push) { const u = new URL(location.href); u.searchParams.set("piece", id); history.replaceState(null, "", u); }
  track("view", id);
  return true;
}
sheet?.addEventListener("close", () => {
  document.body.style.overflow = "";
  $$("video", sheet).forEach((v) => v.pause());
  // Forget the piece in the address, so a refresh doesn't reopen it
  const u = new URL(location.href);
  if (u.searchParams.has("piece")) { u.searchParams.delete("piece"); history.replaceState(null, "", u); }
});
sheet?.addEventListener("click", (e) => {
  if (e.target === sheet || e.target.closest("[data-sheet-close]")) sheet.close();
});
document.addEventListener("click", (e) => {
  const o = e.target.closest("[data-open]");
  if (!o || onPiecePage && !sheet?.contains(o) && !$("[data-saved]")?.contains(o)) return;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return;
  if (!items.length) return; // content not loaded: follow the link to the piece's page
  e.preventDefault();
  $("[data-saved]")?.open && $("[data-saved]").close();
  openPiece(o.dataset.open);
});

/* ---------- Collections: search and filters ---------- */
function setupCollections() {
  const grid = $("[data-items]");
  if (!grid) return;
  const search = $("[data-search]");
  const results = $("[data-results]");
  const wanted = params.get("c");
  let active = wanted && $(`[data-filter="${CSS.escape(wanted)}"]`) ? wanted : "all";
  if (params.get("q")) search.value = params.get("q");
  const text = (it) => `${it.name} ${it.description} ${(site.collections || []).find((c) => c.id === it.collection)?.name || ""} ${it.size}`.toLowerCase();
  const apply = () => {
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    $$("[data-item]", grid).forEach((card) => {
      const it = byId(card.dataset.item);
      const ok = it && (active === "all" || (active === "rent" ? it.rent : it.collection === active)) && (!q || q.split(/\s+/).every((w) => text(it).includes(w)));
      card.hidden = !ok;
      if (ok) shown++;
    });
    $$("[data-filter]").forEach((c) => c.setAttribute("aria-pressed", c.dataset.filter === active));
    results.textContent = shown ? (q || active !== "all" ? `${shown} piece${shown === 1 ? "" : "s"}` : "") : "Nothing matches yet — try another word, or message us to ask what's in stock.";
    const u = new URL(location.href);
    active === "all" ? u.searchParams.delete("c") : u.searchParams.set("c", active);
    q ? u.searchParams.set("q", q) : u.searchParams.delete("q");
    history.replaceState(null, "", u);
  };
  $("[data-filters]")?.addEventListener("click", (e) => {
    const b = e.target.closest("[data-filter]");
    if (b) { active = b.dataset.filter; apply(); }
  });
  let t;
  search?.addEventListener("input", () => { clearTimeout(t); t = setTimeout(apply, 120); });
  apply();
}

/* ---------- Live stock (pieces whose stock is counted) ---------- */
let stock = {};
const stockLeft = (id) => (Object.hasOwn(stock, id) ? stock[id] : Infinity);
const available = (it) => buyable(it) && stockLeft(it.id) > 0;
async function loadStock() {
  try {
    const res = await fetch(`${API}/order`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "stock" }) });
    if (res.ok) stock = (await res.json()).stock || {};
  } catch (_) { /* the page still works; checkout re-checks */ }
  applyStock();
}
// Sold out / last one on cards and buttons, from the live counts
function applyStock(scope = document) {
  for (const [id, left] of Object.entries(stock)) {
    $$(`[data-item="${CSS.escape(id)}"]`, scope).forEach((card) => {
      const badges = $(".item__badges", card);
      if (left <= 0 && !card.classList.contains("is-sold")) {
        card.classList.add("is-sold");
        badges?.querySelector(".badge:not(.badge--gold)")?.remove();
        badges?.insertAdjacentHTML("afterbegin", '<span class="badge badge--sold">Sold out</span>');
      } else if (left === 1 && badges && !/Last one|Sold out/.test(badges.textContent)) {
        badges.insertAdjacentHTML("afterbegin", '<span class="badge">Last one</span>');
      }
    });
    if (left <= 0) $$(`[data-add="${CSS.escape(id)}"]`, scope).forEach((b) => { b.disabled = true; b.textContent = "Sold out"; });
  }
  syncBag();
}

/* ---------- Bag: pieces to buy or rent, kept on this device ---------- */
let bag = store.get("sa-bag", []); // [{ id, qty }] or [{ id, kind: "rent", date }]
const MAX_QTY = 5;
const bagKey = (b) => (b.kind === "rent" ? `${b.id}:rent:${b.date}` : b.id);
function bagLines() {
  return bag.map((b) => ({ ...b, key: bagKey(b), it: byId(b.id) })).filter((l) => l.it && (l.kind === "rent" ? rentNumber(l.it) != null : available(l.it)))
    .map((l) => ({ ...l, qty: l.kind === "rent" ? 1 : Math.min(l.qty, stockLeft(l.id)), price: l.kind === "rent" ? rentNumber(l.it) : priceNumber(l.it) }));
}
const lineName = (l) => `${esc(l.it?.name || l.name)}${l.kind === "rent" ? ` <small>· rental for ${esc(prettyDate(l.date))}</small>` : ""}`;
const prettyDate = (d) => (d ? new Date(`${d}T12:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" }) : "");
function syncBag() {
  if (items.length) bag = bagLines().map(({ id, qty, kind, date }) => (kind === "rent" ? { id, kind, date } : { id, qty }));
  store.set("sa-bag", bag);
  const n = bag.reduce((s, b) => s + (b.qty || 1), 0);
  const count = $("[data-bag-count]");
  if (count) { count.textContent = n; count.hidden = !n; }
  $$("[data-add]").forEach((b) => { if (!b.disabled) b.textContent = bag.some((x) => !x.kind && x.id === b.dataset.add) ? "In your bag — view" : "Add to bag"; });
}
function drawBag() {
  const lines = bagLines();
  $("[data-bag-empty]").hidden = lines.length > 0;
  $("[data-bag-actions]").hidden = !lines.length;
  const totals = $("[data-bag-totals]");
  totals.hidden = !lines.length;
  totals.innerHTML = lines.length ? `<div class="is-total"><dt>Subtotal</dt><dd>${dollars(lines.reduce((s, l) => s + l.price * l.qty, 0))}</dd></div>
    <p class="bag__note">Delivery${site?.checkout?.taxRate ? ", tax" : ""} and discount codes at checkout.</p>` : "";
  $("[data-bag-list]").innerHTML = lines.map((l) => `<div class="saved__row bag__row">
    <a href="${pieceUrl(l.it)}" data-open="${esc(l.id)}"><img src="${esc(l.it.image)}" alt="" /></a>
    <div><a href="${pieceUrl(l.it)}" data-open="${esc(l.id)}" class="saved__name">${esc(l.it.name)}</a>
      <span>${dollars(l.price)}${l.kind === "rent" ? ` · rental for ${esc(prettyDate(l.date))}` : l.qty > 1 ? ` × ${l.qty}` : ""}</span>
      ${l.kind === "rent" ? "" : `<div class="qty" role="group" aria-label="Quantity of ${esc(l.it.name)}">
        <button type="button" data-qty="${esc(l.key)}" data-step="-1" aria-label="One fewer"${l.qty <= 1 ? " disabled" : ""}>−</button><b>${l.qty}</b><button type="button" data-qty="${esc(l.key)}" data-step="1" aria-label="One more"${l.qty >= Math.min(MAX_QTY, stockLeft(l.id)) ? " disabled" : ""}>+</button>
      </div>`}</div>
    <button type="button" class="link" data-unbag="${esc(l.key)}">Remove</button></div>`).join("");
}
const openBag = () => { drawBag(); const d = $("[data-bag]"); if (!d.open) d.showModal(); };
const bagChanged = () => { syncBag(); drawBag(); refreshCheckout(); };
document.addEventListener("click", (e) => {
  const add = e.target.closest("[data-add]");
  if (add) {
    e.preventDefault();
    const id = add.dataset.add;
    if (!bag.some((b) => !b.kind && b.id === id)) { bag.push({ id, qty: 1 }); track("bag", id); }
    syncBag();
    openBag();
    return;
  }
  const rt = e.target.closest("[data-rent-toggle]");
  if (rt) {
    const form = $(".rent-pick__form", rt.closest("[data-rent]"));
    form.hidden = !form.hidden;
    const input = $("[data-rent-date]", form);
    input.min = new Date(Date.now() - new Date().getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    if (!form.hidden) input.focus();
    return;
  }
  const ra = e.target.closest("[data-rent-add]");
  if (ra) {
    const date = $("[data-rent-date]", ra.closest("[data-rent]")).value;
    if (!date) { toast("Pick the date of your event first."); return; }
    const id = ra.dataset.rentAdd;
    if (!bag.some((b) => b.kind === "rent" && b.id === id && b.date === date)) { bag.push({ id, kind: "rent", date }); track("bag", id); }
    syncBag();
    openBag();
    return;
  }
  const q = e.target.closest("[data-qty]");
  if (q) {
    const line = bag.find((b) => bagKey(b) === q.dataset.qty);
    if (line) line.qty = Math.min(MAX_QTY, stockLeft(line.id), Math.max(1, line.qty + Number(q.dataset.step)));
    bagChanged();
    return;
  }
  const u = e.target.closest("[data-unbag]");
  if (u) { bag = bag.filter((b) => bagKey(b) !== u.dataset.unbag); bagChanged(); }
});
$("[data-bag-open]")?.addEventListener("click", openBag);
$$("[data-bag-close]").forEach((b) => b.addEventListener("click", () => $("[data-bag]").close()));
$("[data-bag]")?.addEventListener("click", (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

/* ---------- Checkout: totals always come from the order service ---------- */
const orderApi = async (body) => {
  const res = await fetch(`${API}/order`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const out = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(out.error || "Something went wrong. Please try again.");
  return out;
};
const totalsHTML = (q) => `<div><dt>Subtotal</dt><dd>${dollars(q.subtotal)}</dd></div>
  ${q.discount ? `<div class="is-discount"><dt>Code ${esc(q.code)}</dt><dd>−${dollars(q.discount)}</dd></div>` : ""}
  <div><dt>${esc(q.methodLabel || "Delivery")}</dt><dd>${q.delivery ? dollars(q.delivery) : q.deliveryKnown === false ? "We'll confirm" : "Free"}</dd></div>
  ${q.rentDeposit ? `<div><dt>Refundable rental deposit</dt><dd>${dollars(q.rentDeposit)}</dd></div>` : ""}
  ${q.tax ? `<div><dt>${esc(q.taxLabel || "Sales tax")}</dt><dd>${dollars(q.tax)}</dd></div>` : ""}
  <div class="is-total"><dt>Total</dt><dd>${dollars(q.total)}</dd></div>`;
const checkout = { method: "", pay: "", code: "", quote: null, timer: 0, seq: 0 };
function refreshCheckout() {
  if (!$('[data-form="checkout"]')) return;
  clearTimeout(checkout.timer);
  checkout.timer = setTimeout(drawCheckout, 150);
}
async function drawCheckout() {
  const box = $("[data-checkout-summary]");
  const form = $('[data-form="checkout"]');
  if (!box) return;
  const lines = bagLines();
  form.hidden = !lines.length;
  if (!lines.length) {
    box.innerHTML = '<p class="checkout__empty">Your bag is empty.</p><a class="btn" href="collections.html">Browse the collections</a>';
    return;
  }
  const seq = ++checkout.seq;
  let q;
  try {
    q = await orderApi({ action: "quote", items: bag, code: checkout.code, method: checkout.method, pay: checkout.pay });
  } catch (x) {
    box.innerHTML = `<p class="checkout__empty">We couldn't load prices right now.</p><p class="muted">${esc(x.message === "Failed to fetch" ? "Check your connection and try again." : x.message)}</p>`;
    form.hidden = true;
    return;
  }
  if (seq !== checkout.seq) return; // a newer change is on its way
  checkout.quote = q;
  checkout.method = q.method;
  checkout.pay = q.pay;
  if (q.problems.length) {
    toast(q.problems[0]);
    // keep the bag in step with what's really available
    bag = q.lines.map((l) => (l.kind === "rent" ? { id: l.id, kind: "rent", date: l.date } : { id: l.id, qty: l.qty }));
    syncBag();
    if (!q.lines.length) return drawCheckout();
  }
  box.innerHTML = `<div class="checkout__lines">${q.lines.map((l) => `<div class="checkout__line">
      <img src="${esc(sm(l.image))}" alt="" /><span>${lineName(l)}${l.qty > 1 ? ` <small>× ${l.qty}</small>` : ""}</span><b>${dollars(l.price * l.qty)}</b></div>`).join("")}</div>
    <form class="code" data-code-form><label class="visually-hidden" for="c-code">Discount code</label>
      <input id="c-code" name="code" placeholder="Discount code" value="${esc(checkout.code)}" autocomplete="off" autocapitalize="characters" />
      <button type="submit" class="btn btn--ghost">${q.code ? "Applied ✓" : "Apply"}</button></form>
    ${q.codeError ? `<p class="code__error">${esc(q.codeError)}</p>` : ""}
    <dl class="bag__totals">${totalsHTML(q)}</dl>
    <button type="button" class="link" data-bag-open-inline>Change your bag</button>`;
  $("[data-bag-open-inline]", box).addEventListener("click", openBag);
  $("[data-code-form]", box).addEventListener("submit", (e) => {
    e.preventDefault();
    checkout.code = e.target.code.value.trim();
    drawCheckout();
  });

  // Delivery choices
  $("[data-methods]", form).innerHTML = q.methods.map((m) => `<label class="pay__opt"><input type="radio" name="method" value="${esc(m.id)}"${m.id === q.method ? " checked" : ""} />
    <span><b>${esc(m.label)} <em class="pay__price">${m.id === "pickup" || (!m.fee && m.feeSet) ? "Free" : m.fee ? (m.freeOver ? `${dollars(m.fee)} · free over ${dollars(m.freeOver)}` : dollars(m.fee)) : "We'll confirm"}</em></b>${m.note ? `<small>${esc(m.note)}</small>` : ""}</span></label>`).join("");
  const pickup = q.method === "pickup";
  $("[data-address]", form).hidden = pickup;
  $$("[data-address] [required]", form).forEach((i) => { i.required = !pickup; });

  // Ways to pay
  const payText = {
    card: [`Pay now by card — ${dollars(q.total)}`, "Secure checkout by Stripe. Apple Pay and Google Pay too."],
    deposit: [`Pay a ${q.depositPercent}% deposit now — ${dollars(q.depositAmount)}`, `By card now; the rest (${dollars(q.total - q.depositAmount)}) after we confirm.`],
    later: ["Pay after we confirm", `We'll text you to confirm, then you pay by ${q.payMethods}.`],
  };
  $("[data-pays]", form).innerHTML = q.pays.map((p) => `<label class="pay__opt"><input type="radio" name="pay" value="${p}"${p === q.pay ? " checked" : ""} />
    <span><b>${esc(payText[p][0])}</b><small>${esc(payText[p][1])}</small></span></label>`).join("");
  $("[data-place]", form).textContent = q.pay === "later" ? `Place order — ${dollars(q.total)}` : `Continue to payment — ${dollars(q.pay === "deposit" ? q.depositAmount : q.total)}`;
}
function setupCheckout() {
  const form = $('[data-form="checkout"]');
  if (!form) return;
  drawCheckout();
  const note = $(".enquiry__note", form);
  if (params.has("cancelled")) note.textContent = "Card payment was cancelled. Your bag is still here; you can try again or choose to pay after we confirm.";
  form.addEventListener("change", (e) => {
    if (e.target.name === "method") { checkout.method = e.target.value; refreshCheckout(); }
    if (e.target.name === "pay") { checkout.pay = e.target.value; refreshCheckout(); }
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate(form)) return;
    const d = Object.fromEntries(new FormData(form));
    const btn = $("[data-place]", form);
    const label = btn.textContent;
    btn.disabled = true;
    btn.textContent = d.pay === "later" ? "Placing your order…" : "Opening secure payment…";
    note.textContent = "";
    try {
      const out = await orderApi({
        action: "place", pay: d.pay, method: d.method, code: checkout.code, website: d.website, items: bag,
        customer: { name: d.name, phone: d.phone, email: d.email, address: d.address, city: d.city, state: d.state, zip: d.zip, notes: d.notes },
      });
      store.set("sa-last-order", { id: out.id, token: out.token });
      if (out.url) { location.href = out.url; return; } // Stripe's payment page; the bag empties once it's paid
      bag = []; syncBag();
      location.href = `order-done.html?o=${encodeURIComponent(out.id)}&t=${encodeURIComponent(out.token)}`;
    } catch (x) {
      note.textContent = x.message === "Failed to fetch" ? "We couldn't reach the shop. Check your connection and try again." : x.message;
      btn.disabled = false;
      btn.textContent = label;
      refreshCheckout();
    }
  });
}

/* ---------- Your order: confirmation and tracking ---------- */
async function setupOrderDone() {
  const view = $("[data-order-view]");
  if (!view) return;
  const last = store.get("sa-last-order", {});
  const id = params.get("o") || last.id, token = params.get("t") || last.token;
  if (!id || !token) { view.innerHTML = '<p>We couldn\'t find an order on this device. If you placed one, we\'ll text you to confirm it.</p>'; return; }
  const load = async () => (await orderApi({ action: "status", id, token })).order;
  const steps = ["new", "confirmed", "shipped", "delivered"];
  const draw = (o) => {
    const c = site?.checkout || {};
    const fresh = o.status === "new" && Date.now() - Date.parse(o.created) < 30 * 6e4;
    $("[data-order-title]").innerHTML = fresh ? "Thank <em>you.</em>" : `Order <em>${esc(o.statusName.toLowerCase())}.</em>`;
    const balance = Math.max(0, o.total - o.amountPaid);
    let payment = "";
    if (o.status !== "cancelled") {
      if (o.pay !== "later" && !o.amountPaid) {
        payment = o.payUrl
          ? `<div class="order__pay"><p>Your card payment isn't finished yet.</p><a class="btn" href="${esc(o.payUrl)}">Pay now — ${dollars(o.due)}</a></div>`
          : '<p class="muted">Confirming your card payment… this takes a moment.</p>';
      } else if (o.paid) {
        payment = `<p class="order__paid">✓ Paid${o.pay !== "later" ? " by card" : ""}. Thank you!</p>`;
      } else {
        payment = `${o.amountPaid ? `<p class="order__paid">✓ Deposit of ${dollars(o.amountPaid)} paid.</p>` : ""}
          <div class="order__pay"><h2>${o.amountPaid ? `Balance: ${dollars(balance)}` : "How to pay"}</h2>
          <p>${esc(o.payLater || "We'll text you to confirm your order and how to pay.").replace(/\n/g, "<br />")}</p>
          <p class="muted">Please add your order number <b>${esc(o.id)}</b> to the payment note.</p></div>`;
      }
    }
    const at = steps.indexOf(o.status);
    const timeline = o.status === "cancelled" ? '<p class="order__cancelled">This order was cancelled. Questions? <a href="contact.html">Message us</a>.</p>'
      : `<ol class="timeline">${steps.map((s, i) => `<li class="${i <= at ? "is-done" : ""}${i === at ? " is-now" : ""}"><span>${{ new: "Placed", confirmed: "Confirmed", shipped: "On its way", delivered: "Delivered" }[s]}</span>${o.times?.[s] ? `<small>${new Date(o.times[s]).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</small>` : ""}</li>`).join("")}</ol>`;
    const tracking = o.tracking?.number ? `<p class="order__tracking">Tracking: <b>${esc(o.tracking.carrier || "")} ${esc(o.tracking.number)}</b>${/usps/i.test(o.tracking.carrier) ? ` · <a href="https://tools.usps.com/go/TrackConfirmAction?tLabels=${encodeURIComponent(o.tracking.number)}" target="_blank" rel="noopener">Track it</a>` : /ups/i.test(o.tracking.carrier) ? ` · <a href="https://www.ups.com/track?tracknum=${encodeURIComponent(o.tracking.number)}" target="_blank" rel="noopener">Track it</a>` : /fedex/i.test(o.tracking.carrier) ? ` · <a href="https://www.fedex.com/fedextrack/?trknbr=${encodeURIComponent(o.tracking.number)}" target="_blank" rel="noopener">Track it</a>` : ""}</p>` : "";
    view.innerHTML = `${fresh ? `<p class="order__lead">${esc(c.thanks || "We've got your order and will text you shortly to confirm it.")}</p>` : ""}
      <p class="order__id">Order <b>${esc(o.id)}</b> · ${esc(o.name)}</p>
      ${timeline}${tracking}${payment}
      <div class="checkout__lines">${o.lines.map((l) => `<div class="checkout__line"><img src="${esc(sm(l.image))}" alt="" /><span>${lineName(l)}${l.qty > 1 ? ` <small>× ${l.qty}</small>` : ""}</span><b>${dollars(l.price * l.qty)}</b></div>`).join("")}</div>
      <dl class="bag__totals">${totalsHTML(o)}</dl>
      ${o.status === "delivered" ? `<p><a class="btn" href="review.html?o=${encodeURIComponent(id)}&t=${encodeURIComponent(token)}">Leave a review</a></p>` : ""}
      <p class="muted small">Bookmark this page to check on your order any time.</p>
      <a class="link" href="collections.html">Keep browsing</a>`;
  };
  try {
    let o = await load();
    bag = bag.filter((b) => !o.lines.some((l) => l.key === bagKey(b))); syncBag();
    draw(o);
    for (let i = 0; o.pay !== "later" && !o.amountPaid && !o.payUrl && o.status !== "cancelled" && i < 6; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      o = await load(); draw(o);
    }
  } catch (x) {
    view.innerHTML = `<p>${esc(x.message)} If you placed an order, we'll text you to confirm it.</p>`;
  }
}

/* ---------- Leave a review (from the link in a delivered order) ---------- */
function setupReview() {
  const form = $('[data-form="review"]');
  if (!form) return;
  const id = params.get("o"), token = params.get("t");
  const note = $(".enquiry__note", form);
  if (!id || !token) { form.innerHTML = "<p>Please use the review link we sent you.</p>"; return; }
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate(form)) return;
    const d = Object.fromEntries(new FormData(form));
    try {
      const res = await fetch(`${API}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, token, rating: d.rating, text: d.text, name: d.name }) });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "That didn't go through. Please try again.");
      form.innerHTML = '<p class="order__lead">Thank you! Your review means a lot to us. It will appear on the site once we\'ve read it.</p><a class="link" href="index.html">Back to the shop</a>';
    } catch (x) { note.textContent = x.message; }
  });
}

/* ---------- Forms: enquiry and newsletter ---------- */
function handoff(form, body, subject) {
  const note = $(".enquiry__note", form);
  const b = site?.business || {};
  const phone = String(b.phone || "").replace(/[^\d]/g, "").slice(-10);
  if (coarse && phone) { location.href = `sms:+1${phone}?&body=${encodeURIComponent(body)}`; note.textContent = "Opening your messages app…"; return; }
  if (b.email) { location.href = `mailto:${b.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`; note.textContent = "Opening your email app…"; return; }
  if (b.whatsapp) { open(`https://wa.me/${waNumber(b.whatsapp)}?text=${encodeURIComponent(body)}`, "_blank", "noopener"); note.textContent = "Opening WhatsApp…"; return; }
  navigator.clipboard?.writeText(body).catch(() => {});
  note.textContent = "Your message is copied — paste it into Messenger and we'll reply there.";
  open(b.messenger || b.facebook, "_blank", "noopener");
}
// A field marked as missing clears as soon as something is typed into it
document.addEventListener("input", (e) => { if (e.target.value?.trim()) e.target.closest(".field.is-invalid")?.classList.remove("is-invalid"); });
function validate(form) {
  let ok = true;
  $$("[required]", form).forEach((input) => {
    const bad = !input.value.trim();
    input.closest(".field").classList.toggle("is-invalid", bad);
    if (bad) ok = false;
  });
  if (!ok) $(".enquiry__note", form).textContent = "Please fill in the highlighted fields so we can reply.";
  return ok;
}
function setupForms() {
  const enquiry = $('[data-form="enquiry"]');
  if (enquiry) {
    const topics = $("[data-topics]", enquiry);
    const piece = byId(params.get("piece"));
    const col = (site.collections || []).find((c) => c.id === (piece?.collection || params.get("c")));
    if (col) topics.value = col.name;
    if (piece) $("#f-msg").value = `I'd like to ask about the ${piece.name}. ${absUrl(pieceUrl(piece))}`;
    if (params.has("saved")) {
      const pieces = saved.map(byId).filter(Boolean);
      if (pieces.length) $("#f-msg").value = `I'm interested in these pieces:\n${pieces.map((p) => `• ${p.name} — ${absUrl(pieceUrl(p))}`).join("\n")}`;
    }
    enquiry.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!validate(enquiry)) return;
      const d = Object.fromEntries(new FormData(enquiry));
      track("ask", piece?.id || "general-enquiry");
      handoff(enquiry, `Name: ${d.name}\nContact: ${d.contact}\nInterested in: ${d.topic}\n\n${d.message}`, `Enquiry — ${d.topic}`);
    });
  }
}
$$("[data-newsletter]").forEach((form) => form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const note = $(".newsletter__note", form);
  const email = form.email.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { note.textContent = "Please enter a valid email address."; return; }
  const btn = $("button", form);
  btn.disabled = true;
  try {
    const res = await fetch(`${API}/subscribe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    if (!res.ok) throw new Error();
    form.reset();
    note.textContent = "Thank you — you're on the list.";
  } catch (_) {
    note.textContent = "That didn't go through. Please try again in a moment.";
  } finally { btn.disabled = false; }
}));

/* ---------- Facebook posts, loaded only when asked for ---------- */
$("[data-feed-load]")?.addEventListener("click", () => {
  const box = $("[data-feed-frame]");
  const page = encodeURIComponent(box.dataset.pageUrl);
  const w = Math.min(500, box.clientWidth || 500);
  box.innerHTML = `<iframe title="Sharif Adornment on Facebook" src="https://www.facebook.com/plugins/page.php?href=${page}&tabs=timeline&width=${w}&height=720&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=false" width="${w}" height="720" loading="lazy" allow="encrypted-media; picture-in-picture; web-share"></iframe>
    <p class="feed__fallback">Posts not showing? Some browsers block Facebook on other sites. <a href="${esc(box.dataset.pageUrl)}" target="_blank" rel="noopener">See them on Facebook</a></p>`;
  box.classList.add("is-loaded");
});

/* ---------- Content ---------- */
function loadContent() {
  if (PREVIEW) {
    const draft = store.get("sa-preview", null);
    if (draft?.site && draft?.items) return Promise.resolve(withPreviews(draft));
  }
  const load = (f) => fetch(`${siteRoot.href}content/${f}`, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
  return Promise.all([load("site.json"), load("items.json")]).then(([s, i]) => ({ site: s, items: i }));
}
// In preview, photos that aren't published yet are shown from the Studio's copies
function withPreviews({ site: s, items: i, previews = {} }) {
  let json = JSON.stringify({ s, i });
  for (const [path, url] of Object.entries(previews)) json = json.split(`"${path}"`).join(`"${url}"`);
  const out = JSON.parse(json);
  return { site: out.s, items: out.i };
}

// Preview mode re-draws everything from the Studio's unpublished draft
function rerender() {
  $$("[data-t]").forEach((el) => { const v = get(site, el.dataset.t); if (typeof v === "string") el.innerHTML = rich(v); });
  $$("[data-src]").forEach((el) => { const v = get(site, el.dataset.src); if (v) { el.src = v; el.removeAttribute("srcset"); } });
  $$("[data-paragraphs]").forEach((el) => { el.innerHTML = paragraphsHTML(get(site, el.dataset.paragraphs)); });
  const set = (sel, html) => { const el = $(sel); if (el) el.innerHTML = html; };
  set("[data-collections]", withPieces(site, items).map(collectionCard).join(""));
  set("[data-featured]", items.filter((i) => i.featured).map((it) => itemCard(it, site)).join(""));
  $$("[data-featured-section]").forEach((s) => { s.hidden = !items.some((i) => i.featured); });
  set("[data-items]", items.map((it) => itemCard(it, site)).join(""));
  set("[data-steps]", stepsHTML(site.order?.steps));
  set("[data-pillars]", pillarsHTML(site.story?.pillars));
  set("[data-faq]", faqHTML(site.faq?.items));
  set("[data-looks]", (site.bridal?.looks || []).map((l, i) => lookHTML(l, items, i)).join(""));
  set("[data-gallery]", galleryHTML(site.gallery?.images));
  const rv = site.reviews?.items || [];
  $$("[data-reviews-section]").forEach((s) => { s.hidden = !rv.length; });
  set("[data-reviews]", reviewsHTML(rv));
  const piece = $("[data-piece]");
  if (piece && byId(piece.dataset.piece)) {
    const d = $("[data-detail]", piece);
    d.outerHTML = pieceDetail(byId(piece.dataset.piece), site, items, { heading: "h1" });
  }
  $("[data-banner]")?.remove();
  $(".skip").insertAdjacentHTML("afterend", bannerHTML(site.banner));
  setupBanner();
  const bar = document.createElement("div");
  bar.className = "preview-bar";
  bar.innerHTML = 'Preview — not published yet. <button type="button">Close preview</button>';
  $("button", bar).addEventListener("click", () => window.close());
  document.body.prepend(bar);
}

loadContent()
  .then((c) => {
    site = c.site;
    items = c.items;
    if (PREVIEW) rerender();
    reveal();
    startHero();
    syncSaved();
    setupSlides(document);
    setupCollections();
    setupForms();
    syncBag();
    loadStock();
    setupCheckout();
    setupOrderDone();
    setupReview();
    if (onPiecePage) track("view", $("[data-piece]")?.dataset.piece);
    else if (params.get("piece") && !$('[data-form="enquiry"]')) openPiece(params.get("piece"), { push: false });
  })
  .catch((err) => {
    console.warn("Content failed to load", err);
    startHero();
    setupSlides(document);
    $$("[data-items], [data-gallery]").forEach((el) => {
      if (!el.children.length) el.innerHTML = '<p class="empty">This page didn\'t load fully. Please check your connection and <a href="">try again</a>.</p>';
    });
    toast("Some features are unavailable right now — please refresh in a moment.");
  });
