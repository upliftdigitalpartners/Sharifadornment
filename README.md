# Sharif Adornment — sharifadornment.com

A single-page site for **Sharif Adornment**, a jewelry and accessories
boutique in Queens, NY. It's plain HTML, CSS and JS with **no build step and no
dependencies**, and GitHub Pages serves it as is.

## What's in it

- **Pages:** Home, Collections, Our Story, How to Order, Gallery and Enquire,
  each its own page with a shared header, footer and phone bar.
- **Design:** minimal and editorial. Warm ivory, near-black type, Instrument
  Serif with Inter, antique-gold accents and a small lotus ornament.
  **Night mode** follows the visitor's phone or computer setting, and the
  moon/sun button in the header switches it (the choice is remembered).
- **Collections page:** every piece with a photo, collection and price (or
  "Price on request"). Visitors can filter by collection and tap a piece to see
  it up close, then "Ask about this piece", which pre-fills the enquiry form.
- **Phones first:** hero photo/video leads, swipeable rows, a fixed
  **Message us / Call** bar, 44px tap targets, safe-area padding.
- **Enquiry form:** opens a pre-filled **text message** on phones. On desktop
  it copies the note and opens **Messenger**, or opens email if an email
  address is set. No backend needed.

## Editing the site: the Studio

All wording, collections, pieces, gallery photos and contact details live in
two files, `content/site.json` and `content/items.json`. You don't edit them by
hand. Use the **Studio**, a private admin page:

**https://sharifadornment.com/studio/**: or tap the **©** in the footer of any page.

The Studio isn't linked anywhere visible and search engines are told to ignore
it. Sign-in is **password only**.

### How it stays secure

The site is static (GitHub Pages), so the password can't be checked in the
browser: anything there is readable. Instead, a small **Studio API** runs as
two Netlify Functions (`netlify/functions/`, shared code in `netlify/lib/studio.mjs`):

- `POST /api/studio/login` checks the password **on the server**. It's
  rate-limited per visitor, and each wrong guess is slowed down, so it can't be
  brute-forced. A correct password returns a signed session that lasts 8 hours.
- `POST /api/studio/github` checks the session, then makes the GitHub call
  using a token that lives **only** in Netlify's secret environment variables.
  The token never reaches the browser. It allows just the calls the Studio
  needs, and only writes to `content/site.json`, `content/items.json` and
  `assets/uploads/`. It refuses changes to the pages, scripts, the Studio
  itself or the domain, refuses force-pushes, and only allows the `main` branch.
- Only `sharifadornment.com` (and the github.io address) may call the API.

Every change is a normal git commit, so anything can be undone from GitHub's history.

### One-time setup (developer, not the admin)

1. **Netlify project:** `sharif-adornment-studio` (already created).
   `STUDIO_PASSWORD` is already set as a secret.
2. **Link it to this repo:** Netlify → *sharif-adornment-studio* →
   **Project configuration → Build & deploy → Link repository** → GitHub →
   `upliftdigitalpartners/Sharifadornment`, branch `main`. `netlify.toml`
   handles the rest: there's no build step, and it only deploys the API.
3. **GitHub token:** signed in as `upliftdigitalpartners`, create a
   [fine-grained token](https://github.com/settings/personal-access-tokens/new)
   with **Only select repositories → Sharifadornment** and
   **Repository permissions → Contents: Read and write**. In Netlify, add it as
   environment variable **`GITHUB_TOKEN`** (secret, scope *Functions*), then
   **Deploys → Trigger deploy**.

To change the password, edit `STUDIO_PASSWORD` in Netlify and redeploy.
Everyone is signed out. A longer password (a short phrase) is stronger.

### In the Studio

- **Pieces:** add, edit, delete and reorder pieces; set the price, mark
  **Sold out** or **Feature on the home page**; upload photos (resized
  automatically in the browser).
- **Collections:** rename, describe, change cover photos, add or reorder.
- **Pages:** every heading and message on every page. Wrap words in
  `*asterisks*` to show them in gold italics.
- **Gallery:** add, describe, reorder and remove photos.
- **Details:** phone, email, Messenger and Facebook links, location line,
  hero video files.

Changes stay on the device until **Publish**, which saves everything to GitHub
in one commit. The live site updates in about a minute. Add `?demo` to the
Studio address to try it without publishing.

To change the hero **video**, upload the new file to `assets/video/` on GitHub
and enter its path in **Studio → Details**. Keep it under about 4 MB; see
`PROMPTS.md`.

## Preview locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Use a local server, not a double-clicked `index.html`, because the pages load
their content from `content/*.json`, which browsers block on `file://`.

## Deploy on GitHub Pages and connect the Squarespace domain

### 1. Turn on Pages
1. Merge this work into `main`.
2. In the repo, open **Settings → Pages**.
3. Under **Build and deployment**, set **Source: Deploy from a branch**, then
   **Branch: `main`**, folder **`/ (root)`**, and click **Save**.
4. Under **Custom domain**, enter `sharifadornment.com` and save. The `CNAME`
   file in this repo already contains it.

> GitHub Pages on a **private** repo needs a paid GitHub plan (Pro, Team or
> Enterprise). On a free plan, make the repo public.

### 2. Point the domain at GitHub (Squarespace)
Go to Squarespace **Domains → sharifadornment.com → DNS → DNS Settings**:

1. **Delete** the Squarespace default records (the "Squarespace Defaults"
   group, including the default `A` records and the `www` CNAME to
   `ext-cust.squarespace.com`).
2. **Add** these custom records:

| Type | Host | Data |
|---|---|---|
| A | @ | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |
| AAAA | @ | 2606:50c0:8000::153 |
| AAAA | @ | 2606:50c0:8001::153 |
| AAAA | @ | 2606:50c0:8002::153 |
| AAAA | @ | 2606:50c0:8003::153 |
| CNAME | www | upliftdigitalpartners.github.io |

### 3. Turn on HTTPS
DNS can take from a few minutes up to 24 hours to update. Once GitHub's Pages
settings show the DNS check passing, tick **Enforce HTTPS**.

*Optional but recommended:* verify the domain under GitHub **Organization
settings → Pages → Add a verified domain**, so nobody else can claim it.

## Project layout

```
index.html, collections.html, story.html,
order.html, gallery.html, contact.html    the pages
404.html                                   branded not-found page
content/site.json                          all wording, collections, gallery, contact details
content/items.json                         the pieces
css/style.css                              design system, layout, night mode
js/app.js                                  loads content, renders lists, nav, form, night mode
studio/                                    the admin (Studio)
netlify/, netlify.toml                     the Studio API (Netlify Functions)
assets/                                    favicon, images, gallery, video, uploads/
PROMPTS.md                                 art direction and AI photo/video prompts
CNAME / .nojekyll                          GitHub Pages config
```
