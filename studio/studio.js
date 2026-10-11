/* Sharif Adornment — Studio.
 * Edits content/site.json and content/items.json (and uploads photos) and
 * publishes them to the GitHub repo in a single commit. GitHub Pages then
 * rebuilds the site, usually within a minute. No server needed.
 * Add ?demo to the URL to try it without a token (nothing is published). */
(() => {
  const REPO = { owner: "upliftdigitalpartners", name: "Sharifadornment", branch: "main" };
  const FILES = { site: "content/site.json", items: "content/items.json" };
  const API = "https://api.github.com";
  const DEMO = new URLSearchParams(location.search).has("demo");
  const TOKEN_KEY = "sa-studio-token";

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
    token: "",
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

  /* ---------- GitHub API ---------- */
  async function gh(path, opts = {}) {
    const res = await fetch(`${API}${path}`, {
      ...opts,
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${state.token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
      },
    });
    if (!res.ok) {
      const err = new Error((await res.json().catch(() => ({}))).message || res.statusText);
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
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

  /* ---------- Sign in ---------- */
  const gate = $("[data-gate]");
  const app = $("[data-app]");
  const storedToken = () => { try { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY) || ""; } catch (_) { return ""; } };

  $("[data-signin]").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target;
    const err = $("[data-signin-error]");
    err.textContent = "";
    state.token = f.token.value.trim();
    f.querySelector("button").disabled = true;
    try {
      await gh(repoPath);
      try {
        (f.remember.checked ? localStorage : sessionStorage).setItem(TOKEN_KEY, state.token);
      } catch (_) { /* storage blocked: stay signed in for this visit only */ }
      await start();
    } catch (x) {
      err.textContent = x.status === 401 ? "That token wasn't accepted. Check it was copied in full." :
        x.status === 404 ? "This token can't see the Sharifadornment repository. Check its repository access." :
        `Couldn't sign in (${x.message}).`;
    } finally {
      f.querySelector("button").disabled = false;
    }
  });

  $("[data-signout]").addEventListener("click", () => {
    if (isDirty() && !confirm("You have unpublished changes. Sign out and lose them?")) return;
    try { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); } catch (_) { /* ignore */ }
    location.reload();
  });

  async function start() {
    gate.hidden = true;
    app.hidden = false;
    $("[data-view]").innerHTML = '<p class="loading">Loading…</p>';
    const [site, items] = await Promise.all([readFile(FILES.site), readFile(FILES.items)]);
    state.site = JSON.parse(site.text);
    state.items = JSON.parse(items.text);
    state.saved = { site: JSON.stringify(state.site), items: JSON.stringify(state.items) };
    state.shas = { site: site.sha, items: items.sha };
    if (DEMO) toast("Demo mode — try anything; nothing will be published.");
    render();
  }

  /* ---------- Dirty tracking & publish bar ---------- */
  // Photos that are actually used (a photo picked and then cancelled is never uploaded)
  const usedUploads = () => {
    const all = JSON.stringify(state.site) + JSON.stringify(state.items);
    return [...state.uploads].filter(([path]) => all.includes(`"${path}"`));
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

  async function publish() {
    const btn = $("[data-publish-btn]");
    const siteText = JSON.stringify(state.site, null, 1) + "\n";
    const itemsText = JSON.stringify(state.items, null, 1) + "\n";
    if (DEMO) { toast("Demo mode — nothing was published."); return; }
    btn.disabled = true;
    $("[data-status]").textContent = "Publishing…";
    try {
      // Stop if someone else changed the content since this page loaded
      const [cs, ci] = await Promise.all([
        gh(`${repoPath}/contents/${FILES.site}?ref=${REPO.branch}`),
        gh(`${repoPath}/contents/${FILES.items}?ref=${REPO.branch}`),
      ]);
      if (cs.sha !== state.shas.site || ci.sha !== state.shas.items) {
        throw new Error("The site was changed somewhere else since you opened the Studio. Reload to get the latest, then make your edits again.");
      }

      // One commit with every changed file: photos first, then the content
      const ref = await gh(`${repoPath}/git/ref/heads/${REPO.branch}`);
      const head = await gh(`${repoPath}/git/commits/${ref.object.sha}`);
      const tree = [];
      for (const [path, blob] of usedUploads()) {
        const b = await gh(`${repoPath}/git/blobs`, { method: "POST", body: JSON.stringify({ content: await blobToB64(blob), encoding: "base64" }) });
        tree.push({ path, mode: "100644", type: "blob", sha: b.sha });
      }
      const blobShas = {};
      for (const [key, text] of [["site", siteText], ["items", itemsText]]) {
        if (JSON.stringify(state[key]) === state.saved[key]) continue;
        const b = await gh(`${repoPath}/git/blobs`, { method: "POST", body: JSON.stringify({ content: text, encoding: "utf-8" }) });
        tree.push({ path: FILES[key], mode: "100644", type: "blob", sha: b.sha });
        blobShas[key] = b.sha;
      }
      const newTree = await gh(`${repoPath}/git/trees`, { method: "POST", body: JSON.stringify({ base_tree: head.tree.sha, tree }) });
      const commit = await gh(`${repoPath}/git/commits`, {
        method: "POST",
        body: JSON.stringify({ message: "Update site content from the Studio", tree: newTree.sha, parents: [head.sha] }),
      });
      await gh(`${repoPath}/git/refs/heads/${REPO.branch}`, { method: "PATCH", body: JSON.stringify({ sha: commit.sha }) });

      state.saved = { site: JSON.stringify(state.site), items: JSON.stringify(state.items) };
      Object.assign(state.shas, blobShas);
      state.uploads.clear();
      changed();
      toast("Published. The live site updates in about a minute.");
    } catch (x) {
      changed();
      toast(x.status === 403 || x.status === 404
        ? "This token can't publish. Give it Contents: Read and write on the Sharifadornment repository."
        : x.message, true);
    }
  }

  /* ---------- Photos: resize in the browser, publish later ---------- */
  async function addPhoto(file, name) {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = Object.assign(document.createElement("canvas"), {
      width: Math.round(bitmap.width * scale), height: Math.round(bitmap.height * scale),
    });
    canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((ok) => canvas.toBlob(ok, "image/jpeg", 0.82));
    const path = `assets/uploads/${slug(name || file.name.replace(/\.\w+$/, ""))}-${Date.now().toString(36)}.jpg`;
    state.uploads.set(path, blob);
    state.previews.set(path, URL.createObjectURL(blob));
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
            <div class="tile__flags">${i.featured ? '<span class="flag flag--gold">Featured</span>' : ""}${i.soldOut ? '<span class="flag">Sold out</span>' : ""}</div>
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

  function editPiece(id) {
    const existing = state.items.find((i) => i.id === id);
    const it = existing ? { ...existing } : { id: "", name: "", collection: state.filter !== "all" ? state.filter : state.site.collections[0]?.id, image: "", description: "", price: "", soldOut: false, featured: false };
    const dlg = $("[data-editor]");
    dlg.innerHTML = `
      <form method="dialog" novalidate>
        <div class="editor__media">
          <img data-preview src="${esc(src(it.image))}" alt="" ${it.image ? "" : "hidden"} />
          <label class="btn btn--ghost">${it.image ? "Replace photo" : "Choose photo"}<input type="file" accept="image/*" data-file /></label>
          <small class="muted">Portrait photos (4:5) look best. Large photos are resized automatically.</small>
        </div>
        <div class="editor__body">
          <h2>${existing ? "Edit piece" : "New piece"}</h2>
          <label class="field"><span>Name</span><input name="name" required value="${esc(it.name)}" /></label>
          <label class="field"><span>Collection</span>
            <select name="collection">${state.site.collections.map((c) => `<option value="${esc(c.id)}"${c.id === it.collection ? " selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
          </label>
          <label class="field"><span>Price</span><input name="price" value="${esc(it.price)}" placeholder="Leave empty to show “Price on request”" /></label>
          <label class="field"><span>Description</span><textarea name="description" rows="4">${esc(it.description)}</textarea></label>
          <div class="editor__checks">
            <label class="check"><input type="checkbox" name="featured" ${it.featured ? "checked" : ""} /> <span>Feature on the home page</span></label>
            <label class="check"><input type="checkbox" name="soldOut" ${it.soldOut ? "checked" : ""} /> <span>Sold out</span></label>
          </div>
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
    $("[data-file]", dlg).addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        image = await addPhoto(file, $("[name=name]", dlg).value || "piece");
        const img = $("[data-preview]", dlg);
        img.src = src(image); img.hidden = false;
      } catch (_) { toast("That file couldn't be read as a photo. Try a JPG or PNG.", true); }
    });
    $("[data-cancel]", dlg).addEventListener("click", () => dlg.close());
    $("[data-delete]", dlg)?.addEventListener("click", () => {
      if (!confirm(`Delete “${it.name}”?`)) return;
      state.items = state.items.filter((i) => i.id !== id);
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
      if (!image) { e.preventDefault(); toast("Add a photo for this piece.", true); return; }
      const data = {
        ...it, name, image,
        collection: f.collection.value,
        price: f.price.value.trim(),
        description: f.description.value.trim(),
        featured: f.featured.checked,
        soldOut: f.soldOut.checked,
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
      } catch (_) { toast("That file couldn't be read as a photo. Try a JPG or PNG.", true); }
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
    ["Home", [
      ["home.label", "Small line above the headline"], ["home.title", "Headline", "area"], ["home.intro", "Intro", "area"],
      ["home.button", "Main button"], ["home.link", "Second link"], ["home.heroImage", "Hero photo (shows before the video plays)", "image"],
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
    ["Gallery page", [["gallery.label", "Small label"], ["gallery.title", "Heading"], ["gallery.link", "Facebook link text"]]],
    ["Enquire page", [["contact.label", "Small label"], ["contact.title", "Heading"], ["contact.text", "Text", "area"], ["contact.button", "Form button"]]],
  ];

  function fieldHTML([path, label, type = "text"]) {
    const v = get(state.site, path);
    if (type === "area") return `<label class="field"><span>${label}</span><textarea data-path="${path}" rows="2">${esc(v)}</textarea></label>`;
    if (type === "paras") return `<label class="field"><span>${label}</span><textarea data-paras="${path}" rows="7">${esc((v || []).join("\n\n"))}</textarea></label>`;
    if (type === "image") return `<div class="field"><span>${label}</span><div class="picker"><img src="${esc(src(v))}" alt="" data-img="${path}" />
      <label class="btn btn--ghost">Replace photo<input type="file" accept="image/*" data-image="${path}" /></label></div></div>`;
    if (type === "pairs") return `<div class="field"><span>${label}</span><div class="group__fields" data-pairs="${path}">
      ${(v || []).map((p, i) => `<div class="pair">
        <label class="field"><span>Title</span><input data-path="${path}.${i}.title" value="${esc(p.title)}" /></label>
        <label class="field"><span>Text</span><input data-path="${path}.${i}.text" value="${esc(p.text)}" /></label>
        <button type="button" class="btn btn--danger" data-remove-pair="${path}" data-i="${i}">Remove</button></div>`).join("")}
      <button type="button" class="add-link" data-add-pair="${path}">+ Add</button></div></div>`;
    return `<label class="field"><span>${label}</span><input data-path="${path}" value="${esc(v)}" /></label>`;
  }

  views.pages = (el) => {
    el.innerHTML = `
      <div class="view__head"><div><h2>Pages</h2><p>Every heading and message on the site.</p></div></div>
      <p class="hint">Tip: wrap words in <em>*asterisks*</em> to show them in gold italics, like <em>*every celebration.*</em></p>
      ${PAGES.map(([title, fields]) => `<section class="group"><h3>${title}</h3><div class="group__fields">${fields.map(fieldHTML).join("")}</div></section>`).join("")}`;
    bindFields(el);
  };

  function bindFields(el) {
    el.addEventListener("input", (e) => {
      const t = e.target;
      if (t.dataset.path) { set(state.site, t.dataset.path, t.value); changed(); }
      if (t.dataset.paras) { set(state.site, t.dataset.paras, t.value.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)); changed(); }
    });
    el.addEventListener("change", async (e) => {
      const t = e.target;
      if (!t.dataset.image || !t.files[0]) return;
      try {
        const path = await addPhoto(t.files[0], t.dataset.image.split(".")[0]);
        set(state.site, t.dataset.image, path);
        $(`[data-img="${t.dataset.image}"]`, el).src = src(path);
        changed();
      } catch (_) { toast("That file couldn't be read as a photo. Try a JPG or PNG.", true); }
    });
    el.addEventListener("click", (e) => {
      const add = e.target.closest("[data-add-pair]");
      const rm = e.target.closest("[data-remove-pair]");
      if (add) { get(state.site, add.dataset.addPair).push({ title: "", text: "" }); render(); }
      if (rm) { get(state.site, rm.dataset.removePair).splice(+rm.dataset.i, 1); render(); }
    });
  }

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
    const f = (path, label, hint = "") => `<label class="field"><span>${label}</span><input data-path="${path}" value="${esc(get(state.site, path))}" />${hint ? `<small>${hint}</small>` : ""}</label>`;
    el.innerHTML = `
      <div class="view__head"><div><h2>Details</h2><p>Contact details used across the site, the phone bar and the enquiry form.</p></div></div>
      <section class="group"><h3>Contact</h3><div class="group__fields">
        ${f("business.phone", "Phone", "Used for the Call button and for enquiries sent from phones.")}
        ${f("business.email", "Email", "Optional. If set, desktop enquiries open an email instead of Messenger.")}
        ${f("business.location", "Location line")}
      </div></section>
      <section class="group"><h3>Links</h3><div class="group__fields">
        ${f("business.messenger", "Messenger link")}
        ${f("business.facebook", "Facebook page")}
      </div></section>
      <section class="group"><h3>Hero video</h3><div class="group__fields">
        ${f("home.heroVideo", "Video file (desktop)", "Leave empty to show the hero photo only.")}
        ${f("home.heroVideoMobile", "Video file (phones)")}
      </div></section>`;
    bindFields(el);
  };

  /* ---------- Boot ---------- */
  if (DEMO) { state.token = "demo"; start(); return; }
  state.token = storedToken();
  if (state.token) {
    start().catch((x) => {
      app.hidden = true; gate.hidden = false;
      $("[data-signin-error]").textContent = x.status === 401 ? "Your saved token has expired. Paste a new one." : `Couldn't load the site content (${x.message}).`;
    });
  } else {
    gate.hidden = false;
  }
})();
