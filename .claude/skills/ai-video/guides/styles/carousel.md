# Style: carousel (animated Instagram carousel, 4:5)

An Instagram carousel where every slide is a short silent video that loops: 1080×1350, 4 s per slide, 5-8 slides. The whole
carousel renders as ONE video; `reel carousel` cuts it at every slide boundary into `out/01.mp4`, `02.mp4`, ... Carousels get saved
and shared more than almost any other post, and most people still post still images, so a moving one stands out.

Look (the same on every slide): warm off-white ruled paper with a light grain, a mono header (`reel.json` "header", e.g. the
user's @handle) with the slide number "01/06" on the right, a small red mono step label, a bold condensed headline (Anton) with ONE
accent word in red Instrument Serif italic, one or two lines of small text, a moving visual in the middle (the stage), and a
hand-drawn red swipe line that runs off the right edge and continues on the next slide. App names are plain text; no logos,
no drawn characters or people. The user's own image mascot may host 1-3 slides (`mascot: 'point-side'`, see `guides/mascot.md`).

## Looks (reel.json "look")
Five ready looks; pick by the topic and the user's brand, or ask once if unclear. Same engine, same rules, same kit: only colours,
fonts and background change, and `K.*` drawings follow the look automatically (use `K.TH.*` colours in your own stage code).
| look | feel | background | headline · accent word | colours |
|---|---|---|---|---|
| `papel` (default) | warm notebook, hand-made | ruled paper + grain | Anton · red Instrument Serif italic | cream, ink, red |
| `noite` | dark, premium, tech | dots on near-black | Space Grotesk · lime serif italic | black, white, lime |
| `vibrante` | loud, bold, sales | flat colour | ANTON UPPERCASE · white Playfair italic | orange, black, white |
| `tech` | clean SaaS / product | light grid | Figtree · blue word on a highlight | white, navy, blue |
| `editorial` | magazine, authority, law/finance | cream with rule lines | Playfair Display · wine serif italic | cream, brown, wine |
Their own look from screenshots ("copie este visual"): `guides/copy-look.md`, then `reel new <dir> --style carousel --look <name>`.
Brand colour on top of any look: `"theme": {"accent": "#hex"}` (also recolours the annotations when the look uses one colour);
`"mark"` sets the annotation colour separately. Any other `TH` key (paper, ink, card...) can be overridden the same way.
Kit colours: `TH.mark` annotations, `TH.onMark` text on a mark-filled chip, `TH.card`/`TH.line`/`TH.chip` cards, copy bars, pills.

## Workflow

1. **Format.** If the user sends screenshots of carousels they like, use them for structure and look only (colours, how much text
   per slide), never their content. Otherwise use this style as is. Brand colour: `reel.json` "theme": {"accent": "#..."}.
2. **Plan table, wait for approval.** Show this table in chat before writing any code:
   | # | Título (max 5 words, one *accent* word) | Texto pequeno (max 20 words) | O que se mexe no slide |
   - Slide 1: a hook that makes people swipe (a promise, a surprise or a "how I..."). Use the hook formulas in `guides/scripting.md`.
   - Middle slides: one step or idea each. Last slide: ONE action ("Comenta PALAVRA que eu te mando...", or save, or follow).
   - Change only the slides the user names ("slide 3: título mais curto"). Wait for "aprovado".
   - From an existing reel: reuse its script. Hook → slide 1, one sentence or step per middle slide, CTA → last slide, same KEYWORD.
3. **Project:** `node "$SKILL_DIR/tools/reel.mjs" new <VIDEOS>/<slug> --style carousel` (no voice step: carousels are silent).
   Set "header", "cta.keyword" and the accent colour in `reel.json`.
4. **Write `slides.js`** (contract below). Invent a stage visual per slide from THAT slide's words: real-looking UI (chat windows,
   cards, phones, comment fields, checklists, file chips), hand-drawn red annotations (circles, arrows, notes, stamps). Never an
   empty card or a black placeholder screen.
5. **Check:** `reel stills <project> <for each slide: start, middle, start+3.9>` and LOOK at the sheet (checklist below). Fix, re-render.
6. **Render + cut:** `reel video <project> --final`, then `reel carousel <project>` (add `--png` for still versions too). It first runs
   the loop check (first frame vs last frame of every slide) and only cuts when every slide PASSES.
