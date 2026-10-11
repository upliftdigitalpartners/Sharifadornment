# Sharif Adornment — sharifadornment.com

A single-page site for **Sharif Adornment**, a jewelry and accessories
boutique in Queens, NY. It's plain HTML, CSS and JS with **no build step and no
dependencies**, and GitHub Pages serves it as is.

## What's in it

- **Design:** minimal and editorial. Warm ivory background, near-black type,
  Instrument Serif headings with Inter body text, full-colour product photos and
  plenty of white space. Motion is limited to gentle fade-ins and slow image
  zooms on hover.
- **Sections:** Hero → Collections (6) → Our Story → How to Order → For the
  Occasion → Gallery → Enquire → Footer.
- **Hero video (optional):** a short looping clip can replace the hero photo.
  Set `heroVideo` (and optionally `heroVideoMobile`) in `js/config.js`. The
  photo shows while the video loads, and to anyone who prefers reduced motion.
- **Enquiry form:** opens a pre-filled **text message** on phones. On desktop
  it copies the note and opens **Messenger**, or opens email if an email
  address is set in the config. It needs no backend. Clicking a collection
  pre-selects it in the form.
- **Accessible and fast:** honours *reduced motion*, works without JavaScript
  for everything except the gallery and form, lazy-loads images, and includes
  SEO and link-preview tags plus `JewelryStore` structured data.

## Editing content

| What | Where |
|---|---|
| Phone, email, Facebook links, location line | `js/config.js` |
| Hero video | put the file in `assets/video/`, set `heroVideo` in `js/config.js` |
| Gallery photos and reels | drop files in `assets/gallery/`, list them in `js/config.js` |
| Hero, collection covers, story image, link-preview image | `assets/img/` (see the table in `PROMPTS.md`) |
| Wording | `index.html` |
| Colours and fonts | top of `css/style.css` (`:root`) |

**Videos:** keep each clip under about 4 MB and 5–10 seconds, as `.mp4`
(H.264). They play muted and loop. `PROMPTS.md` has prompts for generating
them from your product photos.

## Preview locally

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

Use a local server, not a double-clicked `index.html`, because ES modules
don't load from `file://`.

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
index.html          the page
404.html            branded not-found page
css/style.css       design system and layout
js/config.js        business details and gallery list  ← edit me
js/app.js           UI: nav, hero video, gallery, reveals, form
assets/             favicon, images, gallery (and video/, when added)
PROMPTS.md          art direction and AI photo/video prompts
CNAME / .nojekyll   GitHub Pages config
```
