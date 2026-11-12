/* Sharif Adornment — Studio helpers.
 * Small tools with no page of their own, used by studio.js: the name spell-check,
 * description suggestions, price maths for bulk edits, ready-made customer messages
 * and the Instagram image maker. Kept apart so each can be tested by itself. */
(() => {
  /* ---------- Spell-check for piece and collection names ----------
   * Many names are Bangla or Hindi words (Pushpodhara, Noor-e-Moti), which a normal
   * spell-checker would flag. This one only knows common jewelry words, and speaks up
   * when a word is one slip away from one of them ("Neckalce", "Earings", "Mossanite"). */
  const KNOWN = new Set(("necklace necklaces earring earrings bracelet bracelets choker chokers pendant pendants bangle bangles " +
    "jhumka jhumkas kundan polki moissanite meenakari pearl pearls silver golden antique oxidized oxidised emerald sapphire maroon " +
    "turquoise exclusive premium collection peacock floral finger stone stones multicolor multicolored multicolour multicoloured " +
    "inspired statement traditional bridal clutch clutches anklet anklets chandbali hathphool temple design designs designer " +
    "elegant classic vintage waterfall fringe illusion radiance garden spiraling spiralling waterdrop medallion embroidered " +
    "adjustable accessories jewelry jewellery").split(" "));
  // Real words that sit one letter from a known one, so must never be "corrected"
  const FINE = new Set("pearly stoned banged signer fingers singer silvery premier floras designed".split(" "));

  // True when two words differ by one letter added, dropped, changed or swapped with its neighbour
  function oneSlip(a, b) {
    if (a === b || Math.abs(a.length - b.length) > 1) return false;
    let i = 0;
    while (i < a.length && i < b.length && a[i] === b[i]) i++;
    const rest = (x, n) => x.slice(i + n);
    if (a.length === b.length) return rest(a, 1) === rest(b, 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && rest(a, 2) === rest(b, 2));
    return a.length > b.length ? rest(a, 1) === rest(b, 0) : rest(a, 0) === rest(b, 1);
  }
  function betterWord(word) {
    const w = word.toLowerCase();
    if (w.length < 6 || KNOWN.has(w) || FINE.has(w) || !/^[a-z]+$/.test(w)) return "";
    for (const k of KNOWN) if (k.length >= 6 && oneSlip(w, k)) return k;
    return "";
  }
  const likeCase = (from, to) => (from === from.toUpperCase() && from.length > 1 ? to.toUpperCase() : /^[A-Z]/.test(from) ? to[0].toUpperCase() + to.slice(1) : to);

  /** The name with likely slips fixed: typos in jewelry words, doubled spaces, a lower-case first letter */
  function fixName(name) {
    let out = String(name || "").replace(/\s+/g, " ").trim();
    out = out.replace(/[A-Za-z]+/g, (w) => { const b = betterWord(w); return b ? likeCase(w, b) : w; });
    return out.replace(/^[a-z]/, (c) => c.toUpperCase());
  }
  /** Short notes on what fixName would change, for showing under the field */
  function nameIssues(name) {
    const raw = String(name || "");
    const notes = [];
    for (const w of raw.match(/[A-Za-z]+/g) || []) { const b = betterWord(w); if (b) notes.push(`“${w}” → “${likeCase(w, b)}”`); }
    if (/\s{2,}/.test(raw.trim())) notes.push("extra spaces");
    if (/^\s*[a-z]/.test(raw)) notes.push("starts with a small letter");
    return notes;
  }

  /* ---------- Description suggestions ----------
   * Written only from what the name and collection already say (type, style, colours),
   * so nothing is claimed about a piece that isn't known. Always meant to be edited. */
  const pickBy = (seed, list) => list[[...String(seed)].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7) % list.length];
  // What the piece is, read from its name (the first match wins)…
  const TYPES = [
    [/hath\s?phool/, "hathphool"], [/finger ring|\bring\b/, "ring"], [/potli/, "potli bag"], [/clutch/, "clutch"],
    [/bangle|kada|kangan|churi/, "bangles"], [/choker/, "choker"], [/mala\b|haar\b|long necklace|rani/, "long necklace"],
    [/necklace|neckalce/, "necklace"], [/pendant|pendent/, "pendant"], [/jhumka/, "jhumkas"],
    [/ear+ing|ear ?cuff|chandbali/, "earrings"], [/tikka|tikli/, "tikka"],
  ];
  // …or, failing that, from its collection
  const COLLECTION_TYPES = [[/ear+ing|jhumka/, "earrings"], [/bangle|cuff/, "bangles"], [/potli|clutch/, "bag"], [/ring/, "ring"], [/mala/, "long necklace"], [/necklace/, "necklace"]];
  const STYLES = [
    [/kundan/, "kundan-style"], [/polki/, "polki-style"], [/pachi/, "pachi-work"], [/jadau/, "jadau-style"],
    [/moissanite|mossanite/, "moissanite-look"], [/meenakari|mina/, "meenakari"], [/pearl|moti/, "pearl"],
    [/silver look|oxidi[sz]ed|silver illusion/, "silver-look"], [/antique/, "antique-finish"], [/dual tone/, "dual-tone"],
    [/temple/, "temple-style"], [/peacock|moyur|mayur/, "peacock-motif"], [/floral|flower|phul|garden|rose/, "floral"],
    [/fusion/, "fusion"], [/sabyasachi/, "designer-inspired"],
  ];
  const COLOURS = ["maroon", "green", "pink", "blue", "red", "white", "black", "mint", "purple", "yellow", "orange", "turquoise", "ruby", "emerald", "multicolor", "multicolored", "golden", "gold"];
  function suggestDescription(it, collectionName = "") {
    const name = String(it.name || "").trim();
    const low = name.toLowerCase(), col = String(collectionName).toLowerCase();
    const isSet = /\bset\b/i.test(name) && !/set of/i.test(name);
    const type = (TYPES.find(([re]) => re.test(low)) || (isSet ? [0, "piece"] : COLLECTION_TYPES.find(([re]) => re.test(col))) || [0, "piece"])[1];
    // Styles named in the piece itself; if it names none, one from its collection
    let styles = STYLES.filter(([re]) => re.test(low)).map(([, s]) => s).slice(0, 2);
    if (!styles.length) styles = STYLES.filter(([re]) => re.test(col)).map(([, s]) => s).slice(0, 1);
    const colours = [...new Set(COLOURS.filter((c) => new RegExp(`\\b${c}\\b`).test(name.toLowerCase())).map((c) => c.replace(/^multicolor(ed)?$/, "multicolour").replace(/^gold$/, "golden")))].slice(0, 3);
    const options = (it.options || []).map((o) => o.name).filter(Boolean);
    const noun = isSet && type !== "piece" ? `${type} set` : isSet ? "set" : type === "bag" ? "bag" : type;
    const lead = [...styles, noun].join(" ");
    const an = /^[aeiou]/.test(lead) ? "An" : "A";
    const plural = /s$/.test(noun) && !/necklace$|choker$/.test(noun);
    const colourBit = colours.length ? ` in ${colours.length > 1 ? `${colours.slice(0, -1).join(", ")} and ${colours.at(-1)}` : colours[0]} tones` : "";
    const first = plural ? `${lead[0].toUpperCase()}${lead.slice(1)}${colourBit}.` : `${an} ${lead}${colourBit}.`;
    const wear = {
      "hathphool": ["Made for mehndi nights and wedding photos.", "A finishing touch for bridal and festive looks."],
      "ring": ["An easy way to finish a festive look.", "Pairs well with bangles or a hathphool."],
      "potli bag": ["Roomy enough for the essentials at a wedding or dawat.", "Carries your phone and lipstick through any celebration."],
      "clutch": ["An evening bag for weddings, receptions and dinners.", "Finishes a saree or lehenga look."],
      "bangles": ["Stack them for mehndi, Eid or a wedding.", "Wear them together or mix them with your own."],
      "jhumkas": ["A classic for sarees, kurtis and lehengas alike.", "Lovely for Eid, weddings and dawats."],
      "earrings": ["Easy to dress up or down, from dawats to weddings.", "A pretty finish for festive outfits."],
      "choker": ["Sits high on the neck, lovely with open necklines.", "Made for weddings, mehndi and Eid."],
      "long necklace": ["Wear it alone or layer it over a choker.", "A graceful length for sarees and lehengas."],
      "pendant": ["Simple to wear, day or evening.", "A light touch for kurtis and sarees."],
      "tikka": ["Completes a bridal or mehndi look.", "A traditional finish for festive hair."],
      "necklace": ["Made for weddings, mehndi and Eid.", "Dresses up a saree, lehenga or kameez."],
      "piece": ["Lovely for weddings, Eid and every celebration.", "A festive touch for special days."],
      "bag": ["A pretty finish for wedding and festive outfits.", "Carries the essentials through any celebration."],
    }[type];
    const close = ["Message us for more photos or a quick video before you order.", "Want to see it closer? Message us for more photos.", "Ask us for a video if you'd like a closer look."];
    return [
      first,
      isSet ? pickBy(name, ["The pieces are matched to be worn together.", "A coordinated set, ready to wear together."]) : "",
      pickBy(`${name}w`, wear),
      options.length > 1 ? `Available in ${options.slice(0, -1).join(", ")} and ${options.at(-1)}.` : "",
      it.size ? `Size: ${it.size}.` : "",
      pickBy(`${name}c`, close),
    ].filter(Boolean).join(" ");
  }

  /* ---------- Bulk price changes ---------- */
  const priceOf = (v) => { const m = String(v ?? "").trim().match(/^\$?\s*(\d[\d,]*(?:\.\d{1,2})?)\s*\$?$/); return m ? Number(m[1].replace(/,/g, "")) : null; };
  const asPrice = (n) => `$${Number(n.toFixed(2))}`;
  /** A new price, or null when the piece has no plain price or the result wouldn't make sense */
  function changedPrice(price, { dir = "up", amount = 0, unit = "$", whole = true } = {}) {
    const now = priceOf(price), by = Number(amount);
    if (now == null || !(by > 0)) return null;
    const delta = unit === "%" ? (now * by) / 100 : by;
    let next = dir === "down" ? now - delta : now + delta;
    next = whole ? Math.round(next) : Math.round(next * 100) / 100;
    return next >= 1 && next !== now ? next : null;
  }

  /* ---------- Ready-made messages for an order ---------- */
  const usd = (n) => `$${Number(n || 0).toFixed(2).replace(/\.00$/, "")}`;
  function orderMessage(o, checkout = {}) {
    const first = String(o.customer?.name || "").trim().split(/\s+/)[0] || "there";
    const lines = o.lines.map((l) => `• ${l.name}${l.qty > 1 ? ` × ${l.qty}` : ""} — ${usd(l.price * l.qty)}`).join("\n");
    const balance = Math.max(0, o.total - (o.amountPaid || 0));
    const howToPay = balance > 0.005 && o.status !== "cancelled"
      ? `\n\n${o.amountPaid ? `Balance due: ${usd(balance)}` : `Total: ${usd(o.total)}`}\n${String(checkout.payLater || "").trim() ? `To pay:\n${checkout.payLater.trim()}` : `You can pay by ${checkout.payMethods || "Zelle, Cash App or PayPal"} — reply here and we'll send the details.`}\nPlease add ${o.id} to the payment note.`
      : "";
    const hi = `Hi ${first}, this is Sharif Adornment.`;
    if (o.status === "cancelled") return `${hi} Your order ${o.id} has been cancelled. If that's a surprise, just reply and we'll sort it out.`;
    if (o.status === "delivered") return `Hi ${first}! We hope you love your pieces from Sharif Adornment. Would you leave us a quick review? It means a lot to a small shop.\n${o.reviewUrl}`;
    if (o.status === "shipped") {
      const t = o.tracking?.number ? `\n${o.tracking.carrier || "Tracking"}: ${o.tracking.number}` : "";
      return `${hi} Your order ${o.id} is on its way!${t}\nFollow it here: ${o.trackUrl}${howToPay}`;
    }
    const paid = balance <= 0.005 ? `\n\nWe've received your payment of ${usd(o.total)} — thank you!` : "";
    return `${hi} Your order ${o.id} is confirmed ✅\n${lines}${paid}${howToPay}\n\nFollow your order here: ${o.trackUrl}`;
  }

  /* ---------- Instagram images: a square post and a tall story, with name and price ---------- */
  function loadImage(src) {
    return new Promise((ok, fail) => { const im = new Image(); im.onload = () => ok(im); im.onerror = () => fail(new Error("That photo couldn't be loaded.")); im.src = src; });
  }
  function wrap(ctx, text, maxWidth, maxLines) {
    const words = String(text).split(/\s+/), lines = [];
    let line = "";
    for (const w of words) {
      const next = line ? `${line} ${w}` : w;
      if (ctx.measureText(next).width > maxWidth && line) { lines.push(line); line = w; } else line = next;
    }
    if (line) lines.push(line);
    if (lines.length > maxLines) { lines.length = maxLines; lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\W*\w+$/, "")}…`; }
    return lines;
  }
  /** Draws onto a 1080-wide canvas: the photo filling it, then name, price and the site address */
  async function drawPost(canvas, { photo, name, price, tall = false, badge = "" }) {
    const W = 1080, H = tall ? 1920 : 1080;
    Object.assign(canvas, { width: W, height: H });
    const ctx = canvas.getContext("2d");
    try { await Promise.all([document.fonts.load('400 80px "Instrument Serif"'), document.fonts.load('italic 400 40px "Instrument Serif"'), document.fonts.load('500 30px "Inter"')]); } catch (_) { /* falls back to system fonts */ }
    const im = await loadImage(photo);
    ctx.fillStyle = "#151413";
    ctx.fillRect(0, 0, W, H);
    // Fill the frame, keeping the middle of the photo
    const scale = Math.max(W / im.width, H / im.height);
    const w = im.width * scale, h = im.height * scale;
    ctx.drawImage(im, (W - w) / 2, (H - h) / 2, w, h);
    // Soft dark bands so the words read on any photo
    const top = ctx.createLinearGradient(0, 0, 0, 260);
    top.addColorStop(0, "rgba(10,9,8,.55)"); top.addColorStop(1, "rgba(10,9,8,0)");
    ctx.fillStyle = top; ctx.fillRect(0, 0, W, 260);
    const baseY = tall ? H - 760 : H - 520;
    const bottom = ctx.createLinearGradient(0, baseY, 0, H);
    bottom.addColorStop(0, "rgba(10,9,8,0)"); bottom.addColorStop(0.55, "rgba(10,9,8,.62)"); bottom.addColorStop(1, "rgba(10,9,8,.86)");
    ctx.fillStyle = bottom; ctx.fillRect(0, baseY, W, H - baseY);

    const pad = 72;
    ctx.textBaseline = "alphabetic";
    // Brand, top left
    ctx.fillStyle = "#f6f3ee";
    ctx.font = '400 40px "Instrument Serif", Georgia, serif';
    const y0 = tall ? 190 : 104;
    ctx.fillText("S H A R I F", pad, y0);
    const bw = ctx.measureText("S H A R I F ").width;
    ctx.font = 'italic 400 44px "Instrument Serif", Georgia, serif';
    ctx.fillStyle = "#e3c58f";
    ctx.fillText("Adornment", pad + bw + 6, y0);
    if (badge) {
      ctx.font = '500 26px "Inter", Arial, sans-serif';
      const tw = ctx.measureText(badge.toUpperCase()).width;
      ctx.fillStyle = "#c9a568"; ctx.fillRect(W - pad - tw - 44, y0 - 44, tw + 44, 60);
      ctx.fillStyle = "#151413"; ctx.fillText(badge.toUpperCase(), W - pad - tw - 22, y0 - 4);
    }
    // Name, price and address, bottom left
    let y = H - (tall ? 250 : 96);
    ctx.fillStyle = "rgba(246,243,238,.82)";
    ctx.font = '500 28px "Inter", Arial, sans-serif';
    ctx.fillText("S H A R I F A D O R N M E N T . C O M", pad, y);
    y -= 70;
    if (price) {
      ctx.fillStyle = "#e3c58f";
      ctx.font = '400 64px "Instrument Serif", Georgia, serif';
      ctx.fillText(price, pad, y);
      y -= 84;
    }
    ctx.fillStyle = "#f6f3ee";
    ctx.font = '400 84px "Instrument Serif", Georgia, serif';
    const lines = wrap(ctx, name, W - pad * 2, 3);
    for (const line of lines.reverse()) { ctx.fillText(line, pad, y); y -= 92; }
    return canvas;
  }

  const api = { fixName, nameIssues, suggestDescription, priceOf, asPrice, changedPrice, orderMessage, drawPost };
  if (typeof window !== "undefined") window.SAHelpers = api;
  if (typeof module !== "undefined") module.exports = api;
})();
