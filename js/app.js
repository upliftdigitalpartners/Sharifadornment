/* Sharif Adornment — site script.
 * The pages arrive fully built (shared/pages.mjs); this adds the interactive
 * parts: quick view, saved pieces, asking about a piece, search and filters,
 * photo zoom, forms, night mode and the Studio's preview mode. */
import { buyable, deliveryFor, dollars, priceNumber, sm, esc, rich, withPieces, bannerHTML, pieceDetail, itemCard, collectionCard, stepsHTML, pillarsHTML, paragraphsHTML, faqHTML, reviewsHTML, lookHTML, galleryHTML, priceLine, money, pieceUrl, waNumber } from "../shared/render.mjs";

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
  syncBag();
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

/* ---------- Bag: pieces to order, kept on this device ---------- */
let bag = store.get("sa-bag", []); // [{ id, qty }]
const MAX_QTY = 5;
function bagLines() {
  return bag.map((b) => ({ ...b, it: byId(b.id) })).filter((l) => l.it && buyable(l.it))
    .map((l) => ({ ...l, price: priceNumber(l.it) }));
}
function bagTotals(lines) {
  const subtotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const delivery = deliveryFor(site, subtotal);
  return { subtotal, delivery, total: subtotal + delivery };
}
// How delivery reads: a fee, "Free", or "We'll confirm" when no fee is set
const deliveryText = (t) => t.delivery ? dollars(t.delivery) : site?.checkout?.deliveryFee ? "Free" : "We'll confirm";
const totalsHTML = (t) => `<div><dt>Subtotal</dt><dd>${dollars(t.subtotal)}</dd></div>
  <div><dt>Delivery</dt><dd>${deliveryText(t)}</dd></div>
  <div class="is-total"><dt>Total</dt><dd>${dollars(t.total)}</dd></div>`;
function syncBag() {
  if (items.length) bag = bag.filter((b) => byId(b.id) && buyable(byId(b.id)));
  store.set("sa-bag", bag);
  const n = bag.reduce((s, b) => s + b.qty, 0);
  const count = $("[data-bag-count]");
  if (count) { count.textContent = n; count.hidden = !n; }
  $$("[data-add]").forEach((b) => { b.textContent = bag.some((x) => x.id === b.dataset.add) ? "In your bag — view" : "Add to bag"; });
}
function drawBag() {
  const lines = bagLines();
  $("[data-bag-empty]").hidden = lines.length > 0;
  $("[data-bag-actions]").hidden = !lines.length;
  const totals = $("[data-bag-totals]");
  totals.hidden = !lines.length;
  totals.innerHTML = lines.length ? totalsHTML(bagTotals(lines)) : "";
  $("[data-bag-list]").innerHTML = lines.map(({ it, qty, price }) => `<div class="saved__row bag__row">
    <a href="${pieceUrl(it)}" data-open="${esc(it.id)}"><img src="${esc(it.image)}" alt="" /></a>
    <div><a href="${pieceUrl(it)}" data-open="${esc(it.id)}" class="saved__name">${esc(it.name)}</a><span>${dollars(price)}${qty > 1 ? ` × ${qty}` : ""}</span>
      <div class="qty" role="group" aria-label="Quantity of ${esc(it.name)}">
        <button type="button" data-qty="${esc(it.id)}" data-step="-1" aria-label="One fewer"${qty <= 1 ? " disabled" : ""}>−</button><b>${qty}</b><button type="button" data-qty="${esc(it.id)}" data-step="1" aria-label="One more"${qty >= MAX_QTY ? " disabled" : ""}>+</button>
      </div></div>
    <button type="button" class="link" data-unbag="${esc(it.id)}">Remove</button></div>`).join("");
}
const openBag = () => { drawBag(); const d = $("[data-bag]"); if (!d.open) d.showModal(); };
document.addEventListener("click", (e) => {
  const add = e.target.closest("[data-add]");
  if (add) {
    e.preventDefault();
    const id = add.dataset.add;
    if (!bag.some((b) => b.id === id)) bag.push({ id, qty: 1 });
    syncBag();
    openBag();
    return;
  }
  const q = e.target.closest("[data-qty]");
  if (q) {
    const line = bag.find((b) => b.id === q.dataset.qty);
    if (line) line.qty = Math.min(MAX_QTY, Math.max(1, line.qty + Number(q.dataset.step)));
    syncBag(); drawBag(); drawCheckout();
    return;
  }
  const u = e.target.closest("[data-unbag]");
  if (u) { bag = bag.filter((b) => b.id !== u.dataset.unbag); syncBag(); drawBag(); drawCheckout(); }
});
$("[data-bag-open]")?.addEventListener("click", openBag);
$$("[data-bag-close]").forEach((b) => b.addEventListener("click", () => $("[data-bag]").close()));
$("[data-bag]")?.addEventListener("click", (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

/* ---------- Checkout ---------- */
function drawCheckout() {
  const box = $("[data-checkout-summary]");
  if (!box) return;
  const lines = bagLines();
  const form = $('[data-form="checkout"]');
  form.hidden = !lines.length;
  if (!lines.length) {
    box.innerHTML = '<p class="checkout__empty">Your bag is empty.</p><a class="btn" href="collections.html">Browse the collections</a>';
    return;
  }
  box.innerHTML = `<div class="checkout__lines">${lines.map(({ it, qty, price }) => `<div class="checkout__line">
      <img src="${esc(sm(it.image))}" alt="" /><span>${esc(it.name)}${qty > 1 ? ` <small>× ${qty}</small>` : ""}</span><b>${dollars(price * qty)}</b></div>`).join("")}</div>
    <dl class="bag__totals">${totalsHTML(bagTotals(lines))}</dl>
    <button type="button" class="link" data-bag-open-inline>Change quantities</button>`;
  $("[data-bag-open-inline]", box).addEventListener("click", openBag);
}
function setupCheckout() {
  const form = $('[data-form="checkout"]');
  if (!form) return;
  drawCheckout();
  const note = $(".enquiry__note", form);
  if (params.has("cancelled")) note.textContent = "Card payment was cancelled. Your bag is still here; you can try again or choose to pay after we confirm.";
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!validate(form)) return;
    const d = Object.fromEntries(new FormData(form));
    const btn = $("[data-place]", form);
    btn.disabled = true;
    btn.textContent = d.pay === "card" ? "Opening secure payment…" : "Placing your order…";
    note.textContent = "";
    try {
      const res = await fetch(`${API}/order`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "place", pay: d.pay, website: d.website,
          items: bag.map(({ id, qty }) => ({ id, qty })),
          customer: { name: d.name, phone: d.phone, email: d.email, address: d.address, city: d.city, state: d.state, zip: d.zip, notes: d.notes },
        }),
      });
      const out = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(out.error || "Something went wrong. Please try again.");
      store.set("sa-last-order", { id: out.id, token: out.token });
      if (out.url) { location.href = out.url; return; } // Stripe's payment page; the bag is cleared once it's paid
      bag = []; syncBag();
      location.href = `order-done.html?o=${encodeURIComponent(out.id)}&t=${encodeURIComponent(out.token)}`;
    } catch (x) {
      note.textContent = x.message === "Failed to fetch" ? "We couldn't reach the shop. Check your connection and try again." : x.message;
      btn.disabled = false;
      btn.textContent = "Place order";
    }
  });
}

