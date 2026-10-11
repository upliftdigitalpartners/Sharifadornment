# Art direction & AI image prompts

## Use real photos for the products, AI for mood

Your Facebook photos and reels show the **actual pieces**, so use those for
anything a customer might order from (collection covers and gallery). An AI
image of a necklace you don't stock invites "do you have this one?" messages
you can't fulfil. Use the AI prompts below for **mood and backdrop** images,
or as a styling reference if you reshoot products on a dark set.

## The look

> **Candlelit heirloom.** Gold and charcoal, with warm low-key light and deep
> shadow. Rich, quiet luxury. Think of a jewelry box opened in a dark room,
> where the gold catches a single warm light. Accents come from the jewelry
> itself: ruby red, emerald green and pearl white.

Your current photos are bright (ivory satin, white busts, flowers). They're
lovely, and they'll look even better on this site with a light edit: drop the
exposure slightly, warm the white balance, and crop tight.

**Add this style block to the end of every prompt** so the set stays consistent:

```
editorial luxury jewelry photography, low-key lighting, deep charcoal background (#141415),
single warm golden key light from upper left, soft falloff into shadow, rich gold tones (#c9a45c),
subtle film grain, shallow depth of field, 100mm macro lens, high detail, no text, no logo, no watermark
```

Suggested settings: Midjourney `--style raw --v 7`, or the "photographic"
style in other tools. Generate at the aspect ratio listed, then export as
`.jpg` at about 80% quality, ideally under 400 KB each.

---

## Files the site looks for

| File | Where it shows | Aspect | Size |
|---|---|---|---|
| `assets/img/col-bridal.jpg` | Collections card 01 | 4:5 | 1000×1250 |
| `assets/img/col-kundan.jpg` | Collections card 02 | 4:5 | 1000×1250 |
| `assets/img/col-oxidized.jpg` | Collections card 03 | 4:5 | 1000×1250 |
| `assets/img/col-pearl.jpg` | Collections card 04 | 4:5 | 1000×1250 |
| `assets/img/col-bangles.jpg` | Collections card 05 | 4:5 | 1000×1250 |
| `assets/img/col-potli.jpg` | Collections card 06 | 4:5 | 1000×1250 |
| `assets/img/story.jpg` | "Our Story" arched frame | 3:4 | 1200×1600 |
| `assets/img/og-image.jpg` | Link preview on WhatsApp, Facebook, iMessage | 1.91:1 | 1200×630 |
| `assets/gallery/*` | Gallery (list them in `js/config.js`) | any | ≤1600px wide |

Any missing file shows elegant gold placeholder art, so you can add images
gradually.

**Best source per slot:** collection covers come from your real product
photos. `story.jpg` and `og-image.jpg` work well as AI. The gallery should be
your real photos and reels.

---

## Prompts

### `story.jpg` (Our Story, 3:4)
```
An heirloom moment: an open antique carved wooden jewelry box on dark charcoal velvet, spilling
a layered pearl rani haar necklace and a stack of gold kundan bangles set with tiny rubies and emeralds,
a few loose marigold petals, a faint wisp of incense smoke catching the light, intimate and nostalgic,
South Asian heritage, [STYLE BLOCK] --ar 3:4
```

### `og-image.jpg` (link preview, 1.91:1)
```
Wide still life on a deep charcoal surface: a gold kundan choker necklace with ruby and emerald stones
on the right third, a trail of loose pearls leading toward it, generous empty dark space on the left
for a title, warm golden rim light, luxurious and minimal, [STYLE BLOCK] --ar 191:100
```
*(Optionally add "Sharif Adornment" over the left side in an elegant serif in Canva.)*

### Mood and backdrop alternates (if you want more AI imagery)

**Bridal mood (4:5)**
```
Close-up of a bride's hands with intricate dark mehndi, wearing stacked gold bangles and a
statement kundan ring, holding the edge of a deep red silk dupatta with gold zari embroidery,
face not visible, warm candlelight, [STYLE BLOCK] --ar 4:5
```

**Kundan detail (4:5)**
```
Extreme macro of a gold kundan necklace pendant with cabochon ruby and emerald stones and a
fringe of tiny seed pearls, resting on black silk, light glinting across the gold filigree,
[STYLE BLOCK] --ar 4:5
```

**Oxidized silver (4:5)**
```
Antique oxidized silver tribal statement necklace with coin motifs, dark green and red beads,
draped over a rough slate stone, cool silver highlights against warm charcoal shadow,
moody and artisanal, [STYLE BLOCK] --ar 4:5
```

**Pearl malas (4:5)**
```
Several long strands of creamy pearls in a graceful S-curve on charcoal velvet, finished
with an ornate gold pendant set with a pink stone, soft lustrous reflections on each pearl,
[STYLE BLOCK] --ar 4:5
```

**Bangles and jhumkas (4:5)**
```
A tall stack of carved antique-gold kangan bangles beside a pair of gold jhumka earrings with
pearl drops, one jhumka mid-swing with gentle motion blur, dark charcoal backdrop,
[STYLE BLOCK] --ar 4:5
```

**Potli bag (4:5)**
```
A deep red velvet potli bag with dense gold zardozi embroidery and a cascade of pearl strands,
drawstring tassels, a single marigold flower beside it, on dark charcoal silk,
[STYLE BLOCK] --ar 4:5
```

**Festive texture backdrop (16:9, decorative)**
```
Abstract close-up of gold zari embroidery on black silk, out-of-focus bokeh of warm golden
lights, Eid and wedding-night atmosphere, no objects in sharp focus, [STYLE BLOCK] --ar 16:9
```

---

## Reshooting your own pieces in this style (phone camera)

1. Use a black velvet or dark grey card backdrop. A ~$10 velvet sheet works great.
2. Light from one side only: a window with the other curtains closed, or a single
   warm lamp at 45°.
3. Put a piece of white card on the opposite side to lift the shadows slightly.
4. Lock exposure on the jewelry (tap and hold on iPhone), then drag exposure down a touch.
5. Shoot in portrait at 4:5 for the collection covers.
