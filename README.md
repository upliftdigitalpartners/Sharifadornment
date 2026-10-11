# Sharif Adornment — sharifadornment.com

A single-page, animated site for **Sharif Adornment**, a jewelry and
accessories boutique in Queens, NY. It's built with plain HTML, CSS and JS,
plus [Three.js](https://threejs.org) for the 3D scene. It has **no build
step**, and GitHub Pages serves it as is.

## What's in it

- **3D centerpiece (Three.js):** a fanned stack of gold kangan bangles with
  milgrain bead rims and a row of ruby and emerald stones. Around them drifts a
  pearl mala with a ruby drop, plus gold orbit lines carrying gems, and gold
  dust. It glides to a new pose for each section as you scroll. It reacts to
  the mouse, spins faster when you scroll fast, and the gold reflections slowly
  roll.
- **Sections:** Hero → Collections (6) → Our Story → How to Order → For the
  Occasion → Gallery (photos and reels) → Enquire → Footer.
- **Details:** monogram loader, custom gold cursor, magnetic buttons, 3D card
  tilt with a light sheen, scroll reveals, parallax, shimmering gold type, a
  film-grain overlay, and a marquee.
- **Enquiry form:** opens a pre-filled **text message** on phones. On desktop
  it copies the note and opens **Messenger**, or opens email if an email
  address is set in the config. It needs no backend.
- **Accessible and fast:** honours *reduced motion*, falls back gracefully
  without WebGL, uses lighter rendering on phones, includes SEO and
  link-preview tags, and has `JewelryStore` structured data.

## Editing content

| What | Where |
|---|---|
| Phone, email, Facebook links, location line | `js/config.js` |
| Gallery photos and reels | drop files in `assets/gallery/`, list them in `js/config.js` |
| Collection covers, story image, link-preview image | `assets/img/` (see the table in `PROMPTS.md`) |
| Wording | `index.html` |
| Colours and fonts | top of `css/style.css` (`:root`) |
| Where the 3D jewel sits in each section | `data-ring="x,y,scale,tilt"` on each `<section>` |

**Reels:** export them from Facebook or your phone as `.mp4`. Keep each clip
under about 8 MB and 10–15 seconds. They autoplay muted and loop while on
screen.

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
js/app.js           UI: loader, nav, reveals, cursor, tilt, gallery, form
js/scene.js         Three.js scene
vendor/three/       Three.js r169 (vendored; no CDN dependency)
assets/             favicon, images, gallery
PROMPTS.md          art direction and AI image prompts
CNAME / .nojekyll   GitHub Pages config
```
