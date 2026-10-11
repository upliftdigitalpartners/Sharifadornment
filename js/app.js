/* Sharif Adornment — site script.
 * The pages arrive fully built (shared/pages.mjs); this adds the interactive
 * parts: quick view, saved pieces, asking about a piece, search and filters,
 * photo zoom, forms, night mode and the Studio's preview mode. */
import { esc, rich, bannerHTML, pieceDetail, itemCard, collectionCard, stepsHTML, pillarsHTML, paragraphsHTML, faqHTML, reviewsHTML, lookHTML, galleryHTML, priceLine, money, pieceUrl, waNumber } from "../shared/render.mjs";

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
  t.classList.add("is-on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("is-on"), 4200);
}

/* ---------- Stats (anonymous counts, no cookies) ---------- */
const PREVIEW = params.has("preview");
const tracking = !PREVIEW && navigator.doNotTrack !== "1" && !/^(localhost|127\.)/.test(location.hostname);
function track(e, id = "") {
  if (!tracking) return;
  try { navigator.sendBeacon(`${API}/track`, JSON.stringify({ e, id, p: location.pathname.replace(/\/$/, "/index.html") })); } catch (_) { /* ignore */ }
}
track("page");

/* ---------- Night mode ---------- */
const root = document.documentElement;
const themeBtn = $("[data-theme-toggle]");
const setThemeLabel = () => {
  const dark = root.dataset.theme === "dark";
  themeBtn?.setAttribute("aria-label", dark ? "Switch to day mode" : "Switch to night mode");
  themeBtn?.setAttribute("title", dark ? "Day mode" : "Night mode");
  $('meta[name="theme-color"]')?.setAttribute("content", dark ? "#151413" : "#f6f3ee");
};
setThemeLabel();
themeBtn?.addEventListener("click", () => {
  root.dataset.theme = root.dataset.theme === "dark" ? "light" : "dark";
  try { localStorage.setItem("sa-theme", root.dataset.theme); } catch (_) { /* private mode */ }
  setThemeLabel();
});

/* ---------- Banner ---------- */
const banner = $("[data-banner]");
if (banner) {
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
  let active = params.get("c") && (site.collections || []).some((c) => c.id === params.get("c")) ? params.get("c") : (params.get("c") === "rent" ? "rent" : "all");
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

/* ---------- Forms: enquiry, booking, newsletter ---------- */
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
      track("ask", piece?.id || "");
      handoff(enquiry, `Name: ${d.name}\nContact: ${d.contact}\nInterested in: ${d.topic}\n\n${d.message}`, `Enquiry — ${d.topic}`);
    });
  }
  const book = $('[data-form="book"]');
  if (book) {
    const date = $("#b-date", book);
    date.min = new Date().toISOString().slice(0, 10);
    const pieces = saved.map(byId).filter(Boolean);
    if (pieces.length) $("#b-notes", book).value = `Pieces I saved: ${pieces.map((p) => p.name).join(", ")}`;
    book.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!validate(book)) return;
      const d = Object.fromEntries(new FormData(book));
      const when = new Date(`${d.date}T12:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
      track("book");
      handoff(book, `Appointment request\nName: ${d.name}\nContact: ${d.contact}\nType: ${d.type}\nPreferred: ${when}, ${d.time.toLowerCase()}\nOccasion: ${d.occasion || "—"}\n\n${d.notes || ""}`.trim(), `Appointment — ${d.type}`);
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
  set("[data-collections]", (site.collections || []).map(collectionCard).join(""));
  set("[data-featured]", items.filter((i) => i.featured).map((it) => itemCard(it, site)).join(""));
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
  if (site.banner?.on) $(".skip").insertAdjacentHTML("afterend", bannerHTML(site.banner));
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
    if (onPiecePage) track("view", $("[data-piece]")?.dataset.piece);
    else if (params.get("piece") && $("[data-items]")) openPiece(params.get("piece"), { push: false });
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
