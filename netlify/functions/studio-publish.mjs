/* POST /api/studio/publish  (Authorization: Bearer <session>)
 *   { site, items, uploads: [{ path, sha }], base: { site, items } }
 *
 * Publishes the Studio's changes as one commit on main:
 *   - content/site.json and content/items.json (checked and cleaned)
 *   - every page, rebuilt from the content (shared/pages.mjs), plus sitemap.xml
 *   - photos and videos the Studio uploaded (as blobs) to assets/uploads/
 *   - removes uploads nothing uses any more, and pages of deleted pieces
 * Refuses if the content changed elsewhere since the Studio loaded it. */
import { buildSite } from "../../shared/pages.mjs";
import { BASE, BRANCH, SHA_RE, checkSession, configured, cors, github, json } from "../lib/studio.mjs";

const UPLOAD = /^assets\/uploads\/[a-z0-9][a-z0-9._-]{0,90}\.(jpg|jpeg|png|webp|mp4|webm)$/;
const ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const LOCAL_FILE = /^assets\/[a-z0-9/._-]{1,140}$/i;

class Bad extends Error {}

/* ---------- Make sure links and file paths can't be abused ---------- */
const isWebLink = (v) => /^https:\/\/[^\s"'<>]+$/i.test(v);
const isLocalLink = (v) => /^(?![a-z][a-z0-9+.-]*:)(?!\/\/)[^\s"'<>]*$/i.test(v);
function clean(site, items) {
  if (!site || typeof site !== "object" || Array.isArray(site)) throw new Bad("The site content is missing.");
  if (!Array.isArray(items)) throw new Bad("The pieces are missing.");
  if (JSON.stringify(site).length > 400_000 || JSON.stringify(items).length > 1_500_000) throw new Bad("The content is too large.");

  const file = (v, where) => {
    if (v == null || v === "") return "";
    if (typeof v !== "string" || !(LOCAL_FILE.test(v) && !v.includes(".."))) throw new Bad(`${where}: that photo or video path isn't allowed.`);
    return v;
  };
  const web = (v, where) => {
    if (!v) return "";
    if (typeof v !== "string" || !isWebLink(v)) throw new Bad(`${where} must be a full https:// link.`);
    return v;
  };

  const b = site.business || {};
  for (const k of ["facebook", "messenger", "instagram"]) b[k] = web(b[k], `The ${k} link`);
  for (const k of ["phone", "email", "whatsapp", "location"]) if (b[k] != null && typeof b[k] !== "string") throw new Bad(`The ${k} must be text.`);
  site.business = b;

  if (site.banner?.link && !(isLocalLink(site.banner.link) || isWebLink(site.banner.link))) throw new Bad("The banner link must be a page on the site or an https:// link.");
  if (site.home) {
    site.home.heroImage = file(site.home.heroImage, "Hero photo");
    site.home.heroVideo = file(site.home.heroVideo, "Hero video");
    site.home.heroVideoMobile = file(site.home.heroVideoMobile, "Hero video (phones)");
  }
  if (site.story) site.story.image = file(site.story.image, "Story photo");
  (site.collections || []).forEach((c, i) => {
    if (!ID.test(c.id || "")) throw new Bad(`Collection ${i + 1} has an invalid id.`);
    c.image = file(c.image, `The “${c.name}” cover`);
  });
  (site.gallery?.images || []).forEach((g) => { g.src = file(g.src, "A gallery photo"); });
  (site.bridal?.looks || []).forEach((l) => { l.image = file(l.image, `The look “${l.title}”`); });
  (site.reviews?.items || []).forEach((r) => { r.image = file(r.image, "A review photo"); });

  const ids = new Set();
  for (const it of items) {
    if (!it || !ID.test(it.id || "")) throw new Bad("A piece has an invalid id.");
    if (ids.has(it.id)) throw new Bad(`Two pieces share the id “${it.id}”.`);
    ids.add(it.id);
    if (typeof it.name !== "string" || !it.name.trim()) throw new Bad("Every piece needs a name.");
    it.image = file(it.image, `“${it.name}”`);
    it.images = (it.images || []).map((x) => file(x, `“${it.name}”`)).filter(Boolean);
    it.video = file(it.video, `“${it.name}” video`);
    it.pairs = (it.pairs || []).filter((x) => typeof x === "string" && ID.test(x));
  }
  return { site, items };
}

/* Git's id for a file, so the Studio can tell later if someone else changed it */
async function blobSha(text) {
  const bytes = new TextEncoder().encode(text);
  const head = new TextEncoder().encode(`blob ${bytes.length}\0`);
  const all = new Uint8Array(head.length + bytes.length);
  all.set(head); all.set(bytes, head.length);
  return [...new Uint8Array(await crypto.subtle.digest("SHA-1", all))].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req) });
  if (!configured()) return json(req, { error: "The Studio isn't set up yet." }, 503);
  if (!(await checkSession(req))) return json(req, { error: "Please sign in again." }, 401);

  try {
    let body;
    try { body = await req.json(); } catch { throw new Bad("Bad request."); }
    const { site, items } = clean(body.site, body.items);
    const uploads = Array.isArray(body.uploads) ? body.uploads : [];
    for (const u of uploads) if (!UPLOAD.test(u?.path || "") || !SHA_RE.test(u?.sha || "")) throw new Bad("An upload isn't allowed.");

    // Where main is now, and whether the content moved on since the Studio loaded it
    const ref = await github(`${BASE}/git/ref/heads/${BRANCH}`);
    const head = await github(`${BASE}/git/commits/${ref.object.sha}`);
    const tree = await github(`${BASE}/git/trees/${head.tree.sha}?recursive=1`);
    const now = Object.fromEntries(tree.tree.filter((t) => t.type === "blob").map((t) => [t.path, t.sha]));
    if (body.base && (body.base.site !== now["content/site.json"] || body.base.items !== now["content/items.json"])) {
      return json(req, { error: "The site was changed somewhere else since you opened the Studio. Reload to get the latest, then make your edits again." }, 409);
    }

    const siteText = JSON.stringify(site, null, 1) + "\n";
    const itemsText = JSON.stringify(items, null, 1) + "\n";
    const pages = buildSite(site, items);
    const entries = [
      { path: "content/site.json", mode: "100644", type: "blob", content: siteText },
      { path: "content/items.json", mode: "100644", type: "blob", content: itemsText },
      ...Object.entries(pages).map(([path, content]) => ({ path, mode: "100644", type: "blob", content })),
      ...uploads.map((u) => ({ path: u.path, mode: "100644", type: "blob", sha: u.sha })),
    ];

    // Tidy up: pages of deleted pieces, and uploads nothing refers to any more
    const used = siteText + itemsText;
    const isUsed = (path) => used.includes(`"${path}"`) || used.includes(`"${path.replace(/-sm(\.\w+)$/, "$1")}"`);
    const removed = [];
    for (const path of tree.truncated ? [] : Object.keys(now)) {
      const stalePage = /^p\/[^/]+\.html$/.test(path) && !pages[path];
      const staleUpload = path.startsWith("assets/uploads/") && !path.endsWith(".gitkeep") && !isUsed(path) && !uploads.some((u) => u.path === path);
      if (stalePage || staleUpload) { entries.push({ path, mode: "100644", type: "blob", sha: null }); removed.push(path); }
    }

    const newTree = await github(`${BASE}/git/trees`, { method: "POST", body: { base_tree: head.tree.sha, tree: entries } });
    if (newTree.sha === head.tree.sha) return json(req, { ok: true, unchanged: true, shas: { site: now["content/site.json"], items: now["content/items.json"] } });
    const commit = await github(`${BASE}/git/commits`, {
      method: "POST",
      body: { message: `Update site content from the Studio${removed.length ? ` (tidied ${removed.length} unused file${removed.length === 1 ? "" : "s"})` : ""}`, tree: newTree.sha, parents: [head.sha] },
    });
    await github(`${BASE}/git/refs/heads/${BRANCH}`, { method: "PATCH", body: { sha: commit.sha, force: false } });

    return json(req, { ok: true, commit: commit.sha, removed, shas: { site: await blobSha(siteText), items: await blobSha(itemsText) } });
  } catch (x) {
    if (x instanceof Bad) return json(req, { error: x.message }, 400);
    if (x.status === 422) return json(req, { error: "Someone published at the same moment. Please publish again." }, 409);
    return json(req, { error: `GitHub refused the change (${x.message}).` }, 502);
  }
};

export const config = {
  path: "/api/studio/publish",
  method: ["POST", "OPTIONS"],
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 20 },
};
