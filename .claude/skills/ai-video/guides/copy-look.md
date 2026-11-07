# "Copy this look": the user's own look from reference screenshots

The user sends 3 screenshots (hook, middle, CTA) or a short screen recording of a reel or carousel whose LOOK they like. You turn
it into a named look saved in `~/.config/ai-video/looks/<name>.json`, reused by every carousel and classic reel they want.
Style only: never copy the reference's content, text, characters, logos or brand.

1. **Read the reference.** Video: `python3 "$SKILL_DIR/tools/look.py" frames <video.mp4> 6`. Then
   `look.py palette <images...>`: background, text and accent colour (plus a second colour), and a swatch. LOOK at the images
   yourself too and write, in 5-7 bullets, what you see: background (flat colour, paper, grid, dots, gradient), headline font feel
   (condensed bold, rounded, serif, mono, uppercase?), accent treatment (italic serif word, highlighted word, coloured word),
   cards/UI (light, dark, rounded, outlined, shadowed), annotations (marker circles, arrows, stickers), motion feel (calm eases,
   snappy pops). Show the bullets to the user and confirm before saving.
2. **Map it to the engine.** Pick the closest built-in carousel look as `base` (papel, noite, vibrante, tech, editorial), then
   override only what differs. Fonts must be bundled ones (closest match): Anton, Barlow Condensed (condensed); Space Grotesk,
   Figtree, Inter, Nunito (sans / rounded); Playfair Display, Instrument Serif (serif); JetBrains Mono, IBM Plex Mono, VT323 (mono).
   Say when the reference uses a font we don't have ("close, not identical").
3. **Save:** write the JSON and run `look.py save <name> <file.json>` (it checks keys and fonts):
   ```json
   { "base": "noite",
     "notes": "dark navy, pink accent, condensed uppercase headlines, rounded dark cards",
     "carousel": { "bg": "dots", "paper": "#0E1A33", "ink": "#F4F4F6", "accent": "#FF6FA5", "mark": "#FF6FA5", "onMark": "#0E1A33",
                   "card": "#16233F", "border": "#24345A", "line": "#2B3B60", "chip": "#3A2140",
                   "head": "\"Barlow Condensed\"", "headWt": 800, "headCase": true,
                   "acc": "\"Instrument Serif\"", "accIt": true, "note": "\"Instrument Serif\"" },
     "classic": { "accent": "#FF6FA5", "paper": "#F4F1EC", "ink2": "#FFD43B" } }
   ```
   Carousel keys: `bg` (rules | dots | grid | margin | none), `grain` (0-12), `paper` background, `ink` text, `grey` small labels,
   `rule` background lines, `card`/`border` cards, `dark` dark cards, `accent` headline accent word, `mark` annotations, `onMark`
   text on a mark-coloured button, `line` fake text bars, `chip` pills, `bar` window title bars, `screen` phone screens, `head`/`headWt`/
   `headCase` headline font, weight, uppercase, `acc`/`accIt`/`accWt`/`accScale`/`accHighlight` accent word, `note`/`noteIt` handwritten notes.
   Classic keys (the engine prints on paper with halftone): `paper`, `accent`, `ink2` (second ink), `grain`.
4. **Preview and compare:** `look.py preview <name>` renders the sample carousel in the new look. Put its sheet next to the reference,
   show both to the user, adjust once or twice, save again.
5. **Use it:** `reel new <dir> --style carousel --look <name>` (or `--style classic --look <name>`). A look can be refined any time:
   edit and `save` again; existing projects keep the copy they were made with (`reel.json` "theme").

Tip for the user: change the look every few posts to keep the page fresh, but keep the same mascot, voice and keyword.
