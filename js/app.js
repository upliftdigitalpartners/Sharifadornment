/* Sharif Adornment — site script (no dependencies).
 * Text, collections, pieces and gallery come from content/site.json and
 * content/items.json, which the Studio (/studio/) edits. */
(() => {
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = matchMedia("(pointer: coarse)").matches;
  const small = matchMedia("(max-width: 860px)").matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const params = new URLSearchParams(location.search);

  const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  // *words* become gold italics
  const rich = (s = "") => esc(s).replace(/\*(.+?)\*/g, "<em>$1</em>");
  const get = (obj, path) => path.split(".").reduce((v, k) => (v == null ? v : v[k]), obj);
  const telHref = (p) => `tel:+1${String(p).replace(/[^\d]/g, "").slice(-10)}`;

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

  /* ---------- Nav ---------- */
  const nav = $(".nav");
  const toggle = $(".nav__toggle");
  const onScroll = () => nav.classList.toggle("is-scrolled", scrollY > 24);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  const setMenu = (open) => {
    nav.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open);
    toggle.textContent = open ? "Close" : "Menu";
    document.body.style.overflow = open ? "hidden" : "";
  };
  toggle.addEventListener("click", () => setMenu(!nav.classList.contains("is-open")));
  $$(".nav__links a").forEach((a) => a.addEventListener("click", () => setMenu(false)));
  addEventListener("keydown", (e) => { if (e.key === "Escape") setMenu(false); });
  $$(".js-year").forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ---------- Reveal on scroll ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
  const reveal = (scope = document) => $$(".reveal:not(.is-in)", scope).forEach((el) => {
    const siblings = $$(":scope > .reveal", el.parentElement);
    el.style.setProperty("--d", `${Math.min(siblings.indexOf(el), 5) * 0.08}s`);
    io.observe(el);
  });
  reveal();

  /* ---------- Phone dock: shows after the first screen, hides at the form ---------- */
  const dock = $("[data-dock]");
  const form = $(".enquiry");
  if (dock) {
    let past = false, atForm = false;
    const update = () => dock.classList.toggle("is-visible", past && !atForm);
    addEventListener("scroll", () => { past = scrollY > innerHeight * 0.55; update(); }, { passive: true });
    if (form) new IntersectionObserver(([e]) => { atForm = e.isIntersecting; update(); }).observe(form);
  }

  /* ---------- Content ---------- */
  const load = (f) => fetch(`content/${f}`, { cache: "no-cache" }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)));
  Promise.all([load("site.json"), load("items.json")])
    .then(([site, items]) => render(site, items))
    .catch((err) => console.warn("Content failed to load", err));

  function render(site, items) {
    const b = site.business || {};
    const collections = site.collections || [];
    const colName = Object.fromEntries(collections.map((c) => [c.id, c.name]));

    // Simple bindings
    $$("[data-t]").forEach((el) => { const v = get(site, el.dataset.t); if (typeof v === "string") el.innerHTML = rich(v); });
    $$("[data-src]").forEach((el) => { const v = get(site, el.dataset.src); if (v && el.getAttribute("src") !== v) el.src = v; });
    $$("[data-href]").forEach((el) => { const v = get(site, el.dataset.href); if (v) el.href = v; });
    $$("[data-tel]").forEach((el) => { const v = get(site, el.dataset.tel); if (v) el.href = telHref(v); else el.hidden = true; });
    $$("[data-mailto]").forEach((el) => { const v = get(site, el.dataset.mailto); if (v) el.href = `mailto:${v}`; });
    $$("[data-if]").forEach((el) => { el.hidden = !get(site, el.dataset.if); });
    $$("[data-paragraphs]").forEach((el) => {
      el.innerHTML = (get(site, el.dataset.paragraphs) || []).map((p) => `<p>${esc(p)}</p>`).join("");
    });

    // Hero video
    const hero = $("[data-hero]");
    const heroSrc = (small && site.home?.heroVideoMobile) || site.home?.heroVideo;
    if (hero && heroSrc && !reduceMotion) {
      const v = document.createElement("video");
      Object.assign(v, { muted: true, loop: true, playsInline: true, autoplay: true, preload: "auto" });
      v.setAttribute("aria-hidden", "true");
      v.addEventListener("playing", () => hero.classList.add("is-playing"), { once: true });
      v.src = heroSrc;
      hero.appendChild(v);
    }

    // Collection cards (home)
    const colGrid = $("[data-collections]");
    if (colGrid) {
      colGrid.innerHTML = collections.map((c, i) => `
        <a class="piece reveal" href="collections.html?c=${encodeURIComponent(c.id)}">
          <div class="piece__img"><img src="${esc(c.image)}" alt="${esc(c.name)}" loading="lazy" width="1000" height="1250" /></div>
          <div class="piece__meta"><span>${String(i + 1).padStart(2, "0")}</span><h3>${esc(c.name)}</h3></div>
          <p>${esc(c.text)}</p>
        </a>`).join("");
    }

    // Piece cards
    const card = (it) => `
      <button class="item reveal${it.soldOut ? " is-sold" : ""}" type="button" data-item="${esc(it.id)}">
        <div class="item__img"><img src="${esc(it.image)}" alt="${esc(it.name)}" loading="lazy" width="1000" height="1250" />${it.soldOut ? '<span class="item__badge">Sold out</span>' : ""}</div>
        <span class="item__col">${esc(colName[it.collection] || "")}</span>
        <span class="item__name">${esc(it.name)}</span>
        <span class="item__price">${esc(it.price || "Price on request")}</span>
      </button>`;

    const featured = $("[data-featured]");
    if (featured) {
      const list = items.filter((i) => i.featured);
      $("[data-featured-section]").hidden = !list.length;
      featured.innerHTML = list.map(card).join("");
      // On the home page, a featured piece opens it on the collections page
      $$("[data-item]", featured).forEach((el) => el.addEventListener("click", () => {
        location.href = `collections.html?piece=${encodeURIComponent(el.dataset.item)}`;
      }));
    }

    // Collections page: filters + grid + detail sheet
    const grid = $("[data-items]");
    if (grid) {
      const filters = $("[data-filters]");
      let active = collections.some((c) => c.id === params.get("c")) ? params.get("c") : "all";
      const drawFilters = () => {
        filters.innerHTML = [{ id: "all", name: "All" }, ...collections.filter((c) => items.some((i) => i.collection === c.id))]
          .map((c) => `<button type="button" class="chip" data-filter="${esc(c.id)}" aria-pressed="${c.id === active}">${esc(c.name)}</button>`).join("");
      };
      const drawGrid = () => {
        const list = items.filter((i) => active === "all" || i.collection === active);
        grid.innerHTML = list.length ? list.map(card).join("") : '<p class="empty">New pieces are on the way — message us to ask what\'s in stock.</p>';
        reveal(grid);
      };
      filters.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-filter]");
        if (!btn) return;
        active = btn.dataset.filter;
        history.replaceState(null, "", active === "all" ? "collections.html" : `?c=${active}`);
        drawFilters(); drawGrid();
      });
      drawFilters(); drawGrid();

      const sheet = $("[data-sheet]");
      const open = (id) => {
        const it = items.find((i) => i.id === id);
        if (!it) return;
        $(".sheet__img img", sheet).src = it.image;
        $(".sheet__img img", sheet).alt = it.name;
        $("[data-sheet-collection]", sheet).textContent = colName[it.collection] || "";
        $("[data-sheet-name]", sheet).textContent = it.name;
        $("[data-sheet-price]", sheet).textContent = it.soldOut ? "Sold out — ask about similar pieces" : (it.price || "Price on request");
        $("[data-sheet-desc]", sheet).textContent = it.description || "";
        $("[data-sheet-ask]", sheet).href = `contact.html?piece=${encodeURIComponent(it.id)}`;
        sheet.showModal();
        document.body.style.overflow = "hidden";
      };
      grid.addEventListener("click", (e) => { const b = e.target.closest("[data-item]"); if (b) open(b.dataset.item); });
      sheet.addEventListener("close", () => { document.body.style.overflow = ""; });
      sheet.addEventListener("click", (e) => { if (e.target === sheet || e.target.closest("[data-sheet-close]")) sheet.close(); });
      if (params.get("piece")) open(params.get("piece"));
    }

    // Steps, pillars
    const steps = $("[data-steps]");
    if (steps) steps.innerHTML = (site.order?.steps || []).map((s, i) => `
      <li class="reveal"><span>${String(i + 1).padStart(2, "0")}</span><h3>${esc(s.title)}</h3><p>${esc(s.text)}</p></li>`).join("");
    const pillars = $("[data-pillars]");
    if (pillars) pillars.innerHTML = (site.story?.pillars || []).map((p) => `<div><dt>${esc(p.title)}</dt><dd>${esc(p.text)}</dd></div>`).join("");

    // Gallery
    const gallery = $("[data-gallery]");
    if (gallery) {
      gallery.innerHTML = (site.gallery?.images || []).map((g) => /\.(mp4|webm|mov)$/i.test(g.src)
        ? `<figure class="reveal"><video src="${esc(g.src)}" muted loop playsinline preload="metadata" aria-hidden="true"></video></figure>`
        : `<figure class="reveal"><img src="${esc(g.src)}" alt="${esc(g.alt)}" loading="lazy" decoding="async" /></figure>`).join("");
      const vio = new IntersectionObserver((entries) => {
        entries.forEach((e) => (e.isIntersecting ? e.target.play().catch(() => {}) : e.target.pause()));
      }, { threshold: 0.2 });
      if (!reduceMotion) $$("video", gallery).forEach((v) => vio.observe(v));
    }

    // Enquiry form: topics from the collections, pre-filled from ?piece= or ?c=
    const topics = $("[data-topics]");
    if (topics) {
      topics.innerHTML = [...collections.map((c) => c.name), "Help me choose"].map((n) => `<option>${esc(n)}</option>`).join("");
      const piece = items.find((i) => i.id === params.get("piece"));
      const col = collections.find((c) => c.id === (piece?.collection || params.get("c")));
      topics.value = col ? col.name : "Help me choose";
      if (piece) $("#f-msg").value = `I'd like to ask about the ${piece.name}.`;
    }
    if (form) setupForm(b);

    reveal();
  }

  /* ---------- Enquiry form ---------- */
  function setupForm(b) {
    const note = $(".enquiry__note");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      let valid = true;
      $$("[required]", form).forEach((input) => {
        const bad = !input.value.trim();
        input.closest(".field").classList.toggle("is-invalid", bad);
        if (bad) valid = false;
      });
      if (!valid) { note.textContent = "Please fill in each field so we can reply."; return; }

      const d = Object.fromEntries(new FormData(form));
      const body = `Name: ${d.name}\nContact: ${d.contact}\nInterested in: ${d.topic}\n\n${d.message}`;
      const phoneDigits = (b.phone || "").replace(/[^\d]/g, "");
      if (coarse && phoneDigits) {
        // On phones: open a pre-filled text message.
        location.href = `sms:+1${phoneDigits.slice(-10)}?&body=${encodeURIComponent(body)}`;
        note.textContent = "Opening your messages app…";
        return;
      }
      if (b.email) {
        location.href = `mailto:${b.email}?subject=${encodeURIComponent(`Enquiry — ${d.topic}`)}&body=${encodeURIComponent(body)}`;
        note.textContent = "Opening your email app…";
        return;
      }
      // Desktop without email: copy the note and hand off to Messenger.
      try { await navigator.clipboard.writeText(body); } catch (_) { /* clipboard may be blocked */ }
      note.textContent = "Your message is copied — paste it into Messenger and we'll reply there.";
      window.open(b.messenger || b.facebook, "_blank", "noopener");
    });
  }
})();
