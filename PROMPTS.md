# Art direction & AI prompts

## The look

> **Quiet, light and editorial.** Warm ivory and soft daylight, with plenty of
> empty space. The gold, pearls and stones are the only strong colour in the
> frame. Think of a jewelry editorial in a fashion magazine, not a festive ad.

The site's palette is warm ivory (`#f6f3ee`), soft stone (`#ece7df`) and near-black
ink (`#1b1917`). Your existing product photos (ivory satin, white busts) already
fit this well, so new images should feel like the same shoot, only more refined.

### Rules for every image and video
- **Your real pieces only** for anything a customer could order from. Generate
  *from your own photo* (image-to-image or image-to-video), never from text alone.
  An AI piece you don't stock leads to "do you have this one?" messages.
- **Check the details.** Reject any result that adds stones, changes the
  pattern, or melts the metal. Customers will order what they see.
- **No text, logos, price tags or business cards** in the frame.
- **Light, warm, uncluttered.** One piece, one surface, soft shadow.

**Add this style block to the end of every prompt** so the set stays consistent:

```
minimal luxury jewelry editorial, warm ivory background (#f6f3ee), soft diffused natural
daylight from the left, gentle soft shadows, clean uncluttered composition with generous
negative space, true-to-life gold tones, crisp detail on the metalwork and stones,
shot on 100mm macro lens, shallow depth of field, no text, no logo, no watermark, no props
other than those described
```

---

## Videos (image-to-video)

Use Runway, Kling, Google Veo, Luma or Sora. Upload your product photo as the
**first frame**, paste the prompt, and generate 3–4 versions to choose from.

**Export:** MP4, highest quality. 5–8 seconds. Turn on "loop" or "seamless loop"
if the tool has it, so the first and last frames match. Send the files over and
they'll be compressed for the web (target: under 4 MB).

### 1. Hero loop: bangle stack (most important)
Source photo: `bangles-for-ai.jpg` (the antique-gold bangle stack, card cropped out).
Make a **4:5 portrait** version for the site; a 9:16 version is a bonus for
Instagram/Facebook reels.

```
The stack of antique gold kangan bangles rests on a soft ivory stand. The camera makes a
very slow, smooth push-in while a soft band of warm daylight glides across the carved gold,
catching the small ruby and emerald stones one by one. The bangles stay perfectly still and
unchanged. Calm, weightless, elegant. Background is clean warm ivory with a gentle soft
shadow. Seamless loop, no cuts. [STYLE BLOCK]
```

**Alternative motion** (if the push-in feels static):
```
The bangle stack slowly rotates a quarter turn on its stand, revealing the carved pattern
around the side, while soft light shimmers across the metal. Smooth turntable motion,
steady camera, nothing else moves. Seamless loop. [STYLE BLOCK]
```

### 2. Collection reels (optional, for the gallery and social)
Use the matching product photo as the first frame each time.

**Necklace on a bust (bridal / kundan / oxidized)**
```
Slow, smooth camera arc around the necklace on its display bust, light sliding across the
gold and stones, pearl drops swaying very slightly. The jewelry keeps its exact design.
Calm, luxurious, steady. [STYLE BLOCK]
```

**Jhumkas**
```
A pair of gold jhumka earrings hangs from an invisible line and swings gently, the pearl
drops trembling and catching the light. Soft focus background, slow motion. [STYLE BLOCK]
```

**Potli bag**
```
The embroidered potli bag sits on ivory silk; its pearl strands sway softly as if lightly
set down, and light glints across the zardozi embroidery. Slow motion, steady camera.
[STYLE BLOCK]
```

**Pearl mala**
```
A long pearl mala is slowly laid down in a graceful curve on ivory silk, each pearl
catching a soft highlight, ending with the pendant settling into place. Slow motion,
top-down view. [STYLE BLOCK]
```

### 3. More video ideas

**Worn on the hand (bangles, rings)**: start from a photo of the bangles; the tool adds the hand.
```
A graceful hand with soft henna slowly turns at the wrist, showing the stacked antique gold
bangles from my photo exactly as they are; the bangles shift slightly and catch warm light.
Plain ivory background, face not visible, slow and elegant. [STYLE BLOCK]
```

**Worn on the neck (bridal / kundan sets)**
```
Close crop from chin to collarbone: a woman in an ivory silk outfit, wearing the necklace
from my photo exactly as designed, turns her head slightly toward the light; the stones and
pearl drops catch soft highlights. Face not visible above the lips. [STYLE BLOCK]
```

**Unboxing / gifting (good for Eid and wedding season)**
```
Top-down: hands slowly lift the lid of a plain ivory gift box tied with a thin gold ribbon,
revealing the jewelry from my photo resting on ivory silk inside. Soft daylight, calm and
unhurried, seamless loop. [STYLE BLOCK]
```

**Detail macro (any piece)**
```
Extreme macro, very slow slide across the surface of the jewelry from my photo, revealing
the carved metalwork and stone settings in crisp detail, light rolling across the gold.
Nothing changes shape. [STYLE BLOCK]
```

**Clutch / bag reveal**
```
The embroidered clutch from my photo stands on a pale stone plinth; the camera slowly circles
halfway around it as soft light glides over the embroidery and metal clasp. Steady, smooth,
seamless loop. [STYLE BLOCK]
```

**Stack build (bangles)**
```
On an ivory stand, the antique gold bangles from my photo are placed one by one, gently
settling into a stack. Slow motion, top-lit by soft daylight, crisp gold detail. [STYLE BLOCK]
```

