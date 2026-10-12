/* Sharif Adornment — full pages, built from content/site.json and content/items.json.
 *
 * buildSite(site, items) returns { "index.html": "...", "p/<id>.html": "...",
 * "sitemap.xml": "...", ... }. It runs in two places:
 *   - tools/build-pages.mjs, after changing these templates by hand
 *   - netlify/functions/studio-publish.mjs, every time the Studio publishes
 * so the HTML always matches the content (good for Google and link previews). */
import {
  esc, rich, img, motif, itemCard, collectionCard, pieceDetail, stepsHTML, pillarsHTML,
  paragraphsHTML, faqHTML, reviewsHTML, lookHTML, galleryHTML, bannerHTML, collectionName,
  priceLine, pieceUrl, waNumber, HEART, BAG, withPieces, shareImg, priceNumber,
} from "./render.mjs";

export const SITE_URL = "https://sharifadornment.com/";
const abs = (path) => SITE_URL + path.replace(/^\.?\//, "");

const NAV = [
  ["collections.html", "Collections"], ["bridal.html", "Bridal"], ["story.html", "Story"],
  ["gallery.html", "Gallery"], ["faq.html", "FAQ"], ["contact.html", "Enquire"],
];

const ICONS = {
  facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 8.5V6.8c0-.8.2-1.3 1.4-1.3H17V2.6C16.6 2.5 15.5 2.4 14.3 2.4c-2.6 0-4.3 1.6-4.3 4.4v1.7H7.2v3.2H10v9.9h4v-9.9h2.8l.4-3.2H14z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="17.4" cy="6.6" r="1.1"/></svg>',
  whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.2a9.7 9.7 0 0 0-8.4 14.6L2.3 21.8l5.1-1.3A9.7 9.7 0 1 0 12 2.2zm0 17.7a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 19.9zm4.4-6c-.2-.1-1.4-.7-1.7-.8-.2-.1-.4-.1-.5.1l-.8.9c-.1.2-.3.2-.5.1a6.5 6.5 0 0 1-3.2-2.8c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.7-1.8c-.2-.5-.4-.4-.5-.4h-.5a.9.9 0 0 0-.7.3 2.8 2.8 0 0 0-.9 2.1c0 1.2.9 2.4 1 2.6.1.2 1.8 2.7 4.3 3.8 1.6.7 2.2.7 3 .6.5-.1 1.4-.6 1.6-1.1.2-.6.2-1 .1-1.1l-.5-.3z"/></svg>',
};

const THEME_SCRIPT = `<script>
    /* Night mode: apply the saved (or system) theme before the page paints */
    try {
      var t = localStorage.getItem("sa-theme") || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      document.documentElement.dataset.theme = t;
    } catch (e) {}
  </script>`;

function shell(site, { file, title, desc, body, base = "", ogImage = "assets/img/og-image.jpg", jsonld = null, preload = "", page = "" }) {
  const canonical = abs(file === "index.html" ? "" : file);
  const b = site.business || {};
  const nav = NAV.map(([href, label]) =>
    `      <a href="${href}"${href === file ? ' aria-current="page"' : ""}>${label}</a>`).join("\n");
  const msgLabel = esc(site.nav?.book || "Message us");
  const social = [
    b.facebook && `<a href="${esc(b.facebook)}" target="_blank" rel="noopener" aria-label="Facebook">${ICONS.facebook}</a>`,
    b.instagram && `<a href="${esc(b.instagram)}" target="_blank" rel="noopener" aria-label="Instagram">${ICONS.instagram}</a>`,
    b.whatsapp && `<a href="https://wa.me/${waNumber(b.whatsapp)}" target="_blank" rel="noopener" aria-label="WhatsApp">${ICONS.whatsapp}</a>`,
  ].filter(Boolean).join("");
  const f = site.footer || {};
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  ${base ? `<base href="${base}" />\n  ` : ""}<title>${esc(title)}</title>
  <meta name="description" content="${esc(desc)}" />
  <meta name="theme-color" content="#f6f3ee" />
  ${THEME_SCRIPT}
  <link rel="canonical" href="${canonical}" />
  <link rel="icon" href="assets/favicon.svg" type="image/svg+xml" />

  <meta property="og:type" content="${page === "piece" ? "product" : "website"}" />
  <meta property="og:site_name" content="Sharif Adornment" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(desc)}" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:image" content="${esc(abs(shareImg(ogImage)))}" />
  <meta name="twitter:card" content="summary_large_image" />

  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500&display=swap" rel="stylesheet" />
  <link rel="stylesheet" href="css/style.css" />${preload}${jsonld ? `\n  <script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, "\\u003c")}</script>` : ""}
</head>
<body data-page="${page || file.replace(/\.html$/, "")}">
  <a class="skip" href="${base ? file : ""}#main">Skip to content</a>
  ${bannerHTML(site.banner)}
  <header class="nav">
    <a href="index.html" class="nav__brand" aria-label="Sharif Adornment home"><span class="caps">SHARIF</span> <span class="glitter">Adornment</span></a>
    <nav class="nav__links" id="menu" aria-label="Primary">
${nav}
      ${messageLink(site, "nav__cta", msgLabel)}
      <button class="nav__theme" type="button" data-theme-toggle>Night mode</button>
    </nav>
    <div class="nav__tools">
      <button class="icon-btn saved-toggle" type="button" data-saved-open aria-label="Saved pieces">${HEART}<span class="count" data-saved-count hidden>0</span></button>
      <button class="icon-btn bag-toggle" type="button" data-bag-open aria-label="Your bag">${BAG}<span class="count" data-bag-count hidden>0</span></button>
      <button class="icon-btn theme-toggle" type="button" data-theme-toggle aria-label="Switch to night mode" title="Night mode">
        <svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>
        <svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
      </button>
      <button class="nav__toggle" type="button" aria-controls="menu" aria-expanded="false">Menu</button>
    </div>
  </header>

  <main id="main">
${body}
  </main>

  <footer class="footer">
    <div class="footer__top">
      <div class="footer__about">
        <p class="footer__mark"><span class="caps">SHARIF</span> <em class="glitter">Adornment</em></p>
        <p class="footer__hours" data-t="footer.hours">${rich(f.hours || "")}</p>
        ${social ? `<div class="socials">${social}</div>` : ""}
      </div>
      <form class="newsletter" data-newsletter novalidate>
        <p class="label">Newsletter</p>
        <h3 data-t="footer.newsletterTitle">${rich(f.newsletterTitle || "")}</h3>
        <p class="newsletter__text" data-t="footer.newsletterText">${rich(f.newsletterText || "")}</p>
        <div class="newsletter__row">
          <input type="email" name="email" required autocomplete="email" placeholder="Email address" aria-label="Email address" />
          <button class="btn" type="submit">Sign up</button>
        </div>
        <p class="newsletter__note" role="status" aria-live="polite"></p>
      </form>
    </div>
    <nav class="footer__links" aria-label="More">
      <a href="collections.html">Collections</a><a href="bridal.html">Bridal</a><a href="order.html">How to order</a>
      <a href="faq.html">FAQ</a><a href="policies.html">Policies</a><a href="contact.html">Enquire</a>
    </nav>
    <div class="footer__row">
      <span><a class="footer__c" href="studio/" aria-label="Studio">©</a> <span class="js-year">${new Date().getFullYear()}</span> Sharif Adornment</span>
      <a href="${base ? file : ""}#main">Back to top</a>
    </div>
  </footer>

  <!-- Phones: always-reachable order buttons -->
  <div class="dock" data-dock aria-label="Quick contact">
    <a class="dock__btn" data-href="business.messenger" href="${esc(b.messenger || b.facebook || "contact.html")}" target="_blank" rel="noopener">Message us</a>
    ${b.whatsapp ? `<a class="dock__btn dock__btn--alt" href="https://wa.me/${waNumber(b.whatsapp)}" target="_blank" rel="noopener">WhatsApp</a>` : `<a class="dock__btn dock__btn--alt" data-tel="business.phone" href="${b.phone ? `tel:+1${String(b.phone).replace(/[^\d]/g, "").slice(-10)}` : "contact.html"}">Call</a>`}
  </div>

  <!-- Quick view, saved pieces and full-screen photos -->
  <dialog class="sheet" data-sheet aria-label="Piece details">
    <button class="sheet__close" type="button" data-sheet-close>Close</button>
    <div data-sheet-body></div>
  </dialog>
  <dialog class="sheet saved" data-saved aria-labelledby="saved-title">
    <button class="sheet__close" type="button" data-saved-close>Close</button>
    <div class="saved__inner">
      <p class="label">Your list</p>
      <h2 id="saved-title">Saved <em>pieces</em></h2>
      <p class="saved__empty" data-saved-empty>Tap the heart on any piece to save it here, then send us the whole list in one message.</p>
      <div class="saved__list" data-saved-list></div>
      <div class="saved__actions" data-saved-actions hidden>
        <button class="btn" type="button" data-ask-saved>Ask about these pieces</button>
        <a class="link" href="contact.html?saved=1">Use the enquiry form</a>
      </div>
    </div>
  </dialog>
  <dialog class="sheet saved bag" data-bag aria-labelledby="bag-title">
    <button class="sheet__close" type="button" data-bag-close>Close</button>
    <div class="saved__inner">
      <p class="label">Your order</p>
      <h2 id="bag-title">Your <em>bag</em></h2>
      <p class="saved__empty" data-bag-empty>Your bag is empty. Tap “Add to bag” on any piece with a price.</p>
      <div class="saved__list" data-bag-list></div>
      <dl class="bag__totals" data-bag-totals hidden></dl>
      <div class="saved__actions" data-bag-actions hidden>
        <a class="btn" href="checkout.html">Checkout</a>
        <button class="link" type="button" data-bag-close>Keep browsing</button>
      </div>
    </div>
  </dialog>
  <dialog class="zoom" data-zoom-view aria-label="Photo">
    <button class="sheet__close" type="button" data-zoom-close>Close</button>
    <div class="zoom__stage"><img alt="" /></div>
  </dialog>
  <div class="toast" data-toast role="status" aria-live="polite" popover="manual"></div>

  <script type="module" src="js/app.js"></script>
</body>
</html>
`;
}

const head = (prefix, site, { tag = "h2", row = "", intro = false } = {}) => {
  const s = prefix.split(".").reduce((v, k) => v?.[k], site) || {};
  return `      <header class="section__head${row ? " section__head--row" : ""}">
        <div>
          <p class="label reveal" data-t="${prefix}.label">${rich(s.label || "")}</p>
          <${tag} class="${tag === "h1" ? "page__title " : ""}reveal" data-t="${prefix}.title">${rich(s.title || "")}</${tag}>
          ${intro && s.intro ? `<p class="page__intro reveal" data-t="${prefix}.intro">${rich(s.intro)}</p>` : ""}
        </div>${row}
      </header>`;
};

const occasion = (site) => {
  const o = site.occasion || {};
  return `    <section class="occasion">
      <div class="occasion__inner reveal">
        ${motif("motif--short")}
        <p class="label" data-t="occasion.label">${rich(o.label)}</p>
        <h2 data-t="occasion.title">${rich(o.title)}</h2>
        <p data-t="occasion.text">${rich(o.text)}</p>
        <a href="contact.html" class="btn btn--light" data-t="occasion.button">${rich(o.button)}</a>
      </div>
    </section>`;
};

const reviewsSection = (site) => {
  const r = site.reviews || {};
  if (!(r.items || []).length) return `    <section class="section reviews" data-reviews-section hidden><div class="reviews__grid" data-reviews></div></section>`;
  return `    <section class="section reviews" data-reviews-section>
${head("reviews", site)}
      <div class="reviews__grid" data-reviews>${reviewsHTML(r.items)}</div>
    </section>`;
};

const skeleton = (n) => Array.from({ length: n }, () => '<div class="item item--skeleton" aria-hidden="true"><div class="item__img"></div><span></span><span></span></div>').join("");

/** The main "message us" link: Messenger if set, otherwise the enquiry page. */
function messageLink(site, cls, label, attrs = "") {
  const href = site.business?.messenger;
  return href
    ? `<a href="${esc(href)}" class="${cls}" data-href="business.messenger" target="_blank" rel="noopener"${attrs}>${label}</a>`
    : `<a href="contact.html" class="${cls}"${attrs}>${label}</a>`;
}

export function buildSite(site, items) {
  const h = site.home || {};
  const pages = {};
  const visible = items;

  pages["index.html"] = shell(site, {
    file: "index.html", page: "index",
    title: "Sharif Adornment — Jewelry & Accessories, Queens NY",
    desc: "South Asian jewelry and accessories in Queens, New York. Bridal sets, kundan, oxidized silver, pearl malas, bangles, jhumkas, potli bags and clutches. Delivery available.",
    preload: `\n  <link rel="preload" as="image" href="${esc(h.heroImage)}" />`,
    jsonld: {
      "@context": "https://schema.org", "@type": "OnlineStore", name: "Sharif Adornment", url: SITE_URL,
      image: abs("assets/img/og-image.jpg"), telephone: site.business?.phone ? `+1-${String(site.business.phone).replace(/[^\d]/g, "").slice(-10).replace(/(\d{3})(\d{3})(\d{4})/, "$1-$2-$3")}` : undefined,
      priceRange: "$$", areaServed: "US",
      sameAs: [site.business?.facebook, site.business?.instagram].filter(Boolean),
    },
    body: `    <section class="hero">
      <div class="hero__copy">
        <p class="label reveal" data-t="home.label">${rich(h.label)}</p>
        <h1 class="hero__title reveal" data-t="home.title">${rich(h.title)}</h1>
        <p class="hero__lede reveal" data-t="home.intro">${rich(h.intro)}</p>
        <div class="hero__actions reveal">
          <a href="collections.html" class="btn" data-t="home.button">${rich(h.button)}</a>
          ${messageLink(site, "link", esc(site.nav?.book || "Message us"), ' data-t="nav.book"')}
        </div>
      </div>
      <figure class="hero__media reveal" data-hero data-video="${esc(h.heroVideo || "")}" data-video-mobile="${esc(h.heroVideoMobile || "")}">
        ${img(h.heroImage, "A stack of carved antique-gold kangan bangles turning on a display stand", { sizes: "(max-width: 860px) 100vw, 55vw", lazy: false, attrs: 'fetchpriority="high" data-src="home.heroImage"' })}
      </figure>
    </section>

    ${motif()}

    <section class="section">
      <header class="section__head">
        <p class="label reveal" data-t="home.collectionsLabel">${rich(h.collectionsLabel)}</p>
        <h2 class="reveal" data-t="home.collectionsTitle">${rich(h.collectionsTitle)}</h2>
      </header>
      <div class="collections" data-collections>${withPieces(site, items).map(collectionCard).join("")}</div>
    </section>

    <section class="section" data-featured-section${visible.some((i) => i.featured) ? "" : " hidden"}>
      <header class="section__head section__head--row">
        <div>
          <p class="label reveal" data-t="home.featuredLabel">${rich(h.featuredLabel)}</p>
          <h2 class="reveal" data-t="home.featuredTitle">${rich(h.featuredTitle)}</h2>
        </div>
        <a class="link reveal" href="collections.html">View all pieces</a>
      </header>
      <div class="items items--row" data-featured>${visible.filter((i) => i.featured).map((it) => itemCard(it, site, { sizes: "(max-width: 860px) 64vw, 25vw" })).join("")}</div>
    </section>

    <section class="section story">
      <figure class="story__img reveal">${img(site.story?.image, "Gold and ruby bead necklace set displayed with flowers", { sizes: "(max-width: 860px) 100vw, 45vw", attrs: 'data-src="story.image"' })}</figure>
      <div class="story__copy">
        <p class="label reveal" data-t="story.label">${rich(site.story?.label)}</p>
        <h2 class="reveal" data-t="story.title">${rich(site.story?.title)}</h2>
        <p class="reveal" data-t="story.paragraphs.0">${rich(site.story?.paragraphs?.[0] || "")}</p>
        <a class="link reveal story__more" href="story.html" data-t="home.storyLink">${rich(h.storyLink)}</a>
      </div>
    </section>

${reviewsSection(site)}

${occasion(site)}`,
  });

  const cp = site.collectionsPage || {};
  pages["collections.html"] = shell(site, {
    file: "collections.html", title: "Collections — Sharif Adornment",
    desc: "Bridal sets, kundan and stone jewelry, oxidized silver, pearl malas, bangles, jhumkas, potli bags and clutches from Sharif Adornment in Queens, NY.",
    body: `    <section class="section section--first">
${head("collectionsPage", site, { tag: "h1", intro: true })}
      <div class="toolbar" data-toolbar>
        <label class="search"><span class="visually-hidden">Search pieces</span>
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>
          <input type="search" placeholder="Search — try “jhumka” or “red”" data-search autocomplete="off" />
        </label>
        <div class="filters" data-filters role="toolbar" aria-label="Filter pieces">
          <button type="button" class="chip" data-filter="all" aria-pressed="true">All</button>
          ${(site.collections || []).filter((c) => items.some((i) => i.collection === c.id)).map((c) => `<button type="button" class="chip" data-filter="${esc(c.id)}" aria-pressed="false">${esc(c.name)}</button>`).join("")}
          ${items.some((i) => i.rent) ? '<button type="button" class="chip" data-filter="rent" aria-pressed="false">For rent</button>' : ""}
        </div>
      </div>
      <p class="results" data-results aria-live="polite"></p>
      <div class="items" data-items>${items.map((it) => itemCard(it, site)).join("")}</div>
    </section>`,
  });

  const br = site.bridal || {};
  pages["bridal.html"] = shell(site, {
    file: "bridal.html", title: "Bridal — Sharif Adornment",
    desc: "Bridal jewelry looks from Sharif Adornment in Queens, NY — necklace sets, tikka, jhumkas, bangles and potlis. Ask us about any bridal look.",
    ogImage: br.looks?.[0]?.image || undefined,
    body: `    <section class="section section--first">
${head("bridal", site, { tag: "h1", intro: true })}
      <a href="contact.html?c=bridal" class="btn reveal" data-t="bridal.button">${rich(br.button || "")}</a>
    </section>
    ${motif("motif--gap")}
    <section class="section looks" data-looks>${(br.looks || []).map((l, i) => lookHTML(l, items, i)).join("")}</section>
${reviewsSection(site)}
${occasion(site)}`,
  });

  const st = site.story || {};
  pages["story.html"] = shell(site, {
    file: "story.html", title: "Our Story — Sharif Adornment",
    desc: "Sharif Adornment brings South Asian jewelry traditions to Queens — pieces chosen one by one for weddings, festivals and every celebration.",
    body: `    <section class="section section--first story">
      <figure class="story__img reveal">${img(st.image, "Gold and ruby bead necklace set displayed with flowers", { sizes: "(max-width: 860px) 100vw, 45vw", lazy: false, attrs: 'data-src="story.image"' })}</figure>
      <div class="story__copy">
        <p class="label reveal" data-t="story.label">${rich(st.label)}</p>
        <h1 class="page__title reveal" data-t="story.title">${rich(st.title)}</h1>
        <div class="story__text reveal" data-paragraphs="story.paragraphs">${paragraphsHTML(st.paragraphs)}</div>
        <dl class="pillars reveal" data-pillars>${pillarsHTML(st.pillars)}</dl>
      </div>
    </section>
    ${motif("motif--gap")}
    <section class="section section--tight cta">
      <h2 class="reveal" data-t="occasion.title">${rich(site.occasion?.title)}</h2>
      <a href="collections.html" class="btn reveal">Explore the collections</a>
    </section>`,
  });

  pages["order.html"] = shell(site, {
    file: "order.html", title: "How to Order — Sharif Adornment",
    desc: "Browse, message, confirm and get your jewelry delivered. How ordering from Sharif Adornment in Queens, NY works.",
    body: `    <section class="section section--first">
${head("order", site, { tag: "h1" })}
      <ol class="steps" data-steps>${stepsHTML(site.order?.steps)}</ol>
    </section>
${occasion(site)}`,
  });

  const g = site.gallery || {};
  pages["gallery.html"] = shell(site, {
    file: "gallery.html", title: "Gallery — Sharif Adornment",
    desc: "Recent jewelry, bridal sets, potlis and clutches from Sharif Adornment in Queens, NY.",
    body: `    <section class="section section--first">
${head("gallery", site, { tag: "h1", row: `
        <a class="link reveal" data-href="business.facebook" href="${esc(site.business?.facebook || "#")}" target="_blank" rel="noopener" data-t="gallery.link">${rich(g.link)}</a>` })}
      <div class="gallery gallery--grid" data-gallery>${galleryHTML(g.images)}</div>
    </section>
    ${g.facebookFeed && site.business?.facebook ? `<section class="section feed" data-feed>
      <header class="section__head"><p class="label reveal">Facebook</p><h2 class="reveal" data-t="gallery.feedTitle">${rich(g.feedTitle || "")}</h2></header>
      <div class="feed__frame reveal" data-feed-frame data-page-url="${esc(site.business.facebook)}">
        <p>See our newest posts and reels without leaving the site.</p>
        <button class="btn btn--ghost" type="button" data-feed-load>Show Facebook posts</button>
        <small>Loads content from Facebook.</small>
      </div>
    </section>` : ""}`,
  });

  const fq = site.faq || {};
  pages["faq.html"] = shell(site, {
    file: "faq.html", title: "FAQ — Sharif Adornment",
    desc: "Ordering, delivery, video calls, rentals and jewelry care — answers to common questions about Sharif Adornment in Queens, NY.",
    jsonld: {
      "@context": "https://schema.org", "@type": "FAQPage",
      mainEntity: (fq.items || []).map((x) => ({ "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } })),
    },
    body: `    <section class="section section--first faq">
${head("faq", site, { tag: "h1", intro: true })}
      <div class="faq__list" data-faq>${faqHTML(fq.items)}</div>
    </section>
    ${motif("motif--gap")}
    <section class="section section--tight cta">
      <h2 class="reveal">Still wondering about <em>something?</em></h2>
      <div class="cta__actions reveal">
        ${messageLink(site, "btn", "Message us")}
        <a href="contact.html" class="link">Send an enquiry</a>
      </div>
    </section>`,
  });

  // Appointments were retired; old links to book.html land on the enquiry page
  pages["book.html"] = `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><title>Sharif Adornment</title>
<meta name="robots" content="noindex" /><link rel="icon" href="assets/favicon.svg" type="image/svg+xml" /><link rel="canonical" href="${abs("contact.html")}" />
<meta http-equiv="refresh" content="0; url=contact.html" /></head>
<body><p><a href="contact.html">Continue to Sharif Adornment</a></p></body></html>
`;

  // Ordering: the bag turns into an order here. Totals, delivery choices and ways to pay
  // come from the order service (/api/order "quote"), which prices everything itself.
  const co = site.checkout || {};
  pages["checkout.html"] = shell(site, {
    file: "checkout.html", title: "Checkout — Sharif Adornment",
    desc: "Place your Sharif Adornment order: delivery details and payment.",
    body: `    <section class="section section--first checkout">
      <div class="checkout__copy">
        <p class="label reveal" data-t="checkout.label">${rich(co.label || "Checkout")}</p>
        <h1 class="page__title reveal" data-t="checkout.title">${rich(co.title || "")}</h1>
        <p class="reveal" data-t="checkout.intro">${rich(co.intro || "")}</p>
        <div class="checkout__summary" data-checkout-summary><p class="muted">Loading your bag…</p></div>
      </div>
      <form class="enquiry checkout__form" data-form="checkout" novalidate hidden>
        <fieldset><legend class="label">Your details</legend>
          <div class="field"><label for="c-name">Full name</label><input id="c-name" name="name" required autocomplete="name" /></div>
          <div class="field-row">
            <div class="field"><label for="c-phone">Phone</label><input id="c-phone" name="phone" type="tel" required autocomplete="tel" placeholder="We'll text to confirm" /></div>
            <div class="field"><label for="c-email">Email <small>(optional)</small></label><input id="c-email" name="email" type="email" autocomplete="email" placeholder="For your receipt" /></div>
          </div>
        </fieldset>
        <fieldset class="pay"><legend class="label">Delivery</legend><div data-methods></div></fieldset>
        <fieldset data-address><legend class="label">Delivery address</legend>
          <div class="field"><label for="c-address">Street address</label><input id="c-address" name="address" required autocomplete="street-address" /></div>
          <div class="field-row field-row--3">
            <div class="field"><label for="c-city">City</label><input id="c-city" name="city" required autocomplete="address-level2" /></div>
            <div class="field"><label for="c-state">State</label><input id="c-state" name="state" value="NY" autocomplete="address-level1" /></div>
            <div class="field"><label for="c-zip">ZIP</label><input id="c-zip" name="zip" required inputmode="numeric" autocomplete="postal-code" /></div>
          </div>
        </fieldset>
        <div class="field"><label for="c-notes">Notes <small>(optional)</small></label><textarea id="c-notes" name="notes" rows="2" placeholder="Event date, gift message, delivery instructions…"></textarea></div>
        <fieldset class="pay"><legend class="label">Payment</legend><div data-pays></div></fieldset>
        <div class="hp" aria-hidden="true"><label>Leave empty <input name="website" tabindex="-1" autocomplete="off" /></label></div>
        <button type="submit" class="btn btn--block" data-place>Place order</button>
        <p class="checkout__agree">By placing your order you agree to our <a href="policies.html" target="_blank">shipping, returns and rental policies</a>.</p>
        <p class="enquiry__note" role="status" aria-live="polite"></p>
      </form>
    </section>`,
  });
  pages["order-done.html"] = shell(site, {
    file: "order-done.html", title: "Your order — Sharif Adornment",
    desc: "Your Sharif Adornment order.",
    body: `    <section class="section section--first order-done" data-order-done>
      <p class="label">Your order</p>
      <h1 class="page__title" data-order-title>Thank <em>you.</em></h1>
      <div data-order-view><p class="muted">Loading your order…</p></div>
    </section>`,
  });
  pages["review.html"] = shell(site, {
    file: "review.html", title: "Leave a review — Sharif Adornment",
    desc: "Tell us how you liked your Sharif Adornment pieces.",
    body: `    <section class="section section--first order-done">
      <p class="label">Your review</p>
      <h1 class="page__title">How did we <em>do?</em></h1>
      <form class="enquiry review-form" data-form="review" novalidate>
        <fieldset class="stars" data-stars><legend class="label">Your rating</legend>
          ${[1, 2, 3, 4, 5].map((n) => `<label><input type="radio" name="rating" value="${n}"${n === 5 ? " checked" : ""} /><span aria-label="${n} star${n > 1 ? "s" : ""}">★</span></label>`).join("")}
        </fieldset>
        <div class="field"><label for="r-text">Your review</label><textarea id="r-text" name="text" rows="4" required placeholder="How did it look on the day? How was ordering?"></textarea></div>
        <div class="field"><label for="r-name">Name to show</label><input id="r-name" name="name" autocomplete="given-name" placeholder="e.g. Ayesha, Queens" /></div>
        <button type="submit" class="btn btn--block">Send review</button>
        <p class="enquiry__note" role="status" aria-live="polite"></p>
      </form>
    </section>`,
  });
  const pol = site.policies || {};
  const polSections = [["shipping", "Delivery & shipping"], ["returns", "Returns & exchanges"], ["rentals", "Rentals"], ["payment", "Payment"], ["privacy", "Privacy"]]
    .filter(([k]) => pol[k]);
  pages["policies.html"] = shell(site, {
    file: "policies.html", title: "Policies — Sharif Adornment",
    desc: "Delivery, returns, rentals, payment and privacy at Sharif Adornment.",
    body: `    <section class="section section--first policies">
      <p class="label reveal" data-t="policies.label">${rich(pol.label || "Policies")}</p>
      <h1 class="page__title reveal" data-t="policies.title">${rich(pol.title || "")}</h1>
      ${pol.intro ? `<p class="page__intro reveal" data-t="policies.intro">${rich(pol.intro)}</p>` : ""}
      ${polSections.map(([k, t]) => `<section class="policy reveal" id="${k}"><h2>${t}</h2><div data-paragraphs="policies.${k}">${paragraphsHTML(pol[k])}</div></section>`).join("")}
      <p class="policy__contact">Questions? <a href="contact.html">Send us a message</a>${site.business?.phone ? ` or call ${esc(site.business.phone)}` : ""}.</p>
    </section>`,
  });

  const ct = site.contact || {};
  const b = site.business || {};
  pages["contact.html"] = shell(site, {
    file: "contact.html", title: "Enquire & Order — Sharif Adornment",
    desc: "Ask about a piece, availability or delivery. Message Sharif Adornment on Messenger, call or text, or send an enquiry.",
    body: `    <section class="section section--first contact">
      <div class="contact__copy">
        <p class="label reveal" data-t="contact.label">${rich(ct.label)}</p>
        <h1 class="page__title reveal" data-t="contact.title">${rich(ct.title)}</h1>
        <p class="reveal" data-t="contact.text">${rich(ct.text)}</p>
        <dl class="channels reveal">
          ${b.messenger ? `<div><dt>Message</dt><dd><a href="${esc(b.messenger)}" target="_blank" rel="noopener">Facebook Messenger</a></dd></div>` : ""}
          ${b.whatsapp ? `<div><dt>WhatsApp</dt><dd><a href="https://wa.me/${waNumber(b.whatsapp)}" target="_blank" rel="noopener">${esc(b.whatsapp)}</a></dd></div>` : ""}
          ${b.phone ? `<div><dt>Call or text</dt><dd><a href="tel:+1${String(b.phone).replace(/[^\d]/g, "").slice(-10)}">${esc(b.phone)}</a></dd></div>` : ""}
          ${b.email ? `<div><dt>Email</dt><dd><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></dd></div>` : ""}
          ${b.instagram ? `<div><dt>Instagram</dt><dd><a href="${esc(b.instagram)}" target="_blank" rel="noopener">Instagram</a></dd></div>` : ""}
          ${b.facebook ? `<div><dt>Follow</dt><dd><a href="${esc(b.facebook)}" target="_blank" rel="noopener">@SharifAdornment</a></dd></div>` : ""}
          <div><dt>Based in</dt><dd>${esc(b.location)}</dd></div>
        </dl>
      </div>
      <form class="enquiry reveal" data-form="enquiry" novalidate>
        <div class="field"><label for="f-name">Your name</label><input id="f-name" name="name" type="text" required autocomplete="name" /></div>
        <div class="field"><label for="f-contact">Phone or email</label><input id="f-contact" name="contact" type="text" required autocomplete="tel" /></div>
        <div class="field"><label for="f-topic">I'm interested in</label>
          <select id="f-topic" name="topic" data-topics>${[...(site.collections || []).map((c) => c.name), "Help me choose"].map((n, i, a) => `<option${i === a.length - 1 ? " selected" : ""}>${esc(n)}</option>`).join("")}</select></div>
        <div class="field"><label for="f-msg">Message</label><textarea id="f-msg" name="message" rows="4" required placeholder="The occasion, colours, the piece you saw…"></textarea></div>
        <button type="submit" class="btn btn--block" data-t="contact.button">${rich(ct.button)}</button>
        <p class="enquiry__note" role="status" aria-live="polite"></p>
      </form>
    </section>`,
  });

  // One page per piece: shareable, with its own photo in link previews
  for (const it of items) {
    const col = collectionName(site, it.collection);
    const more = items.filter((x) => x.collection === it.collection && x.id !== it.id).slice(0, 4);
    const desc = `${it.description || it.name} ${priceLine(it)}. Sharif Adornment, Queens NY.`.trim();
    pages[pieceUrl(it)] = shell(site, {
      file: pieceUrl(it), base: "../", page: "piece",
      title: `${it.name} — Sharif Adornment`, desc, ogImage: shareImg(it.image) || undefined,
      jsonld: {
        "@context": "https://schema.org", "@type": "Product", name: it.name, description: it.description || undefined,
        image: [it.image, ...(it.images || [])].filter(Boolean).map((x) => abs(shareImg(x))), category: col || undefined,
        brand: { "@type": "Brand", name: "Sharif Adornment" }, url: abs(pieceUrl(it)),
        // Lets Google show the price and stock in search results
        offers: priceNumber(it) == null ? undefined : {
          "@type": "Offer", price: priceNumber(it).toFixed(2), priceCurrency: "USD", url: abs(pieceUrl(it)),
          availability: `https://schema.org/${it.soldOut ? "OutOfStock" : "InStock"}`,
          itemCondition: "https://schema.org/NewCondition",
        },
      },
      body: `    <section class="section section--first piece-page" data-piece="${esc(it.id)}">
      <nav class="crumbs" aria-label="Breadcrumb"><a href="collections.html">Collections</a><span>/</span><a href="collections.html?c=${encodeURIComponent(it.collection)}">${esc(col)}</a></nav>
      ${pieceDetail(it, site, items, { heading: "h1" })}
    </section>
    ${more.length ? `<section class="section section--tight">
      <header class="section__head section__head--row"><div><p class="label">${esc(col)}</p><h2>More like <em>this.</em></h2></div><a class="link" href="collections.html?c=${encodeURIComponent(it.collection)}">See all</a></header>
      <div class="items items--row">${more.map((x) => itemCard(x, site, { sizes: "(max-width: 860px) 64vw, 25vw" })).join("")}</div>
    </section>` : ""}`,
    });
  }

  const urls = ["", "collections.html", "bridal.html", "story.html", "order.html", "gallery.html", "faq.html", "policies.html", "contact.html", ...items.map(pieceUrl)];
  // Product catalog for Facebook & Instagram Shops (Commerce Manager) and Google Merchant Center.
  // Pieces need a plain dollar price and a photo to be listed.
  const listed = items.filter((it) => priceNumber(it) != null && it.image);
  pages["products.xml"] = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
<channel>
<title>Sharif Adornment</title>
<link>${SITE_URL}</link>
<description>South Asian jewelry and accessories</description>
${listed.map((it) => `<item>
  <g:id>${esc(it.id)}</g:id>
  <g:title>${esc(it.name)}</g:title>
  <g:description>${esc(it.description || it.name)}</g:description>
  <g:link>${esc(abs(pieceUrl(it)))}</g:link>
  <g:image_link>${esc(abs(shareImg(it.image)))}</g:image_link>
${(it.images || []).slice(0, 10).map((x) => `  <g:additional_image_link>${esc(abs(shareImg(x)))}</g:additional_image_link>\n`).join("")}  <g:availability>${it.soldOut ? "out of stock" : "in stock"}</g:availability>
  <g:condition>new</g:condition>
  <g:price>${priceNumber(it).toFixed(2)} USD</g:price>
  <g:brand>Sharif Adornment</g:brand>
  <g:product_type>${esc(collectionName(site, it.collection))}</g:product_type>
</item>`).join("\n")}
</channel>
</rss>
`;

  pages["sitemap.xml"] = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.map((u) => `  <url><loc>${abs(u)}</loc></url>`).join("\n")}\n</urlset>\n`;
  return pages;
}

export { skeleton };
