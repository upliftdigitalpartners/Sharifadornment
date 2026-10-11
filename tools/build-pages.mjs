#!/usr/bin/env node
/* Rebuilds every page from content/*.json using shared/pages.mjs.
 *   node tools/build-pages.mjs
 * The Studio does the same thing on Netlify each time it publishes, so you
 * only need this after editing the templates in shared/ by hand. */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildSite } from "../shared/pages.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => JSON.parse(readFileSync(join(root, f), "utf8"));
const pages = buildSite(read("content/site.json"), read("content/items.json"));

mkdirSync(join(root, "p"), { recursive: true });
for (const f of readdirSync(join(root, "p"))) {
  if (f.endsWith(".html") && !pages[`p/${f}`]) { unlinkSync(join(root, "p", f)); console.log("removed p/" + f); }
}
for (const [path, html] of Object.entries(pages)) writeFileSync(join(root, path), html);
console.log(`wrote ${Object.keys(pages).length} files`);