**Festive mood (social only, not product-specific)**
```
Slow drift through ivory silk drapes with warm out-of-focus fairy lights and a few marigold
petals falling softly, a feeling of a wedding evening about to begin. No people, no text.
[STYLE BLOCK]
```

**Formats for social:** generate each reel at **9:16** for Facebook/Instagram Reels and
**4:5** for the website gallery. Keep them 5–8 seconds; let the first frame be strong,
because that's the thumbnail people see.

---

## Photos

### Re-styling your real product photos (image-to-image)
Use the "edit" or "reference image" mode (Photoshop Generative Fill, Midjourney
`--cref`/image prompt, Flux Kontext, Google's image editor, ChatGPT image edit).

**Clean-up edit** (works on almost every existing photo):
```
Keep the jewelry exactly as it is, unchanged. Replace the background with a clean warm
ivory seamless backdrop (#f6f3ee) and a soft natural shadow. Remove the text label, price
tag and any business card. Balance the white balance to warm neutral and slightly lift the
shadows. [STYLE BLOCK]
```

**Flat lay** (for collection covers, 4:5):
```
Keep the jewelry exactly as it is. Top-down flat lay of the piece on warm ivory raw silk,
centred with generous empty space around it, soft daylight from the left casting a gentle
shadow. [STYLE BLOCK] --ar 4:5
```

### More photo ideas (from your real pieces)

**On a stone plinth (any necklace, clutch or bangle stack), 4:5**
```
Keep the jewelry exactly as it is. Place it on a small pale travertine plinth against a warm
ivory wall, soft side light, a long gentle shadow. Sculptural and minimal. [STYLE BLOCK] --ar 4:5
```

**On silk folds (earrings, malas), 4:5**
```
Keep the jewelry exactly as it is. Rest it on softly folded ivory silk with subtle sheen,
light from the left catching the folds and the metal. [STYLE BLOCK] --ar 4:5
```

**Worn, cropped portrait (bridal and kundan sets), 4:5**
```
Keep the jewelry exactly as it is. A woman in an ivory or blush silk outfit wears it,
cropped from lips to collarbone, soft daylight, calm and elegant, natural skin texture.
[STYLE BLOCK] --ar 4:5
```

**Hands with henna (bangles, rings), 4:5**
```
Keep the bangles exactly as they are. Close-up of a hand with delicate mehndi resting on
ivory silk, the bangles stacked on the wrist, soft daylight. [STYLE BLOCK] --ar 4:5
```

**Pairing still life (to sell the "complete look"), 4:5**
```
Keep each piece exactly as it is. A flat lay of the necklace, matching earrings and a potli
bag arranged with generous space on ivory raw silk, top-down, soft daylight. [STYLE BLOCK] --ar 4:5
```

**Square post for Facebook/Instagram, 1:1**
```
Keep the jewelry exactly as it is. Centred on a warm ivory seamless background with a soft
shadow beneath, lots of empty space around it. [STYLE BLOCK] --ar 1:1
```

**Seasonal banners, 16:9** (Eid, wedding season, Diwali)
```
Minimal wide still life on warm ivory: the jewelry from my photo on the right third, a few
[marigold petals | dates and a brass lantern | diyas] softly out of focus on the left, the
middle left empty for text. [STYLE BLOCK] --ar 16:9
```

### Mood images (AI from text is fine; these aren't products)

**Story image, 3:4**: `assets/img/story.jpg`
```
An open ivory linen jewelry box on a pale stone table in soft morning light, a folded silk
dupatta in muted blush beside it, a single fresh marigold, quiet heirloom atmosphere, no
jewelry in sharp focus, intimate and nostalgic. [STYLE BLOCK] --ar 3:4
```

**Link preview, 1.91:1**: `assets/img/og-image.jpg`
```
Wide, minimal still life on warm ivory: a single gold necklace on the right third resting
on ivory silk, a few loose pearls trailing toward it, the left two-thirds left as clean empty
space for a title. [STYLE BLOCK] --ar 191:100
```
*(Add "Sharif Adornment" over the left side in Canva, in a thin serif such as
"Instrument Serif", colour `#1b1917`.)*

**Occasion texture, 16:9 (optional)**
```
Abstract close-up of ivory silk folds with soft out-of-focus gold bokeh, a hint of mehndi
and celebration, nothing in sharp focus. [STYLE BLOCK] --ar 16:9
```

Suggested settings: Midjourney `--style raw --v 7`, or the "photographic"
style in other tools. Export `.jpg` at about 80% quality.

---

## Files the site looks for

| File | Where it shows | Aspect | Size |
|---|---|---|---|
| `assets/img/hero.jpg` | Hero (and the video's still frame) | 4:5 | 1200×1500 |
| `assets/video/hero.mp4` | Hero video (set `heroVideo` in `js/config.js`) | 4:5 | 1080×1350, < 4 MB |
| `assets/img/col-*.jpg` | Collection cards 01–06 | 4:5 | 1000×1250 |
| `assets/img/story.jpg` | "Our story" | 3:4 | 1200×1600 |
| `assets/img/og-image.jpg` | Link preview on WhatsApp, Facebook, iMessage | 1.91:1 | 1200×630 |
| `assets/gallery/*` | Gallery (list them in `js/config.js`) | 4:5 | ≤ 1200px wide |

---

## Reshooting your own pieces (phone camera)

1. Shoot by a window in daylight. Turn off the room lights so colours stay true.
2. Use a plain ivory or off-white backdrop: a sheet of matte card or raw silk.
3. Put a white card on the side away from the window to soften the shadows.
4. Tap the jewelry to focus, then drag exposure down slightly so the gold doesn't blow out.
5. Shoot in 4:5 portrait. Leave space around the piece. Skip labels and price tags.