/* ---------- Order received ---------- */
async function setupOrderDone() {
  const view = $("[data-order-view]");
  if (!view) return;
  const last = store.get("sa-last-order", {});
  const id = params.get("o") || last.id, token = params.get("t") || last.token;
  if (!id || !token) { view.innerHTML = '<p>We couldn\'t find an order on this device. If you placed one, we\'ll text you to confirm it.</p>'; return; }
  const load = async () => {
    const res = await fetch(`${API}/order`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "status", id, token }) });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(out.error || "Couldn't load your order.");
    return out.order;
  };
  const draw = (o) => {
    const c = site?.checkout || {};
    const payment = o.pay === "card"
      ? (o.paid ? '<p class="order__paid">✓ Paid by card. Thank you!</p>' : '<p class="muted">Confirming your card payment… this takes a moment.</p>')
      : `<div class="order__pay"><h2>How to pay</h2><p>${esc(o.payLater || "We'll text you to confirm your order and how to pay.").replace(/\n/g, "<br />")}</p><p class="muted">Please add your order number <b>${esc(o.id)}</b> to the payment note.</p></div>`;
    view.innerHTML = `<p class="order__lead">${esc(c.thanks || "We've got your order and will text you shortly to confirm it.")}</p>
      <p class="order__id">Order <b>${esc(o.id)}</b></p>
      ${payment}
      <div class="checkout__lines">${o.lines.map((l) => `<div class="checkout__line"><img src="${esc(sm(l.image))}" alt="" /><span>${esc(l.name)}${l.qty > 1 ? ` <small>× ${l.qty}</small>` : ""}</span><b>${dollars(l.price * l.qty)}</b></div>`).join("")}</div>
      <dl class="bag__totals">${totalsHTML(o)}</dl>
      <a class="link" href="collections.html">Keep browsing</a>`;
  };
  try {
    let o = await load();
    // The order went through, so the bag can be emptied (card orders keep it until here)
    bag = bag.filter((b) => !o.lines.some((l) => l.id === b.id)); syncBag();
    draw(o);
    for (let i = 0; o.pay === "card" && !o.paid && i < 6; i++) {
      await new Promise((r) => setTimeout(r, 3000));
      o = await load(); draw(o);
    }
  } catch (x) {
    view.innerHTML = `<p>${esc(x.message)} If you placed an order, we'll text you to confirm it.</p>`;
  }
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
    setupCheckout();
    setupOrderDone();
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
