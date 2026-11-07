// ───────────────────────── carousel engine: animated Instagram carousels, 1080×1350 (4:5) ─────────────────────────
// The whole carousel renders as ONE silent video: slide i plays from i·SLIDE to (i+1)·SLIDE. `reel carousel <dir>` cuts it into
// out/01.mp4, 02.mp4, ... and each piece loops on Instagram, so every slide must end exactly as it started.
// Per slide the engine draws the fixed layer (paper, header, step label, headline, small text, swipe line) — always visible from
// frame 0, never animated in or out — and calls the slide's stage(g, lt, T, K, box) for the moving visual in the middle.
// Pure function of t: no wall clock, no Math.random (use K.rng(seed)).
(() => {
  const cv = document.getElementById('c');
  const g = cv.getContext('2d');
  let REEL = {}, W = 1080, H = 1350, SLIDE = 4;
  // Looks (reel.json "look"): every colour and font of a slide. "theme" in reel.json overrides single keys on top of the look.
  //   accent = the headline's accent word · mark = annotations (circles, arrows, notes, stamps, step label, swipe line)
  const LOOKS = {
    papel:     { bg: 'rules', grain: 10, paper: '#F1EFEA', ink: '#1C1B19', grey: '#8A8780', rule: '#DDD9D0', card: '#FFFFFF', border: '#E4E1DA', dark: '#1B1B1F',
                 accent: '#D93B2B', mark: '#D93B2B', line: '#E6E3DC', chip: '#FBE9E6', bar: '#F7F6F3', screen: '#FFFFFF', onMark: '#FFFFFF',
                 head: '"Anton"', headWt: '', headCase: false, acc: '"Instrument Serif"', accIt: true, accScale: 1.14, note: '"Instrument Serif"' },
    noite:     { bg: 'dots', grain: 6, paper: '#111114', ink: '#F4F4F6', grey: '#8B8B96', rule: '#2A2A31', card: '#1C1C22', border: '#2E2E37', dark: '#0A0A0C',
                 accent: '#C8F560', mark: '#C8F560', line: '#34343D', chip: '#26301A', bar: '#24242B', screen: '#16161B', onMark: '#111114',
                 head: '"Space Grotesk"', headWt: 700, headCase: false, acc: '"Instrument Serif"', accIt: true, accScale: 1.16, note: '"Instrument Serif"' },
    vibrante:  { bg: 'none', grain: 8, paper: '#FF5B2E', ink: '#160F0B', grey: '#5E2A17', rule: '#F14E22', card: '#FFFFFF', border: '#FFFFFF', dark: '#160F0B',
                 accent: '#FFFFFF', mark: '#160F0B', line: '#F0E6E0', chip: '#FFE3D8', bar: '#FFF3EE', screen: '#FFFFFF', onMark: '#FFFFFF',
                 head: '"Anton"', headWt: '', headCase: true, acc: '"Playfair Display"', accIt: true, accWt: 800, accScale: 1.0, note: '"Instrument Serif"' },
    tech:      { bg: 'grid', grain: 0, paper: '#FFFFFF', ink: '#0F172A', grey: '#64748B', rule: '#E8EDF5', card: '#FFFFFF', border: '#E2E8F0', dark: '#0F172A',
                 accent: '#2F6BFF', mark: '#2F6BFF', line: '#E7ECF4', chip: '#E6EEFF', bar: '#F6F8FB', screen: '#FFFFFF', onMark: '#FFFFFF',
                 head: '"Figtree"', headWt: 800, headCase: false, acc: '"Figtree"', accIt: false, accWt: 800, accScale: 1.0, accHighlight: '#DCE7FF', note: '"Figtree"', noteIt: false },
    editorial: { bg: 'margin', grain: 9, paper: '#F5EFE3', ink: '#1F1A14', grey: '#8C7F6E', rule: '#E2D8C6', card: '#FFFDF8', border: '#E4DACB', dark: '#2A231B',
                 accent: '#9C2A1E', mark: '#9C2A1E', line: '#ECE3D4', chip: '#F3E2D9', bar: '#F8F2E8', screen: '#FFFDF8', onMark: '#FFFFFF',
                 head: '"Playfair Display"', headWt: 900, headCase: false, acc: '"Playfair Display"', accIt: true, accWt: 500, accScale: 1.0, note: '"Instrument Serif"' },
  };
  const TH = Object.assign({}, LOOKS.papel);
  const M = 70;                                         // margin: everything 70 px from the edges (except paper and swipe line)

  // ── timing helpers (T) ──
  function bezier(x1, y1, x2, y2) {                     // CSS cubic-bezier as a function of x
    const A = (a, b) => 1 - 3 * b + 3 * a, B = (a, b) => 3 * b - 6 * a, C = a => 3 * a;
    const f = (t, a, b) => ((A(a, b) * t + B(a, b)) * t + C(a)) * t;
    const df = (t, a, b) => 3 * A(a, b) * t * t + 2 * B(a, b) * t + C(a);
    return x => { if (x <= 0) return 0; if (x >= 1) return 1; let t = x; for (let i = 0; i < 8; i++) { const d = df(t, x1, x2); if (Math.abs(d) < 1e-6) break; t -= (f(t, x1, x2) - x) / d; } return f(Math.min(1, Math.max(0, t)), y1, y2); };
  }
  const easeOut = bezier(.16, 1, .3, 1), easeInOut = bezier(.65, 0, .35, 1);
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const T = {
    seg: (lt, a, b) => clamp((lt - a) / (b - a)),                       // 0..1 linear between a and b
    in: (lt, a, b) => easeOut(T.seg(lt, a, b)),                          // eased 0..1 (the house ease)
    io: (lt, a, b) => easeInOut(T.seg(lt, a, b)),
    rest: lt => 1 - easeInOut(T.seg(lt, 3.4 * SLIDE / 4, SLIDE)),        // 1 until 3.4 s, then back to 0 at the slide end: multiply every change by it
    span: (lt, a, b) => T.in(lt, a, b) * T.rest(lt),                     // goes 0→1 at a..b, holds, returns to 0 by the slide end
    wave: (lt, k = 1, ph = 0) => Math.sin(2 * Math.PI * (k * lt / SLIDE + ph)),   // periodic over the slide: seamless loop for integer k
    float: (lt, amp = 3, k = 1, ph = 0) => amp * Math.sin(2 * Math.PI * (k * lt / SLIDE + ph)),
    pop: (lt, a, d = 0.45) => { const p = T.seg(lt, a, a + d); return p <= 0 ? 0 : 1 + Math.sin(p * Math.PI) * 0.12 * (1 - p) - (1 - easeOut(p)); },
    ease: easeOut, easeInOut, clamp, lerp: (a, b, p) => a + (b - a) * p,
  };

  // ── drawing kit (K) ──
  function rng(seed) { let s = (seed * 2654435761) >>> 0 || 1; return () => { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; }; }
  function rr(x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); }
  const font = (px, fam, wt = '', it = '') => `${it} ${wt} ${px}px ${fam}, "Fallback", sans-serif`.trim();
  const FAM = { head: '"Anton"', serif: '"Instrument Serif"', sans: '"Inter"', mono: '"JetBrains Mono"' };
  const K = {
    rng, TH, FAM, font,
    card(x, y, w, h, o = {}) {
      const r = o.r ?? 18;
      g.save();
      if (o.shadow !== false) { g.shadowColor = 'rgba(28,27,25,0.10)'; g.shadowBlur = 28; g.shadowOffsetY = 10; }
      rr(x, y, w, h, r); g.fillStyle = o.dark ? TH.dark : (o.fill || TH.card); g.fill();
      g.shadowColor = 'transparent';
      if (!o.dark) { g.lineWidth = 2; g.strokeStyle = TH.border; g.stroke(); }
      if (o.label) { g.font = font(24, FAM.mono, 500); g.fillStyle = TH.grey; g.textBaseline = 'top'; g.fillText(o.label, x + 26, y + 22); }
      g.restore();
    },
    lines(x, y, w, n, o = {}) {                         // grey text-line bars (fake copy), seeded widths
      const R = rng(o.seed ?? 7), gap = o.gap ?? 30, hgt = o.h ?? 12;
      g.save(); g.fillStyle = o.color || TH.line;
      for (let i = 0; i < n; i++) { const lw = w * (i === n - 1 ? 0.45 + R() * 0.2 : 0.75 + R() * 0.25); rr(x, y + i * gap, lw * (o.p ?? 1), hgt, hgt / 2); g.fill(); }
      g.restore();
    },
    text(x, y, s, o = {}) {
      g.save(); g.font = font(o.size ?? 30, o.fam || FAM.sans, o.wt ?? 500, o.it ? 'italic' : ''); g.fillStyle = o.color || TH.ink;
      g.textAlign = o.align || 'left'; g.textBaseline = o.base || 'top'; g.globalAlpha *= o.alpha ?? 1; g.fillText(s, x, y); const w = g.measureText(s).width; g.restore(); return w;
    },
    chip(x, y, s, o = {}) {                             // pill label; returns its width
      g.save(); g.font = font(o.size ?? 24, o.fam || FAM.mono, 500); const w = g.measureText(s).width + 36, h = (o.size ?? 24) + 22;
      g.translate(x, y); if (o.scale !== undefined) { g.translate(w / 2, h / 2); g.scale(o.scale, o.scale); g.translate(-w / 2, -h / 2); }
      rr(0, 0, w, h, h / 2); g.fillStyle = o.fill || TH.chip; g.fill();
      g.fillStyle = o.color || TH.mark; g.textBaseline = 'middle'; g.fillText(s, 18, h / 2 + 1); g.restore(); return w;
    },
    // hand-drawn marker strokes in the accent colour; p = 0..1 how much is drawn
    circle(cx, cy, rx, ry, p = 1, o = {}) {
      if (p <= 0) return; const R = rng(o.seed ?? 3), a0 = -Math.PI * 0.6, turn = Math.PI * 2.15, n = 64;
      const p1 = R() * 6, p2 = R() * 6;
      g.save(); g.strokeStyle = o.color || TH.mark; g.lineWidth = o.w ?? 6; g.lineCap = 'round'; g.beginPath();
      for (let i = 0; i <= n * p; i++) { const a = a0 + turn * i / n, k = 1 + 0.035 * Math.sin(a * 2 + p1) + 0.015 * Math.sin(a * 5 + p2) + 0.05 * i / n; const X = cx + Math.cos(a) * rx * k, Y = cy + Math.sin(a) * ry * k; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }
      g.stroke(); g.restore();
    },
    underline(x1, y, x2, p = 1, o = {}) {
      if (p <= 0) return; const R = rng(o.seed ?? 5); g.save(); g.strokeStyle = o.color || TH.mark; g.lineWidth = o.w ?? 6; g.lineCap = 'round'; g.beginPath();
      const n = 24, b = R() * 6; for (let i = 0; i <= n * p; i++) { const X = x1 + (x2 - x1) * i / n, Y = y + Math.sin(i / n * Math.PI) * b - i / n * 4; i ? g.lineTo(X, Y) : g.moveTo(X, Y); }
      g.stroke(); g.restore();
    },
    arrow(x1, y1, x2, y2, p = 1, o = {}) {              // curved marker arrow, head appears at the end
      if (p <= 0) return; const bend = o.bend ?? 0.25, mx = (x1 + x2) / 2 - (y2 - y1) * bend, my = (y1 + y2) / 2 + (x2 - x1) * bend;
      const pt = t => [(1 - t) ** 2 * x1 + 2 * (1 - t) * t * mx + t * t * x2, (1 - t) ** 2 * y1 + 2 * (1 - t) * t * my + t * t * y2];
      g.save(); g.strokeStyle = o.color || TH.mark; g.lineWidth = o.w ?? 6; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
      const n = 30; for (let i = 0; i <= n * p; i++) { const [X, Y] = pt(i / n); i ? g.lineTo(X, Y) : g.moveTo(X, Y); } g.stroke();
      if (p > 0.85) { const [ax, ay] = pt(p), [bx, by] = pt(p - 0.06), ang = Math.atan2(ay - by, ax - bx), L = 26 * T.seg(p, 0.85, 1);
        g.beginPath(); g.moveTo(ax - Math.cos(ang - 0.5) * L, ay - Math.sin(ang - 0.5) * L); g.lineTo(ax, ay); g.lineTo(ax - Math.cos(ang + 0.5) * L, ay - Math.sin(ang + 0.5) * L); g.stroke(); }
      g.restore();
    },
    note(x, y, s, o = {}) {                             // handwritten note: Instrument Serif italic, accent
      g.save(); g.translate(x, y); g.rotate((o.rot ?? -3) * Math.PI / 180); g.globalAlpha *= o.alpha ?? 1;
      g.font = font(o.size ?? 40, TH.note, TH.noteIt === false ? 600 : '', TH.noteIt === false ? '' : 'italic'); g.fillStyle = o.color || TH.mark; g.textBaseline = 'middle'; g.textAlign = o.align || 'left';
      const s2 = o.p === undefined ? s : s.slice(0, Math.round(s.length * clamp(o.p))); g.fillText(s2, 0, 0); g.restore();
    },
    stamp(x, y, s, o = {}) {                            // rotated pill stamp that presses in (p 0..1)
      const p = o.p ?? 1; if (p <= 0) return; const sc = 1.35 - 0.35 * easeOut(p);
      g.save(); g.translate(x, y); g.rotate((o.rot ?? -6) * Math.PI / 180); g.scale(sc, sc); g.globalAlpha *= clamp(p * 2);
      g.font = font(o.size ?? 30, FAM.mono, 700); const w = g.measureText(s).width + 40, h = (o.size ?? 30) + 24;
      rr(-w / 2, -h / 2, w, h, h / 2); g.lineWidth = 4; g.strokeStyle = o.color || TH.mark; g.stroke();
      g.fillStyle = o.color || TH.mark; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(s, 0, 2); g.restore();
    },
    check(x, y, s = 30, p = 1, o = {}) {
      if (p <= 0) return; g.save(); g.strokeStyle = o.color || '#2E9E5B'; g.lineWidth = o.w ?? 6; g.lineCap = 'round'; g.lineJoin = 'round'; g.beginPath();
      const pts = [[x, y + s * 0.5], [x + s * 0.38, y + s * 0.88], [x + s, y]]; g.moveTo(...pts[0]);
      if (p < 0.4) g.lineTo(pts[0][0] + (pts[1][0] - pts[0][0]) * p / 0.4, pts[0][1] + (pts[1][1] - pts[0][1]) * p / 0.4);
      else { g.lineTo(...pts[1]); const q = (p - 0.4) / 0.6; g.lineTo(pts[1][0] + (pts[2][0] - pts[1][0]) * q, pts[1][1] + (pts[2][1] - pts[1][1]) * q); }
      g.stroke(); g.restore();
    },
    cursor(x, y, o = {}) {                              // small black arrow cursor; click = 0..1 ring
      g.save(); g.translate(x, y);
      if (o.click > 0) { g.strokeStyle = TH.mark; g.globalAlpha = 1 - o.click; g.lineWidth = 4; g.beginPath(); g.arc(0, 0, 14 + 30 * o.click, 0, Math.PI * 2); g.stroke(); g.globalAlpha = 1; }
      g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 38); g.lineTo(10, 29); g.lineTo(18, 46); g.lineTo(25, 43); g.lineTo(17, 26); g.lineTo(30, 26); g.closePath();
      g.fillStyle = TH.ink; g.fill(); g.lineWidth = 3; g.strokeStyle = '#fff'; g.stroke(); g.restore();
    },
    type: (s, p) => s.slice(0, Math.round(s.length * clamp(p))),
    window(x, y, w, h, title, body, o = {}) {           // plain app window: title bar with dots + plain-text title, then body(g, w, h) clipped
      K.card(x, y, w, h, { r: 20, dark: o.dark });
      g.save(); rr(x, y, w, h, 20); g.clip();
      g.fillStyle = o.dark ? '#26262B' : TH.bar; g.fillRect(x, y, w, 56);
      ['#E5675A', '#E8B64C', '#5DBB6A'].forEach((c, i) => { g.beginPath(); g.arc(x + 30 + i * 24, y + 28, 7, 0, Math.PI * 2); g.fillStyle = c; g.fill(); });
      K.text(x + 112, y + 15, title, { size: 24, fam: FAM.mono, color: o.dark ? '#C9C7CF' : TH.grey });
      g.translate(x, y + 56); body && body(g, w, h - 56); g.restore();
    },
    phone(x, y, w, h, screen) {                         // simple phone frame; screen(g, w, h) clipped to the display
      g.save(); g.shadowColor = 'rgba(28,27,25,0.18)'; g.shadowBlur = 36; g.shadowOffsetY = 14;
      rr(x, y, w, h, 46); g.fillStyle = '#1B1B1F'; g.fill(); g.restore();
      const ix = x + 14, iy = y + 14, iw = w - 28, ih = h - 28; g.save(); rr(ix, iy, iw, ih, 34); g.clip(); g.fillStyle = TH.screen; g.fillRect(ix, iy, iw, ih);
      g.translate(ix, iy); screen && screen(g, iw, ih); g.restore();
      rr(x + w / 2 - 50, y + 22, 100, 26, 13); g.fillStyle = '#1B1B1F'; g.fill();
    },
    g: () => g,
  };

  // ── the fixed layer ──
  let grain = null;
  function makeGrain() {
    grain = document.createElement('canvas'); grain.width = W; grain.height = H; const q = grain.getContext('2d'), img = q.createImageData(W, H), R = rng(11);
    for (let i = 0; i < img.data.length; i += 4) { const v = R() * 255; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = TH.grain; }
    q.putImageData(img, 0, 0);
  }
  function paper() {
    g.fillStyle = TH.paper; g.fillRect(0, 0, W, H);
    g.strokeStyle = TH.rule; g.fillStyle = TH.rule; g.lineWidth = 2; g.globalAlpha = 0.55;
    if (TH.bg === 'rules') for (let y = 96; y < H; y += 58) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); }
    else if (TH.bg === 'dots') { g.globalAlpha = 0.9; for (let y = 30; y < H; y += 44) for (let x = 30; x < W; x += 44) { g.beginPath(); g.arc(x, y, 2, 0, Math.PI * 2); g.fill(); } }
    else if (TH.bg === 'grid') { g.globalAlpha = 1; for (let y = 0; y < H; y += 54) { g.beginPath(); g.moveTo(0, y + 0.5); g.lineTo(W, y + 0.5); g.stroke(); } for (let x = 0; x < W; x += 54) { g.beginPath(); g.moveTo(x + 0.5, 0); g.lineTo(x + 0.5, H); g.stroke(); } }
    else if (TH.bg === 'margin') { g.globalAlpha = 1; for (const y of [92, H - 52]) { g.beginPath(); g.moveTo(M, y); g.lineTo(W - M, y); g.stroke(); } }
    g.globalAlpha = 1; if (TH.grain) g.drawImage(grain, 0, 0);
  }
  function parseTitle(s) {                              // "Steal the *format*" → [{w, accent}]
    const out = []; String(s || '').split(/(\*[^*]+\*)/).forEach(part => {
      if (!part) return; const acc = /^\*.*\*$/.test(part), glue = !acc && out.length && !/^\s/.test(part);
      (acc ? part.slice(1, -1) : part).split(/\s+/).filter(Boolean).forEach((w, k) => out.push({ w, acc, glue: glue && k === 0 }));
    }); return out;
  }
  function headline(sl, lt, i) {
    const size = sl.titleSize || 104, fontN = font(size, TH.head, TH.headWt), fontA = font(Math.round(size * (TH.accScale || 1.14)), TH.acc, TH.accWt || '', TH.accIt ? 'italic' : '');
    const toks = parseTitle(TH.headCase ? String(sl.title || '').toUpperCase() : sl.title); const lines = [[]]; let x = 0; const maxW = W - 2 * M;
    g.font = fontN; const sp = g.measureText(' ').width;
    for (const tk of toks) { g.font = tk.acc ? fontA : fontN; tk.width = g.measureText(tk.w).width; if (tk.glue && x > 0) x -= sp; else if (x > 0 && x + tk.width > maxW) { lines.push([]); x = 0; } lines[lines.length - 1].push(tk); x += tk.width + sp; }
    let y = 160 + size * 0.86; let ai = 0;
    for (const ln of lines) {
      let lx = M;
      for (const tk of ln) {
        if (tk.glue) lx -= sp;
        g.save(); g.textBaseline = 'alphabetic';
        if (tk.acc) {                                   // the accent word keeps moving in its own seamless loop
          const mv = sl.accentMove || 'bob', ph = ai++ * 0.15; let dx = 0, dy = 0, rot = 0, sc = 1;
          if (mv === 'bob') dy = T.float(lt, 6, 1, ph);
          else if (mv === 'tilt') rot = T.wave(lt, 1, ph) * 0.05;
          else if (mv === 'pulse') sc = 1 + 0.035 * (0.5 + 0.5 * T.wave(lt, 2, ph));
          else if (mv === 'slide') dx = 10 * (0.5 + 0.5 * T.wave(lt, 1, ph));
          if (mv === 'wave') { g.font = fontA; g.fillStyle = TH.accent; let cx = lx; [...tk.w].forEach((c, k) => { g.fillText(c, cx, y + T.float(lt, 7, 1, k * 0.09)); cx += g.measureText(c).width; }); }
          else { if (TH.accHighlight) { g.fillStyle = TH.accHighlight; g.fillRect(lx - 8, y - size * 0.36 + dy, tk.width + 16, size * 0.42); }
            g.translate(lx + tk.width / 2 + dx, y - size * 0.3 + dy); g.rotate(rot); g.scale(sc, sc); g.font = fontA; g.fillStyle = TH.accent; g.fillText(tk.w, -tk.width / 2, size * 0.3); }
        } else { g.font = fontN; g.fillStyle = TH.ink; g.fillText(tk.w, lx, y); }
        g.restore(); lx += tk.width + sp;
      }
      y += size * 1.0;
    }
    return y - size * 0.86 + size * 0.14;               // bottom of the headline block
  }
  function smallText(sl, top) {
    if (!sl.text) return top;
    g.save(); g.font = font(38, FAM.sans, 500); g.fillStyle = TH.ink; g.globalAlpha = 0.75; g.textBaseline = 'top';
    const words = String(sl.text).split(/\s+/); let line = '', y = top + 22; const maxW = 900;
    for (const w of words) { const t2 = line ? line + ' ' + w : w; if (g.measureText(t2).width > maxW && line) { g.fillText(line, M, y); y += 49; line = w; } else line = t2; }
    if (line) { g.fillText(line, M, y); y += 49; } g.restore(); return y;
  }
  function swipeLine(i, n, lt) {                        // continuous across slides: enters and leaves at exactly y = Y0
    const Y0 = 1232, last = i === n - 1, R = rng(100 + i), a1 = 6 + R() * 6, a2 = 3 + R() * 4, ph = R() * 6;
    const xEnd = last ? W - 190 : W + 4;
    g.save(); g.strokeStyle = TH.mark; g.lineWidth = 6; g.lineCap = 'round'; g.beginPath();
    for (let x = -4; x <= xEnd; x += 6) { const u = x / W, env = Math.sin(Math.PI * clamp(u)); const y = Y0 + env * (a1 * Math.sin(u * 7 + ph) + a2 * Math.sin(u * 17 + ph * 2)); x === -4 ? g.moveTo(x, y) : g.lineTo(x, y); }
    g.stroke(); g.restore();
    if (last) {                                         // the line ends in a small heart that beats twice per slide
      const s = 1 + 0.12 * Math.max(0, T.wave(lt, 2)); g.save(); g.translate(xEnd + 30, Y0); g.scale(s, s); g.fillStyle = TH.mark; g.beginPath();
      g.moveTo(0, 10); g.bezierCurveTo(-26, -8, -14, -30, 0, -14); g.bezierCurveTo(14, -30, 26, -8, 0, 10); g.fill(); g.restore();
    } else if (REEL.swipeNote !== false) {
      const nudge = 10 * Math.max(0, T.wave(lt, 2)), sl = window.SLIDES[i];
      K.note((sl && sl.mascot && MASC.ok ? W - M - 520 : W - M - 150) + nudge, Y0 - 44, REEL.swipeText || 'deslize →', { size: 36, rot: -2 });
    }
  }
  function header(i, n) {
    g.save(); g.font = font(24, FAM.mono, 500); g.fillStyle = TH.grey; g.textBaseline = 'top';
    g.fillText(REEL.header || '// carrossel', M, 54);
    const num = `${String(i + 1).padStart(2, '0')}/${String(n).padStart(2, '0')}`; g.textAlign = 'right'; g.fillText(num, W - M, 54); g.restore();
  }

  // ── the user's image mascot (reel.json "mascot", tools/mascot.py install): slide.mascot = 'point-side' | 'wave' | ... ──
  const MASC = { ok: false, img: {} };
  function mascot(sl, lt) {
    if (!sl.mascot || !MASC.ok) return;
    const want = sl.mascot === true ? 'explain' : sl.mascot, im = MASC.img[want] || MASC.img.explain || Object.values(MASC.img)[0];
    if (!im || !im.naturalWidth) return;
    const hgt = sl.mascotHeight || (REEL.mascot.height || 470), wid = hgt * im.naturalWidth / im.naturalHeight;
    g.save(); g.translate(W - M - wid / 2 + 30, H + 24 + T.float(lt, 5, 1)); g.rotate(T.wave(lt, 1, 0.25) * 0.012);   // idle bob + sway: whole cycles, loops
    if (sl.mascotFlip) g.scale(-1, 1);
    g.drawImage(im, -wid / 2, -hgt, wid, hgt); g.restore();
  }

  // ── boot + page contract ──
  const warned = new Set();
  function warnOnce(k, msg) { if (warned.has(k)) return; warned.add(k); console.error('[warn] ' + msg); }
  function draw(t, onlyIdx) {
    const n = window.SLIDES.length; let i = Math.min(n - 1, Math.floor(t / SLIDE + 1e-9)); if (onlyIdx !== null) i = onlyIdx;
    const lt = clamp(t - Math.floor(t / SLIDE + 1e-9) * SLIDE, 0, SLIDE), sl = window.SLIDES[i];
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; paper(); header(i, n);
    if (sl.label) K.text(M, 112, sl.label, { size: 26, fam: FAM.mono, color: TH.mark });
    const hb = headline(sl, lt, i), tb = smallText(sl, hb);
    if (tb > 492) warnOnce('txt' + i, `slide ${i + 1}: headline + small text end at y=${Math.round(tb)}, over the stage (y 500). Shorten them or set titleSize.`);
    const box = { x: M, y: 500, w: sl.mascot && MASC.ok ? W - 2 * M - 300 : W - 2 * M, h: 640 };   // the mascot takes the bottom-right corner
    if (typeof sl.stage === 'function') { g.save(); try { sl.stage(g, lt, T, K, box, i); } catch (e) { console.error(`slide ${i + 1} stage @${lt.toFixed(2)}: ${e.message}`); } g.restore(); }
    g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; swipeLine(i, n, lt); mascot(sl, lt);
  }
  async function boot() {
    REEL = await fetch('reel.json', { cache: 'no-store' }).then(r => r.json()).catch(() => ({}));
    const sz = REEL.size || {}; W = sz.w || 1080; H = sz.h || 1350; SLIDE = REEL.slideSeconds || 4;
    if (REEL.look && !LOOKS[REEL.look]) console.error('[warn] unknown look "' + REEL.look + '" (have: ' + Object.keys(LOOKS).join(', ') + '); using papel');
    const base = LOOKS[REEL.look] || LOOKS.papel, th = REEL.theme || {};
    Object.assign(TH, base, th); if (th.accent && !th.mark && base.mark === base.accent) TH.mark = th.accent;   // one brand colour recolours both when the look uses one
    cv.width = W; cv.height = H;
    await new Promise((res, rej) => { const s = document.createElement('script'); s.src = 'slides.js?' + Date.now(); s.onload = res; s.onerror = () => rej(new Error('slides.js failed to load')); document.head.appendChild(s); });
    if (!Array.isArray(window.SLIDES) || !window.SLIDES.length) throw new Error('slides.js must set window.SLIDES = [ ... ]');
    await Promise.all(['104px "Anton"', 'italic 104px "Instrument Serif"', '500 38px "Inter"', '500 24px "JetBrains Mono"', '700 30px "JetBrains Mono"',
      '700 104px "Space Grotesk"', '800 104px "Figtree"', '900 104px "Playfair Display"', 'italic 800 104px "Playfair Display"', 'italic 500 104px "Playfair Display"'].map(f => document.fonts.load(f)));
    makeGrain();
    if (REEL.mascot && Array.isArray(REEL.mascot.poses) && REEL.mascot.enabled !== false) {
      await Promise.all(REEL.mascot.poses.map(p => new Promise(res => { const im = new Image(); im.onload = res; im.onerror = () => { console.error('[warn] missing mascot pose assets/mascot/' + p + '.png'); res(); }; im.src = 'assets/mascot/' + p + '.png'; MASC.img[p] = im; })));
      MASC.ok = true;
    }
    window.DURATION = window.SLIDES.length * SLIDE; window.SLIDE = SLIDE; window.CAPTURE = 'canvas'; window.SFX = [];
    const q = new URLSearchParams(location.search), only = q.has('only') ? (+q.get('only') - 1) : null;
    window.renderAt = t => draw(t, only);
    if (q.has('t')) draw(+q.get('t'), only);
    else if (q.has('play')) { document.body.classList.add('fit'); const t0 = performance.now(); const loop = () => { draw(((performance.now() - t0) / 1000) % window.DURATION, only); requestAnimationFrame(loop); }; loop(); }
    else draw(0, only);
  }
  window.CAROUSEL = { T, K, LOOKS };
  window.READY = boot();
})();
