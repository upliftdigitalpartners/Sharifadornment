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
| **Pieces** | Change a price, or tap **Sold out / Featured / New**, right on the grid without opening the piece. Add, edit, delete and reorder. Main photo plus more photos and a short video; price, size, description; Featured / New / Last one / Sold out / Available to rent (with a rental price); pick up to 3 pieces to "complete the look". |
| **Collections** | Rename, describe, change covers, add, reorder. |
| **Bridal** | The Bridal page text and its looks: photo, title, description, and which pieces are in each look. |
| **Reviews** | Add real customer reviews (text, name, occasion, optional photo). |
| **FAQ** | Questions and answers, in order. |
| **Pages** | Every heading and message, the announcement banner, footer and the "Message us" button text. Wrap words in `*asterisks*` for gold italics. |
| **Gallery** | Add, describe, reorder and remove photos. |
| **Orders** | Every order placed on the site: status, tracking, payment, contact buttons, packing slip, review request, spreadsheet download. |
| **Shop** | Telegram order alerts, discount codes, delivery choices and fees, card payments, pay-later instructions, deposits, sales tax, rental deposit, checkout wording. |
| **Analytics** | Per month, compared with the month before: visits, page views, pieces viewed, questions and saves; visits per day; where visitors come from (Facebook, Instagram, Google, WhatsApp, typed in); phone, tablet or computer; the most viewed collections and pages; a table of every piece's views, questions, saves and shares; and the newsletter list, which you can copy or remove addresses from. Add `?demo` to the Studio address to see it with sample numbers. |
| **History** | Every published version, with **Restore**, which loads it as unpublished changes. |
| **Details** | Phone, WhatsApp, email, Messenger, Facebook, Instagram, location, and the hero videos (upload MP4 under 4 MB). |

**Preview** shows the real site with your unpublished changes. **Publish**
uploads new photos and videos, then the Studio API checks everything,
**rebuilds every page** (and the shop catalog) from the content, and saves it
all as one commit. The live site updates in about a minute. Add `?demo` to the
Studio address to try it without publishing.

**Unpublished changes are kept on the device.** A moment after each change the
Studio saves a draft, new photos included, in the browser. If the tab closes,
the phone restarts or the battery dies before Publish, the next time the Studio
opens on that device it offers to bring the changes back. Publishing or
discarding clears the draft.

**Photos** are saved in a full-size and a phone-size copy. Where the browser can
(Chrome, Android, Edge, Firefox) they are WebP, about half the size of JPG, so
pages load faster, plus a JPG copy used for Facebook link previews and the shop
catalog. Safari and iPhones save JPGs, which work everywhere too.

### Ordering on the site

**For customers.** Pieces with a plain price (like `$65`) get **Add to bag**;
pieces marked "Available to rent" with a rental price also get **Rent it for an
event** (pick the event date). The bag leads to **Checkout**:

- contact details, and a **delivery choice**: local delivery, shipping in the
  US and/or pickup / meet-up, each with its own fee and "free over" amount;
- a **discount code** box;
- **sales tax** if a rate is set, and a **refundable deposit** per rented piece;
- how to pay: **by card now** (Stripe), **a deposit by card now** (for orders
  over a set amount) or **after we confirm** (Zelle, Cash App, PayPal…).

Totals always come from the server, which prices everything from the published
content, so nobody can change what they pay. After ordering, the customer's
order page doubles as **tracking**: Placed → Confirmed → On its way →
Delivered, the tracking number, and what's left to pay. Once delivered it
offers **Leave a review**. **policies.html** (delivery, returns, rentals,
payment, privacy; edited in Pages → Policies page) is linked from checkout and
the footer, which Stripe and Facebook Shops expect.

**Stock.** Give a piece an **In stock** count in its editor (optional; it's
saved straight away, separately from Publish). Each order takes from it, the
site shows "Last one" at 1 and "Sold out" at 0, and orders can't take more
than there is. While a card payment is open the pieces are held; an unpaid
card checkout cancels itself after 35 minutes and puts them back. Cancelling an
order also puts them back.

