/* Sharif Adornment — Studio.
 * Edits content/site.json and content/items.json (and uploads photos) and
 * publishes them to the GitHub repo in a single commit. GitHub Pages then
 * rebuilds the site, usually within a minute.
 *
 * Sign-in is password only. The password is checked by the Studio API, a small
 * Netlify Function (netlify/functions/), which also holds the GitHub token, so
 * neither ever reaches the browser. See netlify/lib/studio.mjs.
 * Add ?demo to the URL to try the Studio without publishing. */
(() => {
  const REPO = { owner: "upliftdigitalpartners", name: "Sharifadornment", branch: "main" };
  const FILES = { site: "content/site.json", items: "content/items.json" };
  const API = "https://sharif-adornment-studio.netlify.app/api/studio";
  const DEMO = new URLSearchParams(location.search).has("demo");
  const SESSION_KEY = "sa-studio-session";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s = "") => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const slug = (s) => String(s).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_-]+/g, "-").slice(0, 48) || "piece";
  const get = (obj, path) => path.split(".").reduce((v, k) => (v == null ? v : v[k]), obj);
  const set = (obj, path, val) => {
    const keys = path.split(".");
    const last = keys.pop();
    keys.reduce((v, k) => v[k], obj)[last] = val;
  };

  const state = {
    site: null, items: null,
    saved: { site: "", items: "" },   // JSON as last published, to detect changes
    shas: { site: "", items: "" },    // blob shas as loaded, to detect edits made elsewhere
    uploads: new Map(),               // repo path -> Blob waiting to be published
    previews: new Map(),              // repo path -> object URL (so new photos show before the site rebuilds)
    tab: "pieces", filter: "all", query: "",
  };
  const src = (path) => state.previews.get(path) || (path ? `../${path}` : "");

  /* ---------- Theme ---------- */
  $("[data-theme-toggle]").addEventListener("click", () => {
    const r = document.documentElement;
    r.dataset.theme = r.dataset.theme === "dark" ? "light" : "dark";
    try { localStorage.setItem("sa-theme", r.dataset.theme); } catch (_) { /* private mode */ }
  });

  /* ---------- Toast ---------- */
  let toastTimer;
  const toast = (msg, error = false) => {
    const t = $("[data-toast]");
    t.textContent = msg;
    t.classList.toggle("is-error", error);
    t.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("is-on"), error ? 7000 : 4000);
  };

  /* ---------- Studio API ---------- */
  async function api(endpoint, body, session) {
    let res;
    try {
      res = await fetch(`${API}/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(session ? { Authorization: `Bearer ${session}` } : {}) },
        body: JSON.stringify(body),
      });
    } catch (_) {
      const err = new Error("Couldn't reach the Studio service. Check your connection and try again.");
      err.status = 0;
      throw err;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(res.status === 429 ? "Too many tries. Wait a few minutes, then try again." :
        res.status === 404 ? "The Studio service isn't set up yet." : data.error || res.statusText);
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // A GitHub API call, made by the Studio API on our behalf
  async function gh(path, opts = {}) {
    let out;
    try {
      out = await api("github", { method: opts.method || "GET", path, body: opts.body ? JSON.parse(opts.body) : undefined }, session.get());
    } catch (x) {
      if (x.status === 401) lockOut("Your session ended. Please sign in again.");
      throw x;
    }
    if (out.status >= 400) {
      const err = new Error(out.data?.message || `GitHub said ${out.status}`);
      err.status = out.status;
      throw err;
    }
    return out.data;
  }
  const repoPath = `/repos/${REPO.owner}/${REPO.name}`;
  const fromB64 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));
  const blobToB64 = (blob) => new Promise((ok, fail) => {
    const r = new FileReader();
    r.onload = () => ok(String(r.result).split(",")[1]);
    r.onerror = fail;
    r.readAsDataURL(blob);
  });

  async function readFile(path) {
    if (DEMO) {
      const res = await fetch(`../${path}`, { cache: "no-cache" });
      return { text: await res.text(), sha: "demo" };
    }
    const f = await gh(`${repoPath}/contents/${path}?ref=${REPO.branch}`);
    return { text: fromB64(f.content), sha: f.sha };
  }

  /* ---------- Sign in (password only) ---------- */
  const lock = $("[data-lock]");
  const app = $("[data-app]");
  const session = {
    get: () => { try { return localStorage.getItem(SESSION_KEY) || ""; } catch (_) { return ""; } },
    set: (t) => { try { localStorage.setItem(SESSION_KEY, t); } catch (_) { /* blocked */ } },
    clear: () => { try { localStorage.removeItem(SESSION_KEY); } catch (_) { /* blocked */ } },
  };
  function lockOut(message = "") {
    session.clear();
    app.hidden = true;
    lock.hidden = false;
    $("[data-unlock-error]").textContent = message;
    lock.querySelector("[name=password]").focus();
  }

  $("[data-unlock]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const btn = f.querySelector("button");
    $("[data-unlock-error]").textContent = "";
    btn.disabled = true;
    btn.textContent = "Checking…";
    try {
      if (DEMO) {
        await new Promise((r) => setTimeout(r, 300));
      } else {
        const { session: s } = await api("login", { password: f.password.value });
        session.set(s);
      }
      f.reset();
      // Signing in again after a session ends keeps the edits already on screen
      if (state.site) { lock.hidden = true; app.hidden = false; render(); }
      else await start();
    } catch (x) {
      app.hidden = true;
      lock.hidden = false;
      $("[data-unlock-error]").textContent = x.message;
      f.password.select();
    } finally {
      btn.disabled = false;
      btn.textContent = "Enter";
    }
  });

  $("[data-signout]").addEventListener("click", () => {
    if (isDirty() && !confirm("You have unpublished changes. Sign out and lose them?")) return;
    session.clear();
    draft.clear().finally(() => location.reload());
  });

  // Fill in anything older content is missing, so every editor has something to work with
  const ITEM_DEFAULTS = { description: "", price: "", soldOut: false, featured: false, images: [], video: "", size: "", isNew: false, lastOne: false, rent: false, rentPrice: "", pairs: [] };
  const normalizeItem = (it) => ({ ...ITEM_DEFAULTS, ...it });
  function normalizeSite(s) {
    s.business ||= {}; s.home ||= {}; s.collections ||= []; s.story ||= { paragraphs: [], pillars: [] };
    s.order ||= { steps: [] }; s.occasion ||= {}; s.gallery ||= { images: [] }; s.contact ||= {};
    s.banner ||= { on: false, text: "", linkText: "", link: "" };
    s.footer ||= { hours: "", newsletterTitle: "", newsletterText: "" };
    s.bridal ||= { label: "Bridal", title: "", intro: "", button: "", looks: [] };
    s.bridal.looks ||= [];
    s.reviews ||= { label: "Kind words", title: "", items: [] };
    s.reviews.items ||= [];
    s.faq ||= { label: "Questions", title: "", intro: "", items: [] };
    s.faq.items ||= [];
    s.book ||= { label: "", title: "", intro: "", types: ["Video call", "Phone call"], button: "", note: "" };
    s.nav ||= { book: "Message us" };
    return s;
  }

  async function start() {
    lock.hidden = true;
    app.hidden = false;
    $("[data-view]").innerHTML = '<p class="loading">Loading…</p>';
    const [site, items] = await Promise.all([readFile(FILES.site), readFile(FILES.items)]);
    state.site = normalizeSite(JSON.parse(site.text));
    state.items = JSON.parse(items.text).map(normalizeItem);
    state.saved = { site: JSON.stringify(state.site), items: JSON.stringify(state.items) };
    state.shas = { site: site.sha, items: items.sha };
    if (DEMO) toast("Demo mode — try anything; nothing will be published.");
    render();
    await offerDraft();
  }

  /* ---------- Drafts: unpublished edits are kept on this device ----------
   * Saved (with any new photos) a moment after each change, so closing the tab,
   * a crash or a flat battery doesn't lose work. Cleared after Publish or Discard. */
  const draft = (() => {
    const KEY = DEMO ? "demo" : "draft";
    const db = () => new Promise((ok, fail) => {
      const req = indexedDB.open("sa-studio", 1);
      req.onupgradeneeded = () => req.result.createObjectStore("drafts");
      req.onsuccess = () => ok(req.result);
      req.onerror = () => fail(req.error);
    });
    const run = async (mode, fn) => {
      const d = await db();
      return new Promise((ok, fail) => {
        const tx = d.transaction("drafts", mode);
        const req = fn(tx.objectStore("drafts"));
        tx.oncomplete = () => { d.close(); ok(req.result); };
        tx.onerror = tx.onabort = () => { d.close(); fail(tx.error); };
      });
    };
    let timer;
    return {
      get: () => run("readonly", (st) => st.get(KEY)).catch(() => null),
      clear: () => { clearTimeout(timer); return run("readwrite", (st) => st.delete(KEY)).catch(() => {}); },
      // Called on every change; writes once things settle for a moment
      save() {
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (!state.site) return;
          if (!isDirty()) { draft.clear(); return; }
          run("readwrite", (st) => st.put({
            site: state.site, items: state.items, shas: state.shas, time: Date.now(), uploads: usedUploads(),
          }, KEY)).catch(() => { /* private browsing or storage full: nothing more we can do */ });
        }, 600);
      },
    };
  })();

  // After loading, offer back any edits this device didn't get to publish
  async function offerDraft() {
    const d = await draft.get();
    if (!d?.site || !d?.items) return;
    if (JSON.stringify(d.site) === state.saved.site && JSON.stringify(d.items) === state.saved.items) { draft.clear(); return; }
    const when = new Date(d.time).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" });
    const newer = d.shas && (d.shas.site !== state.shas.site || d.shas.items !== state.shas.items);
    const ask = `You have unpublished changes on this device from ${when}. Bring them back?` +
      (newer ? "\n\nNote: the site has been published since then. Bringing these back and publishing would replace those newer changes." : "");
    if (!confirm(ask)) { draft.clear(); return; }
    state.site = normalizeSite(d.site);
    state.items = d.items.map(normalizeItem);
    for (const [path, blob] of d.uploads || []) {
      state.uploads.set(path, blob);
      state.previews.set(path, URL.createObjectURL(blob));
    }
    render();
    toast("Your unpublished changes are back. Check them, then press Publish.");
  }

  /* ---------- Dirty tracking & publish bar ---------- */
  // Photos that are actually used (a photo picked and then cancelled is never uploaded)
  const usedUploads = (all = JSON.stringify(state.site) + JSON.stringify(state.items)) => {
    // A photo counts as used along with its phone copy (-sm) and, for WebP, its JPG twin
    const used = (path) => {
      const full = path.replace(/-sm(\.\w+)$/, "$1");
      return all.includes(`"${full}"`) || all.includes(`"${full.replace(/\.jpg$/, ".webp")}"`);
    };
    return [...state.uploads].filter(([path]) => used(path));
  };
  let publishing = false;
  const isDirty = () => state.site && (JSON.stringify(state.site) !== state.saved.site ||
    JSON.stringify(state.items) !== state.saved.items);
  const changed = () => {
    const dirty = isDirty();
    draft.save();
    $("[data-publish]").classList.toggle("is-dirty", dirty);
    if (publishing) return; // the publish bar shows progress until it finishes
    $("[data-status]").textContent = dirty ? "Unpublished changes" : "All changes published";
    $("[data-publish-btn]").disabled = !dirty;
    $("[data-discard]").hidden = !dirty;
  };
  addEventListener("beforeunload", (e) => { if (isDirty()) e.preventDefault(); });

  $("[data-discard]").addEventListener("click", () => {
    if (!confirm("Discard all unpublished changes?")) return;
    state.site = JSON.parse(state.saved.site);
    state.items = JSON.parse(state.saved.items);
    state.uploads.clear();
    render();
  });

  $("[data-publish-btn]").addEventListener("click", publish);

  // Preview: open the real site, drawn from these unpublished changes
  const PREVIEW_PAGE = { pieces: "collections.html", collections: "index.html", bridal: "bridal.html", reviews: "index.html", faq: "faq.html", gallery: "gallery.html" };
  $("[data-preview-btn]").addEventListener("click", () => {
    const previews = Object.fromEntries([...state.previews].filter(([path]) => state.uploads.has(path)));
    try {
      localStorage.setItem("sa-preview", JSON.stringify({ site: state.site, items: state.items, previews }));
    } catch (_) { toast("Couldn't prepare the preview on this device.", true); return; }
    open(`../${PREVIEW_PAGE[state.tab] || "index.html"}?preview=1`, "_blank");
  });

  async function publish() {
    if (DEMO) { toast("Demo mode — nothing was published."); return; }
    const btn = $("[data-publish-btn]");
    const status = $("[data-status]");
    btn.disabled = true;
    publishing = true;
    $("[data-discard]").hidden = true;
    // Publish exactly what is on screen now; edits made while it runs stay unpublished
    const snap = { site: JSON.stringify(state.site), items: JSON.stringify(state.items) };
    try {
      // Upload new photos and videos first (each is just stored data until the commit uses it)
      const ups = usedUploads(snap.site + snap.items);
      const uploads = [];
      for (const [i, [path, blob]] of ups.entries()) {
        status.textContent = `Uploading ${i + 1} of ${ups.length}…`;
        const b = await gh(`${repoPath}/git/blobs`, { method: "POST", body: JSON.stringify({ content: await blobToB64(blob), encoding: "base64" }) });
        uploads.push({ path, sha: b.sha });
      }
      // The server checks the content, rebuilds every page and commits it all at once
      status.textContent = "Publishing…";
      const out = await api("publish", { site: JSON.parse(snap.site), items: JSON.parse(snap.items), uploads, base: state.shas }, session.get());
      state.saved = snap;
      state.shas = out.shas;
      for (const u of uploads) state.uploads.delete(u.path);
      publishing = false;
      changed();
      toast(out.unchanged ? "Nothing new to publish."
        : isDirty() ? "Published. Changes made since you pressed Publish still need publishing."
        : "Published. The live site updates in about a minute.");
    } catch (x) {
      publishing = false;
      changed();
      if (x.status === 401) lockOut("Your session ended. Sign in again — your changes are still here until you leave the page.");
      else toast(x.message, true);
    }
  }

  /* ---------- Photos and videos: prepared in the browser, published later ---------- */
  async function decode(file) {
    try { return await createImageBitmap(file); } catch (_) { /* try an <img> instead */ }
    const url = URL.createObjectURL(file);
    try {
      const im = new Image();
      im.src = url;
      await im.decode();
      return im;
    } finally { setTimeout(() => URL.revokeObjectURL(url), 2000); }
  }
  // Unique even when several photos finish in the same millisecond
  let uploadCount = 0;
  const uid = () => `${Date.now().toString(36)}${(uploadCount++).toString(36)}`;
  async function addPhoto(file, name) {
    let pic;
    try { pic = await decode(file); } catch (_) {
      const heic = /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
      throw new Error(heic
        ? "This is an iPhone HEIC photo, which this browser can't open. Use Safari, or on the iPhone choose Settings → Camera → Formats → Most Compatible."
        : "That file couldn't be read as a photo. Try a JPG or PNG.");
    }
    const w = pic.naturalWidth || pic.width, h = pic.naturalHeight || pic.height;
    const make = (max, quality, type = "image/jpeg") => {
      const scale = Math.min(1, max / Math.max(w, h));
      const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(w * scale), height: Math.round(h * scale) });
      canvas.getContext("2d").drawImage(pic, 0, 0, canvas.width, canvas.height);
      return new Promise((ok) => canvas.toBlob(ok, type, quality));
    };
    // Every photo gets a 1600px copy and a 640px copy for phones. Where the browser can make
    // WebP (about half the size) the site shows those, with a JPG twin for Facebook and shops.
    const base = `assets/uploads/${slug(name || file.name.replace(/\.\w+$/, ""))}-${uid()}`;
    const files = (await canWebp())
      ? [[`${base}.webp`, await make(1600, 0.8, "image/webp")], [`${base}-sm.webp`, await make(640, 0.76, "image/webp")], [`${base}.jpg`, await make(1600, 0.82)]]
      : [[`${base}.jpg`, await make(1600, 0.82)], [`${base}-sm.jpg`, await make(640, 0.78)]];
    for (const [path, blob] of files) {
      state.uploads.set(path, blob);
      state.previews.set(path, URL.createObjectURL(blob));
    }
    return files[0][0];
  }
  // Safari can show WebP but not make it; it quietly makes a PNG instead, so check
  let webpCheck;
  const canWebp = () => (webpCheck ||= new Promise((ok) => {
    const c = Object.assign(document.createElement("canvas"), { width: 2, height: 2 });
    c.toBlob((b) => ok(b?.type === "image/webp"), "image/webp", 0.8);
  }));
  async function addVideo(file, name) {
    const ext = { "video/mp4": "mp4", "video/webm": "webm" }[file.type];
    if (!ext) throw new Error("Please choose an MP4 or WebM video.");
    if (file.size > 4 * 1024 * 1024) {
      throw new Error(`This video is ${(file.size / 1048576).toFixed(1)} MB. Videos must be under 4 MB — shorten or compress it first (the free HandBrake app works well).`);
    }
    const path = `assets/uploads/${slug(name || "video")}-${uid()}.${ext}`;
    state.uploads.set(path, file);
    state.previews.set(path, URL.createObjectURL(file));
    return path;
  }

  /* ---------- Tabs ---------- */
  $$("[data-tab]").forEach((b) => b.addEventListener("click", () => {
    state.tab = b.dataset.tab;
    $$("[data-tab]").forEach((x) => x.setAttribute("aria-selected", x === b));
    render();
    scrollTo(0, 0);
  }));

  const views = {};
  function render() {
    // A fresh element each time, so event listeners from the previous view don't pile up
    const old = $("[data-view]");
    const el = old.cloneNode(false);
    old.replaceWith(el);
    views[state.tab](el);
    changed();
  }
  const colName = (id) => state.site.collections.find((c) => c.id === id)?.name || "—";

  /* ---------- Pieces ---------- */
  views.pieces = (el) => {
    const cols = state.site.collections;
    // A collection that was deleted (or undone by Discard / Restore) can't stay as the filter
    if (!cols.some((c) => c.id === state.filter)) state.filter = "all";
    el.innerHTML = `
      <div class="view__head">
        <div><h2>Pieces</h2><p>Everything on the Collections page. Tap a photo to edit a piece, or change the price and labels right here.</p></div>
        <button class="btn" data-new-piece>+ Add piece</button>
      </div>
      <div class="toolbar">
        <input class="search" type="search" placeholder="Search pieces" value="${esc(state.query)}" data-query />
        <select class="select" data-filter-col>
          <option value="all">All collections</option>
          ${cols.map((c) => `<option value="${esc(c.id)}"${state.filter === c.id ? " selected" : ""}>${esc(c.name)}</option>`).join("")}
        </select>
        <span class="muted" data-count></span>
      </div>
      <div class="grid" data-grid></div>`;
    const draw = () => {
      const q = state.query.toLowerCase();
      const list = state.items.filter((i) => (state.filter === "all" || i.collection === state.filter) && (!q || i.name.toLowerCase().includes(q)));
      $("[data-count]", el).textContent = `${list.length} of ${state.items.length}`;
      $("[data-grid]", el).innerHTML = list.map((i) => `
        <div class="tile${i.soldOut ? " is-sold" : ""}" data-tile="${esc(i.id)}">
          <button type="button" class="tile__open" data-edit="${esc(i.id)}" aria-label="Edit ${esc(i.name)}">
            <div class="tile__img"><img src="${esc(src(i.image))}" alt="" loading="lazy" />
              <div class="tile__flags">${i.lastOne ? '<span class="flag">Last one</span>' : ""}${i.rent ? '<span class="flag">Rent</span>' : ""}${i.video ? '<span class="flag">▶</span>' : ""}</div>
            </div>
            <span class="tile__col">${esc(colName(i.collection))}</span>
            <span class="tile__name">${esc(i.name)}</span>
          </button>
          <div class="quick">
            <label class="quick__price"><span class="visually-hidden">Price of ${esc(i.name)}</span>
              <input data-qprice value="${esc(i.price)}" placeholder="Price on request" inputmode="decimal" autocomplete="off" /></label>
            <div class="quick__toggles">
              ${[["soldOut", "Sold out"], ["featured", "Featured"], ["isNew", "New"]].map(([k, label]) =>
                `<button type="button" class="quick__t" data-qt="${k}" aria-pressed="${!!i[k]}">${label}</button>`).join("")}
            </div>
          </div>
        </div>`).join("") + '<button class="tile tile--add" data-new-piece><div class="tile__img">+ Add piece</div></button>';
    };
    draw();
    $("[data-query]", el).addEventListener("input", (e) => { state.query = e.target.value; draw(); });
    $("[data-filter-col]", el).addEventListener("change", (e) => { state.filter = e.target.value; draw(); });
    const itemOf = (node) => state.items.find((i) => i.id === node.closest("[data-tile]")?.dataset.tile);
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-new-piece]")) editPiece(null);
      const t = e.target.closest("[data-edit]");
      if (t) editPiece(t.dataset.edit);
      // Quick labels: Sold out / Featured / New, without opening the piece
      const q = e.target.closest("[data-qt]");
      const it = q && itemOf(q);
      if (it) {
        it[q.dataset.qt] = !it[q.dataset.qt];
        q.setAttribute("aria-pressed", it[q.dataset.qt]);
        q.closest("[data-tile]").classList.toggle("is-sold", !!it.soldOut);
        changed();
      }
    });
    // Quick price: saved as you type
    el.addEventListener("input", (e) => {
      const it = e.target.matches("[data-qprice]") && itemOf(e.target);
      if (it) { it.price = e.target.value.trim(); changed(); }
    });
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches("[data-qprice]")) e.target.blur(); });
  };

  // Small tiles of other pieces to tick, used for "Complete the look" and bridal looks
  const pieceTicks = (selected, { exclude = "", name = "pairs" } = {}) => `<div class="ticks">${state.items.filter((x) => x.id !== exclude).map((x) => `
    <label class="tick"><input type="checkbox" name="${name}" value="${esc(x.id)}" ${selected.includes(x.id) ? "checked" : ""} />
      <img src="${esc(src(x.image))}" alt="" loading="lazy" /><span>${esc(x.name)}</span></label>`).join("")}</div>`;

  function editPiece(id) {
    const existing = state.items.find((i) => i.id === id);
    const it = normalizeItem(existing ? structuredClone(existing) : { id: "", name: "", collection: state.filter !== "all" ? state.filter : state.site.collections[0]?.id, image: "" });
    const dlg = $("[data-editor]");
    dlg.innerHTML = `
      <form method="dialog" novalidate>
        <div class="editor__media">
          <img data-preview src="${esc(src(it.image))}" alt="" ${it.image ? "" : "hidden"} />
          <label class="btn btn--ghost">${it.image ? "Replace main photo" : "Choose photos"}<input type="file" accept="image/*" ${it.image ? "" : "multiple"} data-file /></label>
          <div class="editor__more">
            <span class="mini-label">More photos <small>— pick several at once</small></span>
            <div class="thumbs" data-thumbs></div>
            <label class="btn btn--ghost">+ Add more photos<input type="file" accept="image/*" multiple data-more /></label>
            <p class="muted photo-status" data-photo-status hidden></p>
          </div>
          <div class="editor__more">
            <span class="mini-label">Video <small>(MP4, under 4 MB)</small></span>
            <div data-video-box></div>
            <label class="add-link file-link">${it.video ? "Replace video" : "+ Add a video"}<input type="file" accept="video/mp4,video/webm" data-video /></label>
          </div>
          <small class="muted">Portrait photos (4:5) look best. Photos are resized automatically.</small>
        </div>
        <div class="editor__body">
          <h2>${existing ? "Edit piece" : "New piece"}</h2>
          <label class="field"><span>Name</span><input name="name" required value="${esc(it.name)}" /></label>
          <label class="field"><span>Collection (category)</span>
            <select name="collection">${state.site.collections.map((c) => `<option value="${esc(c.id)}"${c.id === it.collection ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
          </label>
          <div class="field-pair">
            <label class="field"><span>Price</span><input name="price" value="${esc(it.price)}" placeholder="Empty = “Price on request”" /></label>
            <label class="field"><span>Size / length</span><input name="size" value="${esc(it.size)}" placeholder="e.g. Bangle 2.6, adjustable" /></label>
          </div>
          <label class="field"><span>Description</span><textarea name="description" rows="3">${esc(it.description)}</textarea></label>
          <div class="editor__checks">
            <label class="check"><input type="checkbox" name="featured" ${it.featured ? "checked" : ""} /> <span>Feature on home page</span></label>
            <label class="check"><input type="checkbox" name="isNew" ${it.isNew ? "checked" : ""} /> <span>New</span></label>
            <label class="check"><input type="checkbox" name="lastOne" ${it.lastOne ? "checked" : ""} /> <span>Last one</span></label>
            <label class="check"><input type="checkbox" name="soldOut" ${it.soldOut ? "checked" : ""} /> <span>Sold out</span></label>
            <label class="check"><input type="checkbox" name="rent" ${it.rent ? "checked" : ""} /> <span>Available to rent</span></label>
          </div>
          <label class="field" data-rent-price ${it.rent ? "" : "hidden"}><span>Rental price</span><input name="rentPrice" value="${esc(it.rentPrice)}" placeholder="e.g. $40 for 3 days" /></label>
          <details class="field picks" ${it.pairs.length ? "open" : ""}>
            <summary><span>Complete the look</span> <small data-pick-count>${it.pairs.length ? `${it.pairs.length} chosen` : "Pick up to 3 — or leave empty and we'll suggest some"}</small></summary>
            ${pieceTicks(it.pairs, { exclude: it.id })}
          </details>
          <div class="editor__foot">
            ${existing ? '<button type="button" class="btn btn--danger" data-delete>Delete</button>' : ""}
            ${existing ? '<button type="button" class="btn btn--danger" data-top>Move to top</button>' : ""}
            <span class="spacer"></span>
            <button type="button" class="btn btn--ghost" data-cancel>Cancel</button>
            <button type="submit" class="btn">Done</button>
          </div>
        </div>
      </form>`;
    let image = it.image;
    let images = [...it.images];
    let video = it.video;
    const drawThumbs = () => {
      $("[data-thumbs]", dlg).innerHTML = images.map((p, i) => `<figure><img src="${esc(src(p))}" alt="" />
        <button type="button" data-thumb-left="${i}" aria-label="Move earlier" ${i ? "" : "disabled"}>←</button>
        <button type="button" class="thumb-main" data-thumb-main="${i}">Make main</button>
        <button type="button" data-thumb-del="${i}" aria-label="Remove photo">×</button></figure>`).join("") || '<p class="muted">None yet.</p>';
      $("[data-video-box]", dlg).innerHTML = video ? `<div class="video-row"><video src="${esc(src(video))}" muted playsinline></video><button type="button" class="add-link" data-video-del>Remove video</button></div>` : "";
    };
    drawThumbs();
    $("form", dlg).addEventListener("click", (e) => {
      const l = e.target.closest("[data-thumb-left]"), d = e.target.closest("[data-thumb-del]");
      if (l) { const i = +l.dataset.thumbLeft; [images[i - 1], images[i]] = [images[i], images[i - 1]]; drawThumbs(); }
      if (d) { images.splice(+d.dataset.thumbDel, 1); drawThumbs(); }
      const m = e.target.closest("[data-thumb-main]");
      if (m) { const i = +m.dataset.thumbMain; [image, images[i]] = [images[i], image]; images = images.filter(Boolean); showMain(); drawThumbs(); }
      if (e.target.closest("[data-video-del]")) { video = ""; drawThumbs(); }
    });
    const form = $("form", dlg);
    const nameNow = () => $("[name=name]", dlg).value || "piece";
    const showMain = () => { const img = $("[data-preview]", dlg); img.src = src(image); img.hidden = !image; };
    // Phone photos take a moment each, so show progress and hold "Done" until they're ready
    let busy = 0;
    const done = $("[type=submit]", dlg);
    async function takePhotos(files, first) {
      files = [...files];
      if (!files.length) return;
      busy++; done.disabled = true;
      const status = $("[data-photo-status]", dlg);
      status.hidden = false;
      for (const [n, file] of files.entries()) {
        status.textContent = `Preparing photo ${n + 1} of ${files.length}…`;
        try {
          const path = await addPhoto(file, nameNow());
          if (!form.isConnected) return; // the editor was closed meanwhile
          if (first && n === 0) { image = path; showMain(); } else { images.push(path); drawThumbs(); }
        } catch (x) { toast(x.message, true); }
      }
      if (--busy === 0) { done.disabled = false; status.hidden = true; }
    }
    $("[data-file]", dlg).addEventListener("change", async (e) => { await takePhotos(e.target.files, true); e.target.value = ""; });
    $("[data-more]", dlg).addEventListener("change", async (e) => { await takePhotos(e.target.files, false); e.target.value = ""; });
    $("[data-video]", dlg).addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try { video = await addVideo(file, nameNow()); drawThumbs(); } catch (x) { toast(x.message, true); }
    });
    $("[name=rent]", dlg).addEventListener("change", (e) => { $("[data-rent-price]", dlg).hidden = !e.target.checked; });
    $(".ticks", dlg).addEventListener("change", (e) => {
      const ticked = $$("[name=pairs]:checked", dlg);
      if (ticked.length > 3) { e.target.checked = false; toast("Choose up to 3 pieces."); }
      const n = $$("[name=pairs]:checked", dlg).length;
      $("[data-pick-count]", dlg).textContent = n ? `${n} chosen` : "Pick up to 3 — or leave empty and we'll suggest some";
    });
    $("[data-cancel]", dlg).addEventListener("click", () => dlg.close());
    $("[data-delete]", dlg)?.addEventListener("click", () => {
      if (!confirm(`Delete “${it.name}”?`)) return;
      state.items = state.items.filter((i) => i.id !== id);
      for (const x of state.items) x.pairs = x.pairs.filter((p) => p !== id);
      for (const l of state.site.bridal.looks) l.pieces = (l.pieces || []).filter((p) => p !== id);
      dlg.close(); render();
    });
    // Move to top saves the form first, so nothing typed is lost
    let toTop = false;
    $("[data-top]", dlg)?.addEventListener("click", () => {
      toTop = true;
      form.requestSubmit();
      toTop = false;
    });
    $("form", dlg).addEventListener("submit", (e) => {
      const f = e.target;
      if (busy) { e.preventDefault(); toast("One moment — still preparing your photos."); return; }
      const name = f.name.value.trim();
      if (!name) { e.preventDefault(); f.name.focus(); return; }
      if (!image) { e.preventDefault(); toast("Add a main photo for this piece.", true); return; }
      const data = {
        ...it, name, image, images, video,
        collection: f.collection.value,
        price: f.price.value.trim(),
        size: f.size.value.trim(),
        description: f.description.value.trim(),
        featured: f.featured.checked,
        isNew: f.isNew.checked,
        lastOne: f.lastOne.checked,
        soldOut: f.soldOut.checked,
        rent: f.rent.checked,
        rentPrice: f.rent.checked ? f.rentPrice.value.trim() : "",
        pairs: $$("[name=pairs]:checked", dlg).map((x) => x.value),
      };
      if (existing) {
        state.items[state.items.indexOf(existing)] = data;
        if (toTop) {
          state.items = [data, ...state.items.filter((i) => i !== data)];
          toast("Moved to the top of the Collections page.");
        }
      } else {
        let nid = slug(name);
        while (state.items.some((i) => i.id === nid)) nid += "-2";
        data.id = nid;
        state.items.unshift(data);
      }
      render();
    });
    dlg.showModal();
  }

  /* ---------- Collections ---------- */
  views.collections = (el) => {
    el.innerHTML = `
      <div class="view__head">
        <div><h2>Collections</h2><p>The groups shown on the home page and as filters on the Collections page.</p></div>
        <button class="btn" data-new-col>+ Add collection</button>
      </div>
      <div class="rows">${state.site.collections.map((c) => {
        const n = state.items.filter((i) => i.collection === c.id).length;
        return `<button class="row" data-col="${esc(c.id)}">
          <img src="${esc(src(c.image))}" alt="" loading="lazy" />
          <div><h3>${esc(c.name)}</h3><p>${esc(c.text)}</p></div>
          <span class="count">${n} piece${n === 1 ? "" : "s"}</span>
        </button>`;
      }).join("")}</div>`;
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-new-col]")) editCollection(null);
      const r = e.target.closest("[data-col]");
      if (r) editCollection(r.dataset.col);
    });
  };

  function editCollection(id) {
    const cols = state.site.collections;
    const existing = cols.find((c) => c.id === id);
    const c = existing ? { ...existing } : { id: "", name: "", text: "", image: "" };
    const count = state.items.filter((i) => i.collection === id).length;
    const idx = cols.indexOf(existing);
    const dlg = $("[data-editor]");
    dlg.innerHTML = `
      <form method="dialog" novalidate>
        <div class="editor__media">
          <img data-preview src="${esc(src(c.image))}" alt="" ${c.image ? "" : "hidden"} />
          <label class="btn btn--ghost">${c.image ? "Replace cover" : "Choose cover"}<input type="file" accept="image/*" data-file /></label>
        </div>
        <div class="editor__body">
          <h2>${existing ? "Edit collection" : "New collection"}</h2>
          <label class="field"><span>Name</span><input name="name" required value="${esc(c.name)}" /></label>
          <label class="field"><span>Description</span><textarea name="text" rows="3">${esc(c.text)}</textarea></label>
          <div class="editor__foot">
            ${existing ? `<button type="button" class="btn btn--danger" data-delete ${count ? `title="Move or delete its ${count} pieces first" disabled` : ""}>Delete</button>` : ""}
            ${existing && idx > 0 ? '<button type="button" class="btn btn--danger" data-up>Move earlier</button>' : ""}
            <span class="spacer"></span>
            <button type="button" class="btn btn--ghost" data-cancel>Cancel</button>
            <button type="submit" class="btn">Done</button>
          </div>
        </div>
      </form>`;
    let image = c.image;
    let busy = false;
    let moveUp = false;
    const form = $("form", dlg);
    const done = $("[type=submit]", dlg);
    $("[data-file]", dlg).addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      busy = true; done.disabled = true;
      try {
        const path = await addPhoto(file, `collection-${$("[name=name]", dlg).value || "cover"}`);
        if (!form.isConnected) return;
        image = path;
        const img = $("[data-preview]", dlg);
        img.src = src(image); img.hidden = false;
      } catch (x) { toast(x.message, true); }
      finally { busy = false; done.disabled = false; e.target.value = ""; }
    });
    $("[data-cancel]", dlg).addEventListener("click", () => dlg.close());
    $("[data-delete]", dlg)?.addEventListener("click", () => {
      if (!confirm(`Delete the “${c.name}” collection?`)) return;
      state.site.collections = cols.filter((x) => x !== existing);
      dlg.close(); render();
    });
    $("[data-up]", dlg)?.addEventListener("click", () => {
      moveUp = true;
      form.requestSubmit();
      moveUp = false;
    });
    $("form", dlg).addEventListener("submit", (e) => {
      const f = e.target;
      if (busy) { e.preventDefault(); toast("One moment — still preparing the photo."); return; }
      const name = f.name.value.trim();
      if (!name) { e.preventDefault(); f.name.focus(); return; }
      if (!image) { e.preventDefault(); toast("Add a cover photo for this collection.", true); return; }
      const data = { ...c, name, text: f.text.value.trim(), image };
      if (existing) {
        cols[idx] = data;
        if (moveUp) { cols.splice(idx, 1); cols.splice(idx - 1, 0, data); }
      } else {
        let nid = slug(name);
        while (cols.some((x) => x.id === nid)) nid += "-2";
        cols.push({ ...data, id: nid });
      }
      render();
    });
    dlg.showModal();
  }

  /* ---------- Pages (all wording) ---------- */
  const PAGES = [
    ["Announcement banner", [
      ["banner.on", "Show the banner at the top of every page", "check"], ["banner.text", "Banner text", "area"],
      ["banner.linkText", "Link text (optional)"], ["banner.link", "Link — a page like collections.html, or a full https:// address"],
    ]],
    ["Home", [
      ["home.label", "Small line above the headline"], ["home.title", "Headline", "area"], ["home.intro", "Intro", "area"],
      ["home.button", "Main button"], ["nav.book", "Message button text — top bar and home page (opens Messenger)"], ["home.heroImage", "Hero photo (shows before the video plays)", "image"],
      ["home.collectionsLabel", "Collections — small label"], ["home.collectionsTitle", "Collections — heading"],
      ["home.featuredLabel", "Featured — small label"], ["home.featuredTitle", "Featured — heading"], ["home.storyLink", "Story link"],
    ]],
    ["Collections page", [["collectionsPage.label", "Small label"], ["collectionsPage.title", "Heading"], ["collectionsPage.intro", "Intro", "area"]]],
    ["Our story", [
      ["story.label", "Small label"], ["story.title", "Heading"], ["story.paragraphs", "Story — leave an empty line between paragraphs", "paras"],
      ["story.image", "Photo", "image"], ["story.pillars", "Highlights", "pairs"],
    ]],
    ["How to order", [["order.label", "Small label"], ["order.title", "Heading"], ["order.steps", "Steps", "pairs"]]],
    ["Occasion band", [["occasion.label", "Small label"], ["occasion.title", "Heading", "area"], ["occasion.text", "Text", "area"], ["occasion.button", "Button"]]],
    ["Gallery page", [
      ["gallery.label", "Small label"], ["gallery.title", "Heading"], ["gallery.link", "Facebook link text"],
      ["gallery.facebookFeed", "Offer to show our latest Facebook posts", "check"], ["gallery.feedTitle", "Facebook section heading"],
    ]],
    ["Enquire page", [["contact.label", "Small label"], ["contact.title", "Heading"], ["contact.text", "Text", "area"], ["contact.button", "Form button"]]],
    ["Footer", [
      ["footer.hours", "Short line under the logo"], ["footer.newsletterTitle", "Newsletter heading"], ["footer.newsletterText", "Newsletter text", "area"],
      ["reviews.label", "Reviews — small label"], ["reviews.title", "Reviews — heading"],
    ]],
  ];

  function fieldHTML([path, label, type = "text", hint = ""]) {
    const v = get(state.site, path);
    const h = hint ? `<small>${hint}</small>` : "";
    if (type === "check") return `<label class="check"><input type="checkbox" data-check="${path}" ${v ? "checked" : ""} /> <span>${label}</span></label>`;
    if (type === "area") return `<label class="field"><span>${label}</span><textarea data-path="${path}" rows="2">${esc(v)}</textarea>${h}</label>`;
    if (type === "lines") return `<label class="field"><span>${label}</span><textarea data-lines="${path}" rows="3">${esc((v || []).join("\n"))}</textarea>${h}</label>`;
    if (type === "paras") return `<label class="field"><span>${label}</span><textarea data-paras="${path}" rows="7">${esc((v || []).join("\n\n"))}</textarea>${h}</label>`;
    if (type === "image") return `<div class="field"><span>${label}</span><div class="picker"><img src="${esc(src(v))}" alt="" data-img="${path}" ${v ? "" : 'class="is-empty"'} />
      <span><label class="btn btn--ghost">${v ? "Replace photo" : "Choose photo"}<input type="file" accept="image/*" data-image="${path}" /></label>
      ${hint.includes("optional") && v ? `<button type="button" class="add-link" data-clear="${path}">Remove photo</button>` : ""}</span></div>${h}</div>`;
    if (type === "video") return `<div class="field"><span>${label}</span><div class="picker">${v ? `<video src="${esc(src(v))}" muted playsinline></video>` : '<span class="muted">No video</span>'}
      <span><label class="btn btn--ghost">${v ? "Replace video" : "Upload video"}<input type="file" accept="video/mp4,video/webm" data-video-path="${path}" /></label>
      ${v ? `<button type="button" class="add-link" data-clear="${path}">Remove</button>` : ""}</span></div>${h}</div>`;
    if (type === "pairs") return `<div class="field"><span>${label}</span><div class="group__fields" data-pairs="${path}">
      ${(v || []).map((p, i) => `<div class="pair">
        <label class="field"><span>Title</span><input data-path="${path}.${i}.title" value="${esc(p.title)}" /></label>
        <label class="field"><span>Text</span><input data-path="${path}.${i}.text" value="${esc(p.text)}" /></label>
        <button type="button" class="btn btn--danger" data-remove-pair="${path}" data-i="${i}">Remove</button></div>`).join("")}
      <button type="button" class="add-link" data-add-pair="${path}">+ Add</button></div></div>`;
    return `<label class="field"><span>${label}</span><input data-path="${path}" value="${esc(v)}" />${h}</label>`;
  }

  views.pages = (el) => {
    el.innerHTML = `
      <div class="view__head"><div><h2>Pages</h2><p>Every heading and message on the site.</p></div></div>
      <p class="hint">Tip: wrap words in <em>*asterisks*</em> to show them in gold italics, like <em>*every celebration.*</em></p>
      ${PAGES.map(([title, fields]) => `<section class="group"><h3>${title}</h3><div class="group__fields">${fields.map(fieldHTML).join("")}</div></section>`).join("")}`;
    bindFields(el);
  };

  // One set of listeners for every text, photo, list and checkbox field in a view
  function bindFields(el) {
    el.addEventListener("input", (e) => {
      const t = e.target;
      if (t.dataset.path) { set(state.site, t.dataset.path, t.value); changed(); }
      if (t.dataset.paras) { set(state.site, t.dataset.paras, t.value.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)); changed(); }
      if (t.dataset.lines) { set(state.site, t.dataset.lines, t.value.split("\n").map((p) => p.trim()).filter(Boolean)); changed(); }
    });
    el.addEventListener("change", async (e) => {
      const t = e.target;
      if (t.dataset.check) { set(state.site, t.dataset.check, t.checked); changed(); return; }
      try {
        if (t.dataset.image && t.files[0]) { set(state.site, t.dataset.image, await addPhoto(t.files[0], t.dataset.image.split(".")[0])); render(); }
        if (t.dataset.videoPath && t.files[0]) { set(state.site, t.dataset.videoPath, await addVideo(t.files[0], "video")); render(); }
      } catch (x) { toast(x.message, true); }
    });
    el.addEventListener("click", (e) => {
      const add = e.target.closest("[data-add-pair]");
      const rm = e.target.closest("[data-remove-pair]");
      const clear = e.target.closest("[data-clear]");
      if (add) { get(state.site, add.dataset.addPair).push({ title: "", text: "" }); render(); }
      if (rm) { get(state.site, rm.dataset.removePair).splice(+rm.dataset.i, 1); render(); }
      if (clear) { set(state.site, clear.dataset.clear, ""); render(); }
    });
  }

  // Move or remove an entry in a list (looks, reviews, questions)
  function listTools(path, i, len) {
    return `<div class="list-tools">
      <button type="button" data-list-move="${path}" data-i="${i}" data-dir="-1" ${i ? "" : "disabled"} aria-label="Move up">↑</button>
      <button type="button" data-list-move="${path}" data-i="${i}" data-dir="1" ${i < len - 1 ? "" : "disabled"} aria-label="Move down">↓</button>
      <button type="button" class="del" data-list-del="${path}" data-i="${i}">Remove</button></div>`;
  }
  function bindList(el) {
    el.addEventListener("click", (e) => {
      const m = e.target.closest("[data-list-move]"), d = e.target.closest("[data-list-del]"), a = e.target.closest("[data-list-add]");
      if (m) { const list = get(state.site, m.dataset.listMove), i = +m.dataset.i, j = i + +m.dataset.dir; [list[i], list[j]] = [list[j], list[i]]; render(); }
      if (d && confirm("Remove this?")) { get(state.site, d.dataset.listDel).splice(+d.dataset.i, 1); render(); }
      if (a) { get(state.site, a.dataset.listAdd).push(JSON.parse(a.dataset.blank)); render(); }
    });
  }

  /* ---------- Bridal ---------- */
  views.bridal = (el) => {
    const looks = state.site.bridal.looks;
    el.innerHTML = `
      <div class="view__head"><div><h2>Bridal</h2><p>The Bridal page: complete looks made from your pieces.</p></div></div>
      <section class="group"><h3>Page</h3><div class="group__fields">
        ${[["bridal.label", "Small label"], ["bridal.title", "Heading"], ["bridal.intro", "Intro", "area"], ["bridal.button", "Button (opens the enquiry form)"]].map(fieldHTML).join("")}
      </div></section>
      ${looks.map((l, i) => `<section class="group card-block"><h3>Look ${i + 1}</h3><div class="group__fields">
        ${fieldHTML([`bridal.looks.${i}.image`, "Photo", "image"])}
        ${fieldHTML([`bridal.looks.${i}.title`, "Title"])}
        ${fieldHTML([`bridal.looks.${i}.text`, "Description", "area"])}
        <details class="field picks" open><summary><span>Pieces in this look</span></summary>${pieceTicks(l.pieces || [], { name: `look-${i}` })}</details>
        ${listTools("bridal.looks", i, looks.length)}
      </div></section>`).join("")}
      <button type="button" class="btn btn--ghost" data-list-add="bridal.looks" data-blank='{"title":"","text":"","image":"","pieces":[]}'>+ Add a look</button>`;
    bindFields(el);
    bindList(el);
    el.addEventListener("change", (e) => {
      const m = /^look-(\d+)$/.exec(e.target.name || "");
      if (!m) return;
      looks[+m[1]].pieces = $$(`[name="look-${m[1]}"]:checked`, el).map((x) => x.value);
      changed();
    });
  };

  /* ---------- Reviews ---------- */
  views.reviews = (el) => {
    const list = state.site.reviews.items;
    el.innerHTML = `
      <div class="view__head"><div><h2>Reviews</h2><p>Shown on the home and Bridal pages. The section stays hidden until you add one.</p></div></div>
      <p class="hint">Only add real reviews from customers — ideally with their permission to show their name and photo.</p>
      ${list.map((r, i) => `<section class="group card-block"><h3>Review ${i + 1}</h3><div class="group__fields">
        ${fieldHTML([`reviews.items.${i}.text`, "What they said", "area"])}
        <div class="field-pair">${fieldHTML([`reviews.items.${i}.name`, "Name", "text"])}${fieldHTML([`reviews.items.${i}.occasion`, "Occasion (optional)"])}</div>
        ${fieldHTML([`reviews.items.${i}.image`, "Photo", "image", "optional"])}
        ${listTools("reviews.items", i, list.length)}
      </div></section>`).join("")}
      <button type="button" class="btn btn--ghost" data-list-add="reviews.items" data-blank='{"name":"","occasion":"","text":"","image":""}'>+ Add a review</button>`;
    bindFields(el);
    bindList(el);
  };

  /* ---------- FAQ ---------- */
  views.faq = (el) => {
    const list = state.site.faq.items;
    el.innerHTML = `
      <div class="view__head"><div><h2>FAQ</h2><p>Questions and answers on the FAQ page. Google can show these in search results.</p></div></div>
      <section class="group"><h3>Page</h3><div class="group__fields">
        ${[["faq.label", "Small label"], ["faq.title", "Heading"], ["faq.intro", "Intro", "area"]].map(fieldHTML).join("")}
      </div></section>
      ${list.map((q, i) => `<section class="group card-block"><h3>Q${i + 1}</h3><div class="group__fields">
        ${fieldHTML([`faq.items.${i}.q`, "Question"])}
        ${fieldHTML([`faq.items.${i}.a`, "Answer", "area"])}
        ${listTools("faq.items", i, list.length)}
      </div></section>`).join("")}
      <button type="button" class="btn btn--ghost" data-list-add="faq.items" data-blank='{"q":"","a":""}'>+ Add a question</button>`;
    bindFields(el);
    bindList(el);
  };

  /* ---------- Analytics ---------- */
  const ANALYTICS_HEAD = '<div class="view__head"><div><h2>Analytics</h2><p>How people use the site. Anonymous: no names, no cookies, nothing personal.</p></div></div>';
  views.stats = (el) => {
    el.innerHTML = `${ANALYTICS_HEAD}<p class="loading">Loading…</p>`;
    if (DEMO) { drawStats(el, sampleStats(), true); return; }
    api("stats", {}, session.get()).then((data) => drawStats(el, data)).catch((x) => {
      if (x.status === 401) lockOut("Please sign in again.");
      else $(".loading", el).textContent = `Couldn't load analytics (${x.message}).`;
    });
  };

  // Made-up numbers so the page can be tried in demo mode
  function sampleStats() {
    const ids = state.items.map((i) => i.id);
    const pick = (n, f) => Object.fromEntries(ids.slice(0, n).map((id, i) => [id, f(i)]));
    const now = new Date();
    const month = (back) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1)).toISOString().slice(0, 7);
    const days = (n, base) => Object.fromEntries(Array.from({ length: n }, (_, i) => [String(i + 1).padStart(2, "0"), Math.round(base * (0.6 + 0.8 * Math.abs(Math.sin(i * 1.7))))]));
    return {
      months: {
        [month(0)]: {
          visit: { all: 412 }, page: { "/index.html": 380, "/collections.html": 310, "/bridal.html": 96, "/gallery.html": 54, "/faq.html": 31, "/contact.html": 22 },
          dayVisits: days(now.getUTCDate(), 34), dayPages: days(now.getUTCDate(), 80),
          source: { facebook: 214, direct: 98, instagram: 41, google: 37, whatsapp: 15, other: 7 }, device: { phone: 331, computer: 62, tablet: 19 },
          view: pick(14, (i) => 90 - i * 6), ask: { ...pick(6, (i) => 12 - i * 2), "general-enquiry": 5 }, save: pick(8, (i) => 20 - i * 2), share: pick(4, (i) => 6 - i),
        },
        [month(1)]: { visit: { all: 356 }, page: { "/index.html": 300 }, view: pick(10, (i) => 70 - i * 5), ask: pick(5, () => 6), save: pick(5, () => 4) },
      },
      subscribers: [{ email: "sample@example.com", date: now.toISOString() }],
    };
  }

  function drawStats(el, data, sample = false) {
    const months = Object.keys(data.months);
    let m = months[0];
    const name = (id) => state.items.find((i) => i.id === id)?.name || id;
    const PAGE_NAMES = { "/index.html": "Home", "/collections.html": "Collections", "/bridal.html": "Bridal", "/story.html": "Our story", "/order.html": "How to order", "/gallery.html": "Gallery", "/faq.html": "FAQ", "/contact.html": "Enquire" };
    const pageName = (p) => PAGE_NAMES[p] || (p.startsWith("/p/") ? name(p.slice(3).replace(".html", "")) : p);
    const SOURCES = { facebook: "Facebook", direct: "Typed in or bookmarked", instagram: "Instagram", google: "Google", whatsapp: "WhatsApp", other: "Other websites" };
    const DEVICES = { phone: "Phone", computer: "Computer", tablet: "Tablet" };
    const sum = (obj = {}) => Object.values(obj).reduce((a, b) => a + b, 0);
    const fmt = (n) => n.toLocaleString();
    const monthName = (k, opts = { month: "long", year: "numeric" }) => new Date(`${k}-15T12:00:00`).toLocaleDateString(undefined, opts);

    // A number tile, with the change from the month before when there's something to compare
    const tile = (label, now, before, prevName, note = "") => {
      let delta = "";
      if (before > 0) {
        const pct = Math.round(((now - before) / before) * 100);
        delta = `<small class="delta">${pct > 0 ? "▲" : pct < 0 ? "▼" : "●"} ${Math.abs(pct)}% vs ${esc(prevName)}</small>`;
      }
      return `<div><span>${label}</span><b>${now == null ? "—" : fmt(now)}</b>${delta}${note ? `<small>${note}</small>` : ""}</div>`;
    };

    // Horizontal bars: one hue, labelled, longest first
    const bars = (obj = {}, label = (k) => k, n = 8) => {
      const rows = Object.entries(obj).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]).slice(0, n);
      if (!rows.length) return '<p class="muted">Nothing yet.</p>';
      const max = rows[0][1];
      const total = sum(obj);
      return `<ol class="hbars">${rows.map(([k, v]) => `<li>
        <span class="hbars__label">${esc(label(k))}</span>
        <span class="hbars__value">${fmt(v)}<small>${Math.round((v / total) * 100)}%</small></span>
        <span class="hbars__track"><i style="width:${Math.max(2, (v / max) * 100)}%"></i></span></li>`).join("")}</ol>`;
    };

    // Columns per day of the month, with a hover/tap tooltip and a table to read the numbers
    // Drawn at the screen's own width, so the axis text stays readable on phones
    const chartW = () => Math.round(Math.min(720, Math.max(300, (el.clientWidth || 720) - 22)));
    const dayChart = (perDay, unit, monthKey) => {
      const [yr, mo] = monthKey.split("-").map(Number);
      const count = new Date(yr, mo, 0).getDate();
      const vals = Array.from({ length: count }, (_, i) => perDay[String(i + 1).padStart(2, "0")] || 0);
      const top = Math.max(...vals);
      const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000].find((s) => s * 4 >= top) || Math.ceil(top / 4);
      const yMax = Math.max(step * Math.ceil(top / step), step);
      const W = chartW(), H = W < 500 ? 180 : 220, L = 30, R = 4, T = 12, B = 26;
      const band = (W - L - R) / count;
      const bw = Math.max(2, Math.min(16, band - 2));
      const y = (v) => T + (H - T - B) * (1 - v / yMax);
      const ticks = Array.from({ length: Math.round(yMax / step) + 1 }, (_, i) => i * step);
      const shown = new Set(W < 500 ? [1, 10, 20, count] : [1, 5, 10, 15, 20, 25, count]);
      const col = (v, i) => {
        if (!v) return "";
        const x = L + band * i + (band - bw) / 2, top = y(v), base = y(0), r = Math.min(4, (base - top) / 2, bw / 2);
        return `<path d="M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + bw - r}Q${x + bw},${top} ${x + bw},${top + r}V${base}Z"/>`;
      };
      return `<div class="chart" data-chart>
        <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(unit)} per day in ${esc(monthName(monthKey))}">
          <g class="chart__grid">${ticks.map((t) => `<line x1="${L}" x2="${W - R}" y1="${y(t)}" y2="${y(t)}"/><text x="${L - 8}" y="${y(t) + 4}" text-anchor="end">${t >= 1000 ? `${t / 1000}K` : t}</text>`).join("")}</g>
          <g class="chart__x">${vals.map((_, i) => shown.has(i + 1) ? `<text x="${L + band * i + band / 2}" y="${H - 6}" text-anchor="middle">${i + 1}</text>` : "").join("")}</g>
          <g class="chart__cols">${vals.map(col).join("")}</g>
          <rect class="chart__hover" x="0" y="0" width="0" height="${H - T - B}" />
        </svg>
        <div class="chart__tip" hidden></div>
      </div>
      <details class="chart__table"><summary>Show as a table</summary>
        <table><thead><tr><th>Day</th><th>${esc(unit)}</th></tr></thead><tbody>${vals.map((v, i) => `<tr><td>${monthName(monthKey, { month: "short" })} ${i + 1}</td><td>${fmt(v)}</td></tr>`).join("")}</tbody></table>
      </details>`;
    };
    const bindChart = (perDay, unit, monthKey) => {
      const box = $("[data-chart]", el);
      if (!box) return;
      const svg = $("svg", box), tip = $(".chart__tip", box), hover = $(".chart__hover", box);
      const [y, mo] = monthKey.split("-").map(Number);
      const count = new Date(y, mo, 0).getDate();
      const W = svg.viewBox.baseVal.width, L = 30, R = 4, T = 12, band = (W - L - R) / count;
      const show = (e) => {
        const r = svg.getBoundingClientRect();
        const x = ((e.clientX - r.left) / r.width) * W;
        const i = Math.floor((x - L) / band);
        if (i < 0 || i >= count) { tip.hidden = true; hover.setAttribute("width", 0); return; }
        const v = perDay[String(i + 1).padStart(2, "0")] || 0;
        hover.setAttribute("x", L + band * i); hover.setAttribute("y", T); hover.setAttribute("width", band);
        tip.innerHTML = `<b>${fmt(v)}</b> ${esc(unit.toLowerCase())}<br><small>${monthName(monthKey, { month: "short" })} ${i + 1}</small>`;
        tip.hidden = false;
        const px = ((L + band * i + band / 2) / W) * r.width;
        tip.style.left = `${Math.min(Math.max(px, 50), r.width - 50)}px`;
      };
      svg.addEventListener("pointermove", show);
      svg.addEventListener("pointerdown", show);
      svg.addEventListener("pointerleave", () => { tip.hidden = true; hover.setAttribute("width", 0); });
    };

    const draw = () => {
      const d = data.months[m] || {};
      const prevKey = months[months.indexOf(m) + 1];
      const p = (prevKey && data.months[prevKey]) || {};
      const prevName = prevKey ? monthName(prevKey, { month: "long" }) : "";
      const hasVisits = sum(d.visit) > 0;
      const perDay = hasVisits ? d.dayVisits : d.dayPages;
      const unit = hasVisits ? "Visits" : "Page views";
      const general = d.ask?.["general-enquiry"] || 0;
      const pieceAsks = { ...(d.ask || {}) }; delete pieceAsks["general-enquiry"];

      // Collections, from the pieces viewed in each
      const byCol = {};
      for (const [id, v] of Object.entries(d.view || {})) {
        const c = state.items.find((i) => i.id === id)?.collection;
        if (c) byCol[c] = (byCol[c] || 0) + v;
      }
      const colName = (id) => state.site.collections.find((c) => c.id === id)?.name || id;

      // Every piece with any activity, most viewed first
      const ids = [...new Set([d.view, pieceAsks, d.save, d.share].flatMap((o) => Object.keys(o || {})))];
      const rows = ids.map((id) => [id, d.view?.[id] || 0, pieceAsks[id] || 0, d.save?.[id] || 0, d.share?.[id] || 0])
        .sort((a, b) => b[1] - a[1] || b[2] - a[2]).slice(0, 20);

      el.innerHTML = `
        <div class="view__head"><div><h2>Analytics</h2><p>${sample ? "<b>Sample numbers</b> — demo mode. " : ""}How people use the site. Anonymous: no names, no cookies, nothing personal.</p></div>
          <select class="select" data-month aria-label="Month">${months.map((x) => `<option value="${x}" ${x === m ? "selected" : ""}>${esc(monthName(x))}</option>`).join("")}</select></div>
        <div class="stat-cards">
          ${tile("Visits", hasVisits ? sum(d.visit) : null, sum(p.visit), prevName, hasVisits ? "" : "Counted from this update on")}
          ${tile("Page views", sum(d.page), sum(p.page), prevName)}
          ${tile("Pieces viewed", sum(d.view), sum(p.view), prevName)}
          ${tile("Questions sent", sum(d.ask), sum(p.ask), prevName, general ? `${fmt(general)} from the enquiry form` : "")}
          ${tile("Pieces saved", sum(d.save), sum(p.save), prevName)}
        </div>
        <section class="stat-block"><h3>${unit} per day</h3>
          ${sum(perDay) ? dayChart(perDay || {}, unit, m) : '<p class="muted">Daily numbers are counted from this update on.</p>'}
        </section>
        <div class="stat-grid">
          <section><h3>Where visitors come from</h3>${bars(d.source, (k) => SOURCES[k] || k)}</section>
          <section><h3>Devices</h3>${bars(d.device, (k) => DEVICES[k] || k)}</section>
          <section><h3>Collections</h3><p class="muted small">Piece views in each collection</p>${bars(byCol, colName, 12)}</section>
          <section><h3>Pages</h3>${bars(d.page, pageName, 10)}</section>
        </div>
        <section class="stat-block"><h3>Pieces</h3>
          ${rows.length ? `<div class="table-wrap"><table class="stat-table">
            <thead><tr><th>Piece</th><th>Views</th><th>Questions</th><th>Saves</th><th>Shares</th></tr></thead>
            <tbody>${rows.map(([id, ...n]) => `<tr><td>${esc(name(id))}</td>${n.map((v) => `<td>${v ? fmt(v) : '<span class="muted">–</span>'}</td>`).join("")}</tr>`).join("")}</tbody>
          </table></div>` : '<p class="muted">Nothing yet.</p>'}
        </section>
        <section class="group"><h3>Newsletter <small>${data.subscribers.length}</small></h3><div class="group__fields">
          ${data.subscribers.length ? `<button type="button" class="btn btn--ghost" data-copy-emails>Copy all emails</button>
          <ol class="stat-list">${data.subscribers.map((s) => `<li><span>${esc(s.email)}</span><small class="muted">${new Date(s.date).toLocaleDateString()}</small>
            <button type="button" class="add-link" data-unsub="${esc(s.email)}">Remove</button></li>`).join("")}</ol>` : '<p class="muted">No sign-ups yet.</p>'}
        </div></section>`;
      if (sum(perDay)) bindChart(perDay, unit, m);
    };
    draw();
    el.addEventListener("change", (e) => { if (e.target.matches("[data-month]")) { m = e.target.value; draw(); } });
    el.addEventListener("click", async (e) => {
      if (e.target.closest("[data-copy-emails]")) {
        try { await navigator.clipboard.writeText(data.subscribers.map((s) => s.email).join(", ")); toast("Emails copied — paste them into your email's To or Bcc field."); } catch (_) { toast("Couldn't copy. Select the emails and copy them instead.", true); }
      }
      const u = e.target.closest("[data-unsub]");
      if (u && !sample && confirm(`Remove ${u.dataset.unsub} from the newsletter list?`)) {
        try { data = await api("stats", { unsubscribe: u.dataset.unsub }, session.get()); draw(); } catch (x) { toast(x.message, true); }
      }
    });
  }

  /* ---------- History: bring back an earlier version ---------- */
  views.history = (el) => {
    el.innerHTML = `<div class="view__head"><div><h2>History</h2><p>Every published version. Restoring one loads it here as unpublished changes, so you can check it and then publish.</p></div></div><p class="loading">Loading…</p>`;
    if (DEMO) { $(".loading", el).textContent = "History appears here once the site is live."; return; }
    const q = (file) => gh(`${repoPath}/commits?path=${encodeURIComponent(file)}&sha=${REPO.branch}&per_page=30`);
    Promise.all([q(FILES.site), q(FILES.items)]).then(([a, b]) => {
      const seen = new Set();
      const list = [...a, ...b].filter((c) => !seen.has(c.sha) && seen.add(c.sha))
        .sort((x, y) => y.commit.committer.date.localeCompare(x.commit.committer.date)).slice(0, 30);
      el.innerHTML = el.innerHTML.replace(/<p class="loading">.*<\/p>/, "") + `<ol class="history">${list.map((c, i) => `<li>
        <div><b>${new Date(c.commit.committer.date).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</b>
        <span class="muted">${esc(c.commit.message.split("\n")[0])}</span></div>
        ${i ? `<button type="button" class="btn btn--ghost" data-restore="${c.sha}">Restore</button>` : '<span class="flag flag--gold">Live now</span>'}</li>`).join("")}</ol>`;
    }).catch((x) => { $(".loading", el).textContent = `Couldn't load the history (${x.message}).`; });
    el.addEventListener("click", async (e) => {
      const r = e.target.closest("[data-restore]");
      if (!r) return;
      if (isDirty() && !confirm("This replaces your unpublished changes. Continue?")) return;
      r.disabled = true;
      try {
        const at = async (file) => {
          try { const f = await gh(`${repoPath}/contents/${file}?ref=${r.dataset.restore}`); return JSON.parse(fromB64(f.content)); } catch (_) { return null; }
        };
        const [site, items] = await Promise.all([at(FILES.site), at(FILES.items)]);
        if (!site || !items) throw new Error("That version can't be restored.");
        state.site = normalizeSite(site);
        state.items = items.map(normalizeItem);
        state.tab = "pieces";
        $$("[data-tab]").forEach((x) => x.setAttribute("aria-selected", x.dataset.tab === "pieces"));
        render();
        toast("Restored as unpublished changes. Check it over, then press Publish.");
      } catch (x) { r.disabled = false; toast(x.message, true); }
    });
  };

  /* ---------- Gallery ---------- */
  views.gallery = (el) => {
    const imgs = state.site.gallery.images;
    el.innerHTML = `
      <div class="view__head"><div><h2>Gallery</h2><p>Photos on the Gallery page, in this order. The description helps search engines and screen readers.</p></div></div>
      <div class="ggrid">
        ${imgs.map((g, i) => `<div class="gcard">
          <img src="${esc(src(g.src))}" alt="" loading="lazy" />
          <input data-alt="${i}" value="${esc(g.alt)}" placeholder="Short description" />
          <div class="gcard__tools">
            <span><button data-move="${i}" data-dir="-1" aria-label="Move earlier" ${i ? "" : "disabled"}>←</button><button data-move="${i}" data-dir="1" aria-label="Move later" ${i < imgs.length - 1 ? "" : "disabled"}>→</button></span>
            <button class="del" data-del="${i}">Remove</button>
          </div></div>`).join("")}
        <label class="gadd">+ Add photos<input type="file" accept="image/*" multiple data-gadd /></label>
      </div>`;
    el.addEventListener("input", (e) => { const i = e.target.dataset.alt; if (i != null) { imgs[i].alt = e.target.value; changed(); } });
    el.addEventListener("click", (e) => {
      const m = e.target.closest("[data-move]");
      const d = e.target.closest("[data-del]");
      if (m) { const i = +m.dataset.move, j = i + +m.dataset.dir; [imgs[i], imgs[j]] = [imgs[j], imgs[i]]; render(); }
      if (d && confirm("Remove this photo from the gallery?")) { imgs.splice(+d.dataset.del, 1); render(); }
    });
    $("[data-gadd]", el).addEventListener("change", async (e) => {
      for (const file of e.target.files) {
        try { imgs.push({ src: await addPhoto(file, "gallery"), alt: "" }); } catch (_) { toast(`Skipped ${file.name}: not a readable photo.`, true); }
      }
      render();
    });
  };

  /* ---------- Details ---------- */
  views.details = (el) => {
    el.innerHTML = `
      <div class="view__head"><div><h2>Details</h2><p>Contact details used across the site, the phone bar and every “Ask” button.</p></div></div>
      <section class="group"><h3>Contact</h3><div class="group__fields">
        ${fieldHTML(["business.phone", "Phone", "text", "Used for the Call button and for messages sent from phones."])}
        ${fieldHTML(["business.whatsapp", "WhatsApp number", "text", "Optional. When set, “Ask about this piece” opens WhatsApp, and WhatsApp buttons appear."])}
        ${fieldHTML(["business.email", "Email", "text", "Optional. If set, desktop enquiries open an email."])}
        ${fieldHTML(["business.location", "Location line"])}
      </div></section>
      <section class="group"><h3>Links</h3><div class="group__fields">
        ${fieldHTML(["business.messenger", "Messenger link", "text", "Full address starting with https://"])}
        ${fieldHTML(["business.facebook", "Facebook page", "text", "Full address starting with https://"])}
        ${fieldHTML(["business.instagram", "Instagram page", "text", "Optional. Full address, e.g. https://www.instagram.com/yourname/"])}
      </div></section>
      <section class="group"><h3>Hero video</h3><div class="group__fields">
        ${fieldHTML(["home.heroVideo", "Video (computers)", "video", "MP4 under 4 MB. Leave empty to show the hero photo only."])}
        ${fieldHTML(["home.heroVideoMobile", "Video (phones)", "video", "A smaller copy for phones. Optional — the computer video is used if empty."])}
      </div></section>`;
    bindFields(el);
  };

  /* ---------- Boot: go straight in with a valid session, else ask for the password ---------- */
  if (!DEMO && session.get()) {
    start().catch((x) => { if (x.status !== 401) lockOut(`Couldn't load the site content (${x.message}).`); });
  } else {
    lock.hidden = false;
    lock.querySelector("[name=password]").focus();
  }
})();
