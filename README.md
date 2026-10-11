# Sharif Adornment — sharifadornment.com

A single-page site for **Sharif Adornment**, a jewelry and accessories
boutique in Queens, NY. It's plain HTML, CSS and JS with **no build step and no
dependencies**, and GitHub Pages serves it as is.

## What's in it

- **Pages:** Home, Collections, Bridal, Our Story, How to Order, Gallery, FAQ
  and Enquire, plus **a page for every piece** (`p/<piece>.html`)
  with its own photo, title and description, for Google and for link previews.
- **Collections:** search, filters by collection (and "For rent"), badges (New,
  Last one, Sold out, For rent), and a quick view with every photo and video,
  full-screen zoom, size and rental details, "Complete the look" suggestions,
  Share, "Buying as a gift?" and "Tell me when it's back".
- **Ask about a piece:** opens WhatsApp (when a number is set), a text message
  on phones, or Messenger on computers, with the piece's name and link already
  written.
- **Saved pieces:** a heart on every piece. The list is kept on the visitor's
  device and can be sent in one message or used in the enquiry form.
- **Bridal lookbook**, **reviews** (hidden until you add real ones), **FAQ**,
  an **announcement banner**, a **newsletter** sign-up, and **Facebook posts** that load only when
  asked.
- **Design:** minimal and editorial, with warm ivory, antique-gold accents and a
  lotus ornament. **Night mode** follows the device setting and can be toggled.
  Photos come in phone and full sizes. The hero video is skipped with Data
  Saver or reduced motion.
- **Accessible:** keyboard-friendly menus and dialogs, reduced-motion support,
  descriptive alt text and structured data (store, products, FAQ).

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

| Tab | What you can do |
|---|---|
| **Pieces** | Add, edit, delete and reorder. Main photo plus more photos and a short video; price, size, description; Featured / New / Last one / Sold out / Available to rent (with a rental price); pick up to 3 pieces to "complete the look". |
| **Collections** | Rename, describe, change covers, add, reorder. |
| **Bridal** | The Bridal page text and its looks: photo, title, description, and which pieces are in each look. |
| **Reviews** | Add real customer reviews (text, name, occasion, optional photo). |
| **FAQ** | Questions and answers, in order. |
| **Pages** | Every heading and message, the announcement banner, footer and the "Message us" button text. Wrap words in `*asterisks*` for gold italics. |
| **Gallery** | Add, describe, reorder and remove photos. |
| **Analytics** | Per month, compared with the month before: visits, page views, pieces viewed, questions and saves; visits per day; where visitors come from (Facebook, Instagram, Google, WhatsApp, typed in); phone, tablet or computer; the most viewed collections and pages; a table of every piece's views, questions, saves and shares; and the newsletter list, which you can copy or remove addresses from. Add `?demo` to the Studio address to see it with sample numbers. |
| **History** | Every published version, with **Restore**, which loads it as unpublished changes. |
| **Details** | Phone, WhatsApp, email, Messenger, Facebook, Instagram, location, and the hero videos (upload MP4 under 4 MB). |

**Preview** shows the real site with your unpublished changes. **Publish**
uploads new photos and videos (each saved in a phone-sized and a full-sized
copy), then the Studio API checks everything, **rebuilds every page** from the
content, removes photos nothing uses any more, and saves it all as one commit.
The live site updates in about a minute. Add `?demo` to the Studio address to
try it without publishing.

### Analytics and privacy

The site counts page views, visits, piece views, saves, questions and shares,
per day and month. For the first page of a visit it also records, in one word
each, where the visitor came from (Facebook, Google, …) and the kind of device
(phone, tablet, computer). Nothing personal is stored: no cookies, IP
addresses or names, and it respects "Do Not Track". Newsletter emails are stored privately
on Netlify (Blobs) and only the Studio can read them.

### How the pages are built

The HTML pages are generated from `content/*.json` by `shared/pages.mjs`, using
the building blocks in `shared/render.mjs`, which the browser also uses for quick
view and preview. The Studio's publish step runs this on Netlify. If you change
the templates by hand, rebuild locally with:

```bash
node tools/build-pages.mjs
```

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
| CNAME | www | upliftdigitalpartners.github.io |

Don't add the optional `AAAA` (IPv6) records. With them, GitHub's domain
check kept failing for this domain (`NotServedByPagesError`), and the owner's
other GitHub Pages domains work with just the four `A` records and the `www`
CNAME.

### 3. Turn on HTTPS
DNS can take from a few minutes up to 24 hours to update. Once GitHub's Pages
settings show the DNS check passing, tick **Enforce HTTPS**.

*Optional but recommended:* verify the domain under GitHub **Organization
settings → Pages → Add a verified domain**, so nobody else can claim it.

## Project layout

```
*.html, p/*.html, sitemap.xml   generated pages (don't edit by hand — see above)
content/site.json               all wording, collections, bridal looks, reviews, FAQ, contact details
content/items.json              the pieces
shared/render.mjs               HTML building blocks (browser + server)
shared/pages.mjs                full page templates
tools/build-pages.mjs           rebuilds the pages locally
css/style.css                   design system, layout, night mode
js/app.js                       quick view, saved pieces, search, forms, analytics, preview
studio/                         the admin (Studio)
netlify/functions/              Studio API: login, github, publish, stats (analytics); public: track, subscribe
netlify/lib/studio.mjs          sessions, CORS, GitHub access rules
netlify.toml, package.json      Netlify settings (API only); @netlify/blobs for analytics and the newsletter
assets/                         images (each with a -sm phone copy), pieces, gallery, video, uploads/
PROMPTS.md                      art direction and AI photo/video prompts
CNAME / .nojekyll               GitHub Pages config
```
