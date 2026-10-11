/* Sharif Adornment — UI (no dependencies) */
(() => {
  const cfg = window.SITE_CONFIG || {};
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const coarse = matchMedia("(pointer: coarse)").matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  /* ---------- Config → DOM ---------- */
  const hrefFor = {
    facebook: cfg.facebook,
    messenger: cfg.messenger,
    email: cfg.email && `mailto:${cfg.email}`,
    phone: cfg.phone && `tel:+1${cfg.phone.replace(/[^\d]/g, "").slice(-10)}`,
  };
  $$("[data-config]").forEach((el) => { if (hrefFor[el.dataset.config]) el.href = hrefFor[el.dataset.config]; });
  $$("[data-config-row]").forEach((el) => { el.hidden = !cfg[el.dataset.configRow]; });
  $$("[data-config-text]").forEach((el) => { el.textContent = cfg[el.dataset.configText] || ""; });
  $$(".js-year").forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ---------- Hero video (optional, see js/config.js) ---------- */
  const hero = $("[data-hero]");
  const small = matchMedia("(max-width: 860px)").matches;
  const heroSrc = (small && cfg.heroVideoMobile) || cfg.heroVideo;
  if (hero && heroSrc && !reduceMotion) {
    const v = document.createElement("video");
    Object.assign(v, { muted: true, loop: true, playsInline: true, autoplay: true, preload: "auto" });
    v.setAttribute("aria-hidden", "true");
    v.addEventListener("playing", () => hero.classList.add("is-playing"), { once: true });
    v.src = heroSrc;
    hero.appendChild(v);
  }

  /* ---------- Gallery (built from SITE_CONFIG.gallery) ---------- */
  const gallery = $("[data-gallery]");
  if (gallery) {
    (cfg.gallery || []).forEach((entry) => {
      const [file, alt = ""] = entry.split("|");
      const fig = document.createElement("figure");
      fig.className = "reveal";
      const src = `assets/gallery/${file}`;
      if (/\.(mp4|webm|mov)$/i.test(file)) {
        const v = document.createElement("video");
        Object.assign(v, { src, muted: true, loop: true, playsInline: true, preload: "metadata" });
        v.setAttribute("aria-hidden", "true");
        fig.appendChild(v);
      } else {
        const img = document.createElement("img");
        Object.assign(img, { src, alt, loading: "lazy", decoding: "async" });
        img.addEventListener("error", () => fig.remove());
        fig.appendChild(img);
      }
      gallery.appendChild(fig);
    });
    // Play reels only while they're on screen
    const vio = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? e.target.play().catch(() => {}) : e.target.pause()));
    }, { threshold: 0.2 });
    if (!reduceMotion) $$("video", gallery).forEach((v) => vio.observe(v));
  }

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

  /* ---------- Phone dock: shows after the hero, hides at the contact section ---------- */
  const dock = $("[data-dock]");
  if (dock) {
    let pastHero = false, atContact = false;
    const update = () => dock.classList.toggle("is-visible", pastHero && !atContact);
    addEventListener("scroll", () => { pastHero = scrollY > innerHeight * 0.55; update(); }, { passive: true });
    new IntersectionObserver(([e]) => { atContact = e.isIntersecting; update(); }).observe($(".enquiry"));
  }

  /* ---------- Collection cards pre-select the enquiry topic ---------- */
  const topic = $("#f-topic");
  $$("[data-topic]").forEach((el) => el.addEventListener("click", () => {
    const opt = [...topic.options].find((o) => o.text === el.dataset.topic);
    if (opt) topic.value = opt.value;
  }));

  /* ---------- Reveal on scroll (staggered within a group) ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
  $$(".reveal").forEach((el) => {
    const siblings = $$(":scope > .reveal", el.parentElement);
    el.style.setProperty("--d", `${Math.min(siblings.indexOf(el), 5) * 0.08}s`);
    io.observe(el);
  });

  /* ---------- Enquiry form ---------- */
  const form = $(".enquiry");
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

    const phoneDigits = (cfg.phone || "").replace(/[^\d]/g, "");
    if (coarse && phoneDigits) {
      // On phones: open a pre-filled text message.
      location.href = `sms:+1${phoneDigits.slice(-10)}?&body=${encodeURIComponent(body)}`;
      note.textContent = "Opening your messages app…";
      return;
    }
    if (cfg.email) {
      const subject = `Enquiry — ${d.topic}`;
      location.href = `mailto:${cfg.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
      note.textContent = "Opening your email app…";
      return;
    }
    // Desktop without email: copy the note and hand off to Messenger.
    try { await navigator.clipboard.writeText(body); } catch (_) { /* clipboard may be blocked */ }
    note.textContent = "Your message is copied — paste it into Messenger and we'll reply there.";
    window.open(cfg.messenger || cfg.facebook, "_blank", "noopener");
  });
})();
