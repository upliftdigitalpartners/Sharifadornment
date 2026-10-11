/* Sharif Adornment — UI interactions (no dependencies) */
(() => {
  const cfg = window.SITE_CONFIG || {};
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
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
  $$("[data-config]").forEach((el) => {
    const href = hrefFor[el.dataset.config];
    if (href) { el.href = href; el.hidden = false; }
    else if (el.dataset.config === "email" || el.dataset.config === "phone") el.hidden = true;
  });
  $$("[data-config-text]").forEach((el) => { el.textContent = cfg[el.dataset.configText] || ""; });
  $$(".js-year").forEach((el) => { el.textContent = new Date().getFullYear(); });

  /* ---------- Gallery (built from SITE_CONFIG.gallery) ---------- */
  const mosaic = $("[data-gallery]");
  if (mosaic) {
    (cfg.gallery || []).forEach((entry) => {
      const [file, size] = entry.split("|");
      const fig = document.createElement("figure");
      fig.className = `mosaic__item reveal${size ? " m-" + size : ""}`;
      const src = `assets/gallery/${file}`;
      if (/\.(mp4|webm|mov)$/i.test(file)) {
        fig.classList.add("has-art");
        const v = document.createElement("video");
        Object.assign(v, { src, muted: true, loop: true, playsInline: true, preload: "metadata" });
        v.setAttribute("aria-hidden", "true");
        v.addEventListener("loadeddata", () => fig.classList.add("is-video-loaded"));
        fig.appendChild(v);
      } else {
        fig.dataset.img = src;
      }
      mosaic.appendChild(fig);
    });
    // Play reels only while they're on screen
    const vio = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? e.target.play().catch(() => {}) : e.target.pause()));
    }, { threshold: 0.2 });
    $$("video", mosaic).forEach((v) => vio.observe(v));
  }

  /* ---------- Images: placeholder art until the real photo loads ---------- */
  $$("[data-img]").forEach((el) => {
    const target = el.querySelector(".card__media, .frame__img") || el;
    target.classList.add("has-art");
    const url = new URL(el.dataset.img, document.baseURI).href;
    const img = new Image();
    img.onload = () => {
      target.style.setProperty("--img", `url("${url}")`);
      target.classList.add("is-img-loaded");
    };
    img.src = url;
  });

  /* ---------- Loader ---------- */
  const bar = $(".loader__bar span");
  let progress = 0;
  const tick = setInterval(() => {
    progress = Math.min(progress + Math.random() * 18, 90);
    if (bar) bar.style.width = progress + "%";
  }, 160);
  let done = false;
  const finishLoading = () => {
    if (done) return;
    done = true;
    clearInterval(tick);
    if (bar) bar.style.width = "100%";
    setTimeout(() => {
      document.body.classList.remove("is-loading");
      document.body.classList.add("is-ready");
    }, 350);
  };
  // scene.js dispatches "stage:ready"; never wait more than a few seconds.
  window.addEventListener("stage:ready", finishLoading, { once: true });
  window.addEventListener("load", () => setTimeout(finishLoading, 1200));
  setTimeout(finishLoading, 4500);

  /* ---------- Nav ---------- */
  const nav = $(".nav");
  const toggle = $(".nav__toggle");
  const onScroll = () => nav.classList.toggle("is-scrolled", scrollY > 40);
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();
  toggle.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", open);
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  });
  $$(".nav__links a").forEach((a) => a.addEventListener("click", () => {
    nav.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
  }));

  /* ---------- Reveal on scroll (staggered within a group) ---------- */
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("is-in");
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.08 });
  $$(".reveal").forEach((el) => {
    const siblings = $$(":scope > .reveal", el.parentElement);
    el.style.setProperty("--d", `${Math.min(siblings.indexOf(el), 6) * 0.09}s`);
    io.observe(el);
  });

  /* ---------- Parallax ---------- */
  const parallax = $$(".parallax");
  const updateParallax = () => {
    parallax.forEach((el) => {
      const r = el.parentElement.getBoundingClientRect();
      const offset = (r.top + r.height / 2 - innerHeight / 2) * parseFloat(el.dataset.speed || 0.1);
      el.style.transform = `translate3d(0, ${offset}px, 0)`;
    });
  };
  if (!reduceMotion && parallax.length) {
    addEventListener("scroll", () => requestAnimationFrame(updateParallax), { passive: true });
    updateParallax();
  }

  /* ---------- Desktop-only flourishes ---------- */
  if (finePointer && !reduceMotion) {
    // Custom cursor
    const cursor = $(".cursor");
    let cx = innerWidth / 2, cy = innerHeight / 2, tx = cx, ty = cy;
    addEventListener("mousemove", (e) => { tx = e.clientX; ty = e.clientY; cursor.classList.add("is-visible"); });
    document.addEventListener("mouseleave", () => cursor.classList.remove("is-visible"));
    (function loop() {
      cx += (tx - cx) * 0.2;
      cy += (ty - cy) * 0.2;
      cursor.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      requestAnimationFrame(loop);
    })();
    $$("a, button, .card, .mosaic__item, input, textarea, select").forEach((el) => {
      el.addEventListener("mouseenter", () => cursor.classList.add("is-hover"));
      el.addEventListener("mouseleave", () => cursor.classList.remove("is-hover"));
    });

    // Magnetic buttons
    $$(".magnetic").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - r.left - r.width / 2;
        const y = e.clientY - r.top - r.height / 2;
        el.style.transform = `translate(${x * 0.18}px, ${y * 0.3}px)`;
      });
      el.addEventListener("mouseleave", () => { el.style.transform = ""; });
    });

    // 3D tilt + sheen on collection cards
    $$(".tilt").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.transform = `rotateY(${(px - 0.5) * 10}deg) rotateX(${(0.5 - py) * 10}deg)`;
        el.style.setProperty("--mx", `${px * 100}%`);
        el.style.setProperty("--my", `${py * 100}%`);
      });
      el.addEventListener("mouseleave", () => { el.style.transform = ""; });
    });
  }

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
