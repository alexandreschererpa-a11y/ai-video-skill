// ───────────────────────── captions: kinetic headline built word by word from the voice ─────────────────────────
// Look: Space Grotesk 500, 84 px, -3% tracking, ink #111, left-aligned at x 130, first baseline y 330, wrap 800 px, line height 1.08.
// Emphasised words: Instrument Serif italic at 1.16x, accent colour, a small spring wobble when they land.
// Timing: each word appears 0.15 s BEFORE it is spoken (0.06 s fade + 14 px rise); the old phrase fades 0.2 s and lifts 40 px
// when the next phrase starts. A phrase never crosses a scene cut.
// PHRASES (optional, set in timeline.js): [[firstWordIdx, lastWordIdx, [emphasised word idxs], {size, maxW, swap: {idx: 'text'}}], ...]
// If PHRASES is null the engine phrases automatically (punctuation, pauses, ≤ 6 words, scene cuts) and emphasises words from
// reel.json captions.emphasize (or, failing that, numbers and the strongest content word of each phrase). Stop words and the
// "comment" words come from reel.json "language" (core/words.js LEX); an unknown language uses the word-length heuristic only.
let PHRASES = null, PHRASE_LIST = [], EMPH_TIMES = [];
const CAP = { size: 84, maxW: 800, x: 130, y: 330, lead: 0.3, maxWords: 6, color: null, emphasis: null };