7. **Deliver:** `out/01.mp4 ... NN.mp4` in order, plus a caption in `out/caption.txt` that STARTS with the call to action:
   ```
   Comenta PALAVRA que eu te mando [o guia].
   [uma linha: o que este carrossel mostra]
   [uma linha: pra quem é]
   #nicho #tema #ferramenta
   ```
   Remind: post the clips in order (01 first), keep the 4:5 crop, and set up the comment-to-DM automation for the KEYWORD.
   Tip for the user: post the same idea as a reel too; the reel finds new people, the carousel gets saved.

## `slides.js` contract

```js
window.SLIDES = [
  { label: 'passo 1',                     // small red step label (optional; leave out on slide 1)
    title: 'Copie o *formato*',           // *word* = the accent word; punctuation right after it stays glued ("*passo a passo*?")
    text: 'Salve 3 carrosséis do seu nicho que você ama.',
    accentMove: 'bob',                    // the accent word's own loop: bob | wave (letters ripple) | tilt | pulse | slide
    titleSize: 104,                       // optional: smaller for long headlines
    stage(g, lt, T, K, box) { ... } },    // the moving visual; lt = 0..4 s; box = {x:70, y:500, w:940, h:640}
];
```
The engine draws everything except the stage, fully visible from the first frame and never animated in or out. It warns when the
headline and text run into the stage (y 500): shorten them or lower `titleSize`.

**The loop rule (most important).** Each slide's last frame must equal its first, or the loop "jumps" on Instagram:
- Every change multiplies by `T.rest(lt)` (1 until 3.4 s, eases to 0 at 4.0 s), or use `T.span(lt, a, b)` = eased 0→1 at a..b,
  held, back to 0 by the end. So a card that slides in at 1.0 slides back out (or settles to its start) by 4.0.
- Idle life uses `T.float(lt, amp, k)` / `T.wave(lt, k)`: whole cycles per slide (k = 1, 2, ...) are seamless by construction.
- Nothing ever fully freezes: landed elements float gently (3 px).
- `reel carousel` measures it and FAILS the slides that don't loop.

**Timing helpers (T):** `seg(lt,a,b)` linear 0..1 · `in(lt,a,b)` eased (cubic-bezier .16,1,.3,1) · `io` ease-in-out ·
`span(lt,a,b)` · `rest(lt)` · `float(lt,amp,k,phase)` · `wave(lt,k,phase)` · `pop(lt,a,dur)` · `lerp` · `clamp`.

**Kit (K), all drawn on the main canvas:** `card(x,y,w,h,{dark,r,label,fill})` · `lines(x,y,w,n,{seed,gap,p})` fake copy bars ·
`text(x,y,s,{size,fam,wt,color,alpha,align,it})` (returns width) · `chip(x,y,s,{fill,color,scale})` (returns width) ·
`window(x,y,w,h,title,body(g,w,h),{dark})` plain app window · `phone(x,y,w,h,screen(g,w,h))` · `circle(cx,cy,rx,ry,p)` marker
circle · `underline(x1,y,x2,p)` · `arrow(x1,y1,x2,y2,p,{bend})` · `note(x,y,s,{size,rot,p})` handwritten note ·
`stamp(x,y,s,{p,rot})` pressed pill stamp · `check(x,y,size,p)` · `cursor(x,y,{click})` · `type(s,p)` typing ·
`rng(seed)` seeded random · `TH` colours · `FAM` fonts (head, serif, sans, mono). Any Canvas 2D code works too (`g` is the context).

## Rules (do not)
- Add audio, or a transition across a slide boundary, or anything that carries from one slide into the next.
- Animate the headline, small text, step label or swipe line in or out (only the accent word loops in place).
- Draw characters or people (the user's own mascot via `slide.mascot` is the only exception); draw real logos or black placeholder screens.
- Put grey or translucent boxes behind words; let anything overlap the text; put content closer than 70 px to an edge
  (except the paper and the swipe line).
- Flashes, screen shake, sudden zooms, particles. Everything eases.

## Checklist before delivering
- [ ] Slide plan approved: hook, one idea per slide, one action at the end.
- [ ] Headline readable on the first frame of every slide; nothing overlaps the text.
- [ ] `reel carousel` loop check: every slide PASS; every clip exactly 4.00 s.
- [ ] The swipe line sits at the same height on every slide; the last slide ends in the heart.
- [ ] The KEYWORD is the same on the last slide and in the caption.
