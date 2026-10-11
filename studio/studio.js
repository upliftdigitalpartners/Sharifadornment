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
      await start();
    } catch (x) {
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
    location.reload();
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
    s.book ||= { label: "", title: "", intro: "", types: ["Visit in Queens", "Video call"], button: "", note: "" };
    s.nav ||= { book: "Book a visit" };
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
  }

  /* ---------- Dirty tracking & publish bar ---------- */
  // Photos that are actually used (a photo picked and then cancelled is never uploaded)
  const usedUploads = () => {
    const all = JSON.stringify(state.site) + JSON.stringify(state.items);
    const used = (path) => all.includes(`"${path}"`) || all.includes(`"${path.replace(/-sm(\.\w+)$/, "$1")}"`);
    return [...state.uploads].filter(([path]) => used(path));
  };
  const isDirty = () => state.site && (JSON.stringify(state.site) !== state.saved.site ||
    JSON.stringify(state.items) !== state.saved.items);
  const changed = () => {
    const dirty = isDirty();
    $("[data-publish]").classList.toggle("is-dirty", dirty);
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
    try {
      // Upload new photos and videos first (each is just stored data until the commit uses it)
      const ups = usedUploads();
      const uploads = [];
      for (const [i, [path, blob]] of ups.entries()) {
        status.textContent = `Uploading ${i + 1} of ${ups.length}…`;
        const b = await gh(`${repoPath}/git/blobs`, { method: "POST", body: JSON.stringify({ content: await blobToB64(blob), encoding: "base64" }) });
        uploads.push({ path, sha: b.sha });
      }
      // The server checks the content, rebuilds every page and commits it all at once
      status.textContent = "Publishing…";
      const out = await api("publish", { site: state.site, items: state.items, uploads, base: state.shas }, session.get());
      state.saved = { site: JSON.stringify(state.site), items: JSON.stringify(state.items) };
      state.shas = out.shas;
      state.uploads.clear();
      changed();
      toast(out.unchanged ? "Nothing new to publish." : "Published. The live site updates in about a minute.");
    } catch (x) {
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
  async function addPhoto(file, name) {
    let pic;
    try { pic = await decode(file); } catch (_) {
      const heic = /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
      throw new Error(heic
        ? "This is an iPhone HEIC photo, which this browser can't open. Use Safari, or on the iPhone choose Settings → Camera → Formats → Most Compatible."
        : "That file couldn't be read as a photo. Try a JPG or PNG.");
    }
    const w = pic.naturalWidth || pic.width, h = pic.naturalHeight || pic.height;
    const make = (max, quality) => {
      const scale = Math.min(1, max / Math.max(w, h));
      const canvas = Object.assign(document.createElement("canvas"), { width: Math.round(w * scale), height: Math.round(h * scale) });
      canvas.getContext("2d").drawImage(pic, 0, 0, canvas.width, canvas.height);
      return new Promise((ok) => canvas.toBlob(ok, "image/jpeg", quality));
    };
    // Every photo gets a 1600px copy and a 640px copy for phones
    const base = `assets/uploads/${slug(name || file.name.replace(/\.\w+$/, ""))}-${Date.now().toString(36)}`;
    for (const [path, blob] of [[`${base}.jpg`, await make(1600, 0.82)], [`${base}-sm.jpg`, await make(640, 0.78)]]) {
      state.uploads.set(path, blob);
      state.previews.set(path, URL.createObjectURL(blob));
    }
    return `${base}.jpg`;
  }
  async function addVideo(file, name) {
    const ext = { "video/mp4": "mp4", "video/webm": "webm" }[file.type];
    if (!ext) throw new Error("Please choose an MP4 or WebM video.");
    if (file.size > 4 * 1024 * 1024) {
      throw new Error(`This video is ${(file.size / 1048576).toFixed(1)} MB. Videos must be under 4 MB — shorten or compress it first (the free HandBrake app works well).`);
    }
    const path = `assets/uploads/${slug(name || "video")}-${Date.now().toString(36)}.${ext}`;
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
    el.innerHTML = `
      <div class="view__head">
        <div><h2>Pieces</h2><p>Everything on the Collections page. Tap a piece to edit it.</p></div>
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
        <button class="tile" data-edit="${esc(i.id)}">
          <div class="tile__img"><img src="${esc(src(i.image))}" alt="" loading="lazy" />
            <div class="tile__flags">${i.featured ? '<span class="flag flag--gold">Featured</span>' : ""}${i.isNew ? '<span class="flag">New</span>' : ""}${i.lastOne ? '<span class="flag">Last one</span>' : ""}${i.rent ? '<span class="flag">Rent</span>' : ""}${i.soldOut ? '<span class="flag">Sold out</span>' : ""}${i.video ? '<span class="flag">▶</span>' : ""}</div>
          </div>
          <span class="tile__col">${esc(colName(i.collection))}</span>
          <span class="tile__name">${esc(i.name)}</span>
        </button>`).join("") + '<button class="tile tile--add" data-new-piece><div class="tile__img">+ Add piece</div></button>';
    };
    draw();
    $("[data-query]", el).addEventListener("input", (e) => { state.query = e.target.value; draw(); });
    $("[data-filter-col]", el).addEventListener("change", (e) => { state.filter = e.target.value; draw(); });
    el.addEventListener("click", (e) => {
      if (e.target.closest("[data-new-piece]")) editPiece(null);
      const t = e.target.closest("[data-edit]");
      if (t) editPiece(t.dataset.edit);
    });
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
          <label class="btn btn--ghost">${it.image ? "Replace main photo" : "Choose main photo"}<input type="file" accept="image/*" data-file /></label>
          <div class="editor__more">
            <span class="mini-label">More photos</span>
            <div class="thumbs" data-thumbs></div>
            <label class="add-link file-link">+ Add photos<input type="file" accept="image/*" multiple data-more /></label>
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
          <label class="field"><span>Collection</span>
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
        <button type="button" data-thumb-del="${i}" aria-label="Remove photo">×</button></figure>`).join("") || '<p class="muted">None yet.</p>';
      $("[data-video-box]", dlg).innerHTML = video ? `<div class="video-row"><video src="${esc(src(video))}" muted playsinline></video><button type="button" class="add-link" data-video-del>Remove video</button></div>` : "";
    };
    drawThumbs();
    $("form", dlg).addEventListener("click", (e) => {
      const l = e.target.closest("[data-thumb-left]"), d = e.target.closest("[data-thumb-del]");
      if (l) { const i = +l.dataset.thumbLeft; [images[i - 1], images[i]] = [images[i], images[i - 1]]; drawThumbs(); }
      if (d) { images.splice(+d.dataset.thumbDel, 1); drawThumbs(); }
      if (e.target.closest("[data-video-del]")) { video = ""; drawThumbs(); }
    });
    const nameNow = () => $("[name=name]", dlg).value || "piece";
    $("[data-file]", dlg).addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        image = await addPhoto(file, nameNow());
        const img = $("[data-preview]", dlg);
        img.src = src(image); img.hidden = false;
      } catch (x) { toast(x.message, true); }
    });
    $("[data-more]", dlg).addEventListener("change", async (e) => {
      for (const file of e.target.files) { try { images.push(await addPhoto(file, nameNow())); } catch (x) { toast(x.message, true); } }
      e.target.value = "";
      drawThumbs();
    });
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
    $("[data-top]", dlg)?.addEventListener("click", () => {
      state.items = [existing, ...state.items.filter((i) => i !== existing)];
      dlg.close(); render();
      toast("Moved to the top of the Collections page.");
    });
    $("form", dlg).addEventListener("submit", (e) => {
      const f = e.target;
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
    $("[data-file]", dlg).addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        image = await addPhoto(file, `collection-${$("[name=name]", dlg).value || "cover"}`);
        const img = $("[data-preview]", dlg);
        img.src = src(image); img.hidden = false;
      } catch (x) { toast(x.message, true); }
    });
    $("[data-cancel]", dlg).addEventListener("click", () => dlg.close());
    $("[data-delete]", dlg)?.addEventListener("click", () => {
      if (!confirm(`Delete the “${c.name}” collection?`)) return;
      state.site.collections = cols.filter((x) => x !== existing);
      dlg.close(); render();
    });
    $("[data-up]", dlg)?.addEventListener("click", () => {
      cols.splice(idx, 1); cols.splice(idx - 1, 0, existing);
      dlg.close(); render();
    });
    $("form", dlg).addEventListener("submit", (e) => {
      const f = e.target;
      const name = f.name.value.trim();
      if (!name) { e.preventDefault(); f.name.focus(); return; }
      if (!image) { e.preventDefault(); toast("Add a cover photo for this collection.", true); return; }
      const data = { ...c, name, text: f.text.value.trim(), image };
      if (existing) cols[idx] = data;
      else {
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
      ["banner.linkText", "Link text (optional)"], ["banner.link", "Link — a page like book.html, or a full https:// address"],
    ]],
    ["Home", [
      ["home.label", "Small line above the headline"], ["home.title", "Headline", "area"], ["home.intro", "Intro", "area"],
      ["home.button", "Main button"], ["nav.book", "“Book a visit” button text (everywhere)"], ["home.heroImage", "Hero photo (shows before the video plays)", "image"],
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
    ["Book a visit page", [
      ["book.label", "Small label"], ["book.title", "Heading"], ["book.intro", "Intro", "area"],
      ["book.types", "Appointment types — one per line", "lines"], ["book.button", "Form button"], ["book.note", "Note under the heading", "area"],
    ]],
    ["Enquire page", [["contact.label", "Small label"], ["contact.title", "Heading"], ["contact.text", "Text", "area"], ["contact.button", "Form button"]]],
    ["Footer", [
      ["footer.hours", "Visiting line"], ["footer.newsletterTitle", "Newsletter heading"], ["footer.newsletterText", "Newsletter text", "area"],
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
        ${[["bridal.label", "Small label"], ["bridal.title", "Heading"], ["bridal.intro", "Intro", "area"], ["bridal.button", "Button"]].map(fieldHTML).join("")}
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

  /* ---------- Stats ---------- */
  views.stats = (el) => {
    el.innerHTML = `<div class="view__head"><div><h2>Stats</h2><p>Anonymous counts from the site: no names, no tracking cookies.</p></div></div><p class="loading">Loading…</p>`;
    if (DEMO) { $(".loading", el).textContent = "Stats appear here once the site is live."; return; }
    api("stats", {}, session.get()).then((data) => drawStats(el, data)).catch((x) => {
      if (x.status === 401) lockOut("Please sign in again.");
      else $(".loading", el).textContent = `Couldn't load stats (${x.message}).`;
    });
  };
  function drawStats(el, data) {
    const months = Object.keys(data.months);
    let m = months[0];
    const name = (id) => state.items.find((i) => i.id === id)?.name || id;
    const PAGE_NAMES = { "/index.html": "Home", "/collections.html": "Collections", "/bridal.html": "Bridal", "/story.html": "Our story", "/order.html": "How to order", "/gallery.html": "Gallery", "/faq.html": "FAQ", "/book.html": "Book a visit", "/contact.html": "Enquire" };
    const pageName = (p) => PAGE_NAMES[p] || (p.startsWith("/p/") ? name(p.slice(3).replace(".html", "")) : p);
    const top = (obj = {}, label = (k) => k, n = 8) => {
      const rows = Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n);
      return rows.length ? `<ol class="stat-list">${rows.map(([k, v]) => `<li><span>${esc(label(k))}</span><b>${v}</b></li>`).join("")}</ol>` : '<p class="muted">Nothing yet.</p>';
    };
    const sum = (obj = {}) => Object.values(obj).reduce((a, b) => a + b, 0);
    const draw = () => {
      const d = data.months[m] || {};
      el.innerHTML = `
        <div class="view__head"><div><h2>Stats</h2><p>Anonymous counts from the site: no names, no tracking cookies.</p></div>
          <select class="select" data-month>${months.map((x) => `<option ${x === m ? "selected" : ""}>${x}</option>`).join("")}</select></div>
        <div class="stat-cards">
          <div><b>${sum(d.page)}</b><span>Page views</span></div>
          <div><b>${sum(d.view)}</b><span>Pieces viewed</span></div>
          <div><b>${sum(d.ask)}</b><span>Questions sent</span></div>
          <div><b>${sum(d.save)}</b><span>Pieces saved</span></div>
          <div><b>${sum(d.book)}</b><span>Booking requests</span></div>
        </div>
        <div class="stat-grid">
          <section><h3>Most viewed pieces</h3>${top(d.view, name)}</section>
          <section><h3>Most asked about</h3>${top(d.ask, name)}</section>
          <section><h3>Most saved</h3>${top(d.save, name)}</section>
          <section><h3>Most shared</h3>${top(d.share, name)}</section>
          <section><h3>Pages</h3>${top(d.page, pageName, 12)}</section>
        </div>
        <section class="group"><h3>Newsletter <small>${data.subscribers.length}</small></h3><div class="group__fields">
          ${data.subscribers.length ? `<button type="button" class="btn btn--ghost" data-copy-emails>Copy all emails</button>
          <ol class="stat-list">${data.subscribers.map((s) => `<li><span>${esc(s.email)}</span><small class="muted">${new Date(s.date).toLocaleDateString()}</small>
            <button type="button" class="add-link" data-unsub="${esc(s.email)}">Remove</button></li>`).join("")}</ol>` : '<p class="muted">No sign-ups yet.</p>'}
        </div></section>`;
    };
    draw();
    el.addEventListener("change", (e) => { if (e.target.matches("[data-month]")) { m = e.target.value; draw(); } });
    el.addEventListener("click", async (e) => {
      if (e.target.closest("[data-copy-emails]")) {
        try { await navigator.clipboard.writeText(data.subscribers.map((s) => s.email).join(", ")); toast("Emails copied — paste them into your email's To or Bcc field."); } catch (_) { toast("Couldn't copy. Select the emails and copy them instead.", true); }
      }
      const u = e.target.closest("[data-unsub]");
      if (u && confirm(`Remove ${u.dataset.unsub} from the newsletter list?`)) {
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