function autoPhrases(cuts) {
  const em = new Set(((REEL.captions && REEL.captions.emphasize) || []).map(norm));
  const kw = REEL.cta && REEL.cta.keyword ? norm(REEL.cta.keyword) : null;     // the CTA keyword is always emphasised
  const out = [];
  let i0 = 0;
  const cutBefore = i => cuts.some(c => WORDS[i].s >= c - 0.02 && WORDS[i - 1].s < c - 0.02);
  for (let i = 0; i < WORDS.length; i++) {
    const w = WORDS[i].w, n = i - i0 + 1, last = i === WORDS.length - 1;
    let toEnd = 0; for (let k = i + 1; k < WORDS.length && k <= i + 3; k++) { toEnd++; if (/[.?!,;:]["”)]*$/.test(WORDS[k].w)) break; if (k === i + 3) toEnd = 9; }
    const full = n >= CAP.maxWords && !(toEnd <= 2 && n < CAP.maxWords + 2);   // never strand a 1-2 word tail ("a week.")
    const stop = /[.?!:;]["”)]*$/.test(w) || (/,$/.test(w) && n >= 3) || full || last
      || (WORDS[i + 1] && WORDS[i + 1].s - WORDS[i].e > 0.35) || (WORDS[i + 1] && cutBefore(i + 1));
    if (!stop) continue;
    // never leave a dangling 1-word phrase if the next sentence continues it (merge tiny tails into the next phrase)
    out.push([i0, i, []]); i0 = i + 1;
  }
  for (const p of out) {
    const idx = []; for (let i = p[0]; i <= p[1]; i++) idx.push(i);
    // the CTA keyword: when spoken in CAPS (any cased script) or within 3 words after a "comment" word of the reel's language
    const caps = w => { const c = w.replace(/[^\p{L}\p{N}]/gu, ''); return c.length >= 2 && c === c.toUpperCase() && c !== c.toLowerCase(); };
    const afterComment = i => { for (let k = Math.max(0, i - 3); k < i; k++) if (isCommentWord(WORDS[k].w)) return true; return false; };
    let pick = idx.filter(i => em.has(norm(WORDS[i].w)) || (kw && norm(WORDS[i].w) === kw && (caps(WORDS[i].w) || afterComment(i))));
    if (!pick.length && !em.size) {
      const nums = idx.filter(i => /\d/.test(WORDS[i].w));
      if (nums.length) pick = nums.slice(0, 1);
      else {
        const cand = idx.filter(i => !isStopWord(WORDS[i].w) && norm(WORDS[i].w).replace(/'/g, '').length >= 4);
        cand.sort((a, b) => (norm(WORDS[b].w).length + (b - p[0]) * 0.8) - (norm(WORDS[a].w).length + (a - p[0]) * 0.8));
        if (cand.length && idx.length >= 2) pick = cand.slice(0, 1);
      }
    }
    p[2] = pick;
  }
  return out;
}

// Spelled-out numbers show as digits in the captions (English): "two hundred and twenty-one files" → "221 files",
// "forty thousand" → "40,000", "five million" → "5 million", "three months" → "3 months". Only the caption text changes, never the voice.
// The digits appear on the group's first word; the other words of the group are hidden. reel.json captions.digits: false turns it off;
// captions.swap: {"<wordIdx>": "text"} sets any caption word by hand (an empty string hides it).
let CAP_SWAP = null;
function captionSwaps() {
  if (CAP_SWAP) return CAP_SWAP;
  const out = {}, cfg = REEL.captions || {};
  const lang = (typeof reelLang === 'function' ? reelLang() : (REEL.language || 'en')) || 'en';
  if (cfg.digits !== false && /^en/.test(lang)) {
    const U = { zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
      fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18, nineteen: 19, twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60,
      seventy: 70, eighty: 80, ninety: 90 };
    const SC = { hundred: 100, thousand: 1e3, million: 1e6, billion: 1e9 };
    const bare = w => w.toLowerCase().replace(/[^a-z-]/g, '');
    const parts = w => bare(w).split('-').filter(Boolean);
    const isNum = w => { const ps = parts(w); return ps.length > 0 && ps.every(x => x in U || x in SC); };
    const NOT_ONE = new Set(['the', 'no', 'every', 'any', 'this', 'that', 'which', 'each', 'another', 'little', 'only']);
    for (let i = 0; i < WORDS.length; i++) {
      if (!isNum(WORDS[i].w)) continue;
      if (parts(WORDS[i].w)[0] in SC) continue;                                  // "hundred" alone: leave it
      if (bare(WORDS[i].w) === 'one' && i > 0 && NOT_ONE.has(bare(WORDS[i - 1].w))) continue;
      let j = i;
      while (j + 1 < WORDS.length && !/[.?!,;:]["”)]*$/.test(WORDS[j].w)) {
        const nx = WORDS[j + 1].w;
        if (isNum(nx)) { j++; continue; }
        if (bare(nx) === 'and' && j + 2 < WORDS.length && isNum(WORDS[j + 2].w) && parts(WORDS[j].w).some(x => x === 'hundred' || x === 'thousand' || x === 'million')) { j += 2; continue; }
        break;
      }
      const toks = []; for (let k = i; k <= j; k++) if (bare(WORDS[k].w) !== 'and') toks.push(...parts(WORDS[k].w));
      const bigEnd = toks.length > 1 && (toks[toks.length - 1] === 'million' || toks[toks.length - 1] === 'billion');
      let total = 0, cur = 0;
      for (const x of (bigEnd ? toks.slice(0, -1) : toks)) {
        if (x in U) cur += U[x];
        else if (x === 'hundred') cur = (cur || 1) * 100;
        else { total += (cur || 1) * SC[x]; cur = 0; }
      }
      const val = total + cur;
      const tail = (WORDS[j].w.match(/[.?!,;:]+["”)]*$/) || [''])[0];
      const txt = val.toLocaleString('en-US') + (bigEnd ? ' ' + toks[toks.length - 1] : '') + tail;
      if (j === i && toks.length === 1 && !(toks[0] in U)) continue;
      out[i] = txt; for (let k = i + 1; k <= j; k++) out[k] = '';
      i = j;
    }
  }
  for (const [k, v] of Object.entries(cfg.swap || {})) out[+k] = v;
  return (CAP_SWAP = out);
}

let HL = null;
function layoutPhrases() {
  HL = PHRASE_LIST.map((p, n) => {
    const o = p.o || {};
    const size = o.size || CAP.size, maxW = o.maxW || CAP.maxW;
    const words = [];
    for (let i = p.i0; i <= p.i1; i++) {
      const w = WORDS[i]; if (!w) continue;
      const em = p.em.includes(i);
      const gs = captionSwaps(), disp = (o.swap && o.swap[i] !== undefined) ? o.swap[i] : gs[i] !== undefined ? gs[i] : w.w.replace(/["“”]/g, '');
      if (!disp) continue;
      const f = em ? { font: F.serif, italic: true, weight: 400, size: Math.round(size * 1.16) } : { font: F.grot, weight: 500, size, ls: -size * 0.03 };
      words.push({ ...w, disp, em, f, wd: measure(K, disp, f) });
    }
    const sp = size * 0.26, lh = size * 1.08;
    let x = 0, line = 0;
    for (const w of words) { if (x > 0 && x + w.wd > maxW) { x = 0; line++; } w.x = x; w.line = line; x += w.wd + sp; }
    // right-to-left scripts (Arabic, Hebrew, Persian, Urdu): same line breaks, words placed from the right edge leftwards
    if (words.some(w => /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/.test(w.disp))) for (const w of words) w.x = maxW - w.x - w.wd;
    return { words, lines: line + 1, lh, size, s: p.s, end: p.end, o };
  });
}
function headline(ctx, t, sc) {
  if (REEL.captions === false || !PHRASE_LIST.length) return;
  if (!HL) layoutPhrases();
  if (sc.noHeadline && sc.noHeadline(t)) return;
  let ph = null;                                  // newest phrase that has started wins
  for (const p of HL) if (t >= p.s - CAP.lead && t < p.end + 0.2 && sceneAt(p.s + 0.12) === sc) ph = p;
  if (!ph || ph.s < sc.start - 0.12) return;      // never let a phrase from the previous scene bleed across a cut
  const ex = clamp((t - ph.end) / 0.2);
  const base = sc.hl ? sc.hl(t) || {} : {};
  const x0 = base.x ?? CAP.x, y0 = base.y ?? CAP.y;
  const col = base.color || CAP.color || C.ink, emc = base.em || CAP.emphasis || C.red;
  ctx.save(); ctx.globalAlpha = (base.alpha ?? 1) * (1 - E.inCubic(ex));
  for (const w of ph.words) {
    const dt = t - w.s + CAP.lead;                // lead the voice slightly so the word is readable as it's spoken
    if (dt < 0) continue;
    const a = clamp(dt / 0.06), rise = (1 - E.outCubic(clamp(dt / 0.16))) * 14;
    const s = w.em ? 1 + ring(dt - 0.05, 2.4, 6) * 0.08 : 1;
    ctx.save(); ctx.globalAlpha *= a;
    ctx.translate(x0 + w.x, y0 + w.line * ph.lh + rise - ex * 40); ctx.scale(s, s);
    text(ctx, w.disp, 0, 0, Object.assign({}, w.f, { align: 'left', color: w.em ? emc : col }));
    ctx.restore();
  }
  ctx.restore();
}
// the phrase on screen at t: { n, i0, i1, s, end, em }
function phraseAt(t) { let r = null; for (const p of PHRASE_LIST) if (t >= p.s - 0.15) r = p; return r && t < r.end + 0.2 ? r : r; }
// bottom of the caption block (canvas y) for the phrase at t - place hero objects below this
function captionBottom(t) { if (!HL) layoutPhrases(); let ph = null; for (const p of HL) if (t >= p.s - 0.15) ph = p; return ph ? CAP.y + (ph.lines - 1) * ph.lh + ph.size * 0.3 : CAP.y; }