**For the admin (Studio).**

- **Orders:** new-order count on the tab; Open / Delivered / Cancelled; each
  order's pieces, totals, customer, Text / WhatsApp / Call (with the tracking
  link), **Print slip**, status, tracking number, "Paid in full" for pay-later
  and deposit orders, private note, **Mark these pieces sold out**, **Ask for a
  review** once delivered, and **Download spreadsheet** (CSV) for bookkeeping.
- **Shop:** Telegram alerts, **discount codes** (% or $ off, minimum order, last
  day, maximum uses, pause), delivery choices and fees, card payments,
  pay-later instructions, deposit option, sales tax, rental deposit and the
  checkout wording.
- **Reviews:** reviews customers send wait under **Waiting for approval**;
  Approve adds them (with their stars) to the site on the next Publish.
- **Analytics → Sales:** orders, order value and what's been paid, average
  order, how many "added to bag" became orders, and best sellers.

**New-order alerts on your phone (Telegram, free, one-time):**
1. Install Telegram, message **@BotFather**, send `/newbot` and follow the
   steps. It gives you a **token**.
2. In Netlify → Project configuration → Environment variables, add
   `TELEGRAM_BOT_TOKEN` with that token (Functions scope, secret), then
   Deploys → Trigger deploy.
3. In Telegram, open your new bot and send it "hi". In the Studio → Shop →
   New-order alerts, tap **Find my chat**, then **Connect**. Repeat on other
   phones (or add the bot to a group) to alert more people. **Send a test
   alert** checks it.

You'll get a message for every new order, card payment, deposit, piece that
runs out, and review.

**Order emails to customers (optional):** create a free account at
resend.com, add and verify the domain sharifadornment.com there (it gives a
few DNS records to add in Squarespace), create an API key, and add on Netlify
`RESEND_API_KEY` and `ORDER_EMAIL_FROM` (e.g.
`Sharif Adornment <orders@sharifadornment.com>`). Customers who give an email
then get their order summary, and a note when it's on its way and delivered.

**Turning on card payments (one-time):**
1. Create a Stripe account at stripe.com and finish its business and bank
   details (payouts go to that bank account).
2. In Stripe → Developers → API keys, create a **restricted key** with
   *Checkout Sessions: Write* (everything else None), or use the secret key.
3. In Netlify, add `STRIPE_SECRET_KEY` with that key (Functions scope,
   secret), then Deploys → Trigger deploy.
4. In the Studio → Shop, tick **Accept card payments**, and Publish.

Stripe charges about 2.9% + 30¢ per card payment. Without step 3 the card
options stay hidden even if ticked. **Sales tax:** collecting NY sales tax
usually requires being registered with NY State; check with an accountant
before setting a rate.

### Facebook & Instagram Shop, Google Shopping

Every publish also rebuilds **https://sharifadornment.com/products.xml**, a
product catalog with each piece's name, description, photos, price, stock (Sold
out = out of stock), link and collection. Pieces need a plain dollar price
(like `$65`) to be listed; "Price on request" pieces are left out.

- **Facebook & Instagram:** in Meta Commerce Manager → Catalog → Data sources →
  Data feed → Scheduled feed, paste that address and set it to update daily.
  Then pieces can be shown in a Facebook/Instagram Shop and tagged in posts.
- **Google:** in Google Merchant Center → Products → Add products → Scheduled
  fetch, use the same address for free Google Shopping listings.

Each piece page also tells Google its price and whether it's in stock, so
searches can show "$65 · In stock".

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
netlify/functions/              Studio API: login, github, publish, stats, orders, shop; public: order, review, track, subscribe
netlify/lib/studio.mjs          sessions, CORS, GitHub access rules
netlify.toml, package.json      Netlify settings (API only); @netlify/blobs for analytics and the newsletter
assets/                         images (each with a -sm phone copy), pieces, gallery, video, uploads/
PROMPTS.md                      art direction and AI photo/video prompts
CNAME / .nojekyll               GitHub Pages config
```
