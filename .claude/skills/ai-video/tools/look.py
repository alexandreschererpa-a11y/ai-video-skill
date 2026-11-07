#!/usr/bin/env python3
"""Your own looks ("copy this look"): colours and fonts read from reference screenshots, saved once, used by any project.

  python3 tools/look.py palette <img1> [img2 ...]      dominant colours of reference screenshots / video frames → roles + swatch
  python3 tools/look.py frames <video.mp4> [n]         n frames (default 6) from a screen recording → <video>_frames/ (then palette)
  python3 tools/look.py save <name> <look.json>        save a look (see guides/copy-look.md for the fields)
  python3 tools/look.py list | show <name>
  python3 tools/look.py preview <name> [--out dir]     render the sample carousel in this look → stills sheet to compare with the reference

Looks live in ~/.config/ai-video/looks/<name>.json. `reel new <dir> --style carousel|classic --look <name>` applies one
(carousel: every colour, font and background; classic: paper, accent, second ink). Built-in carousel looks need no file:
papel, noite, vibrante, tech, editorial.
"""
import colorsys, json, shutil, subprocess, sys, tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

SKILL = Path(__file__).resolve().parent.parent
LOOKS = Path.home() / '.config' / 'ai-video' / 'looks'
BUILTIN = ['papel', 'noite', 'vibrante', 'tech', 'editorial']
FONTS = ['Anton', 'Instrument Serif', 'Inter', 'JetBrains Mono', 'IBM Plex Mono', 'Space Grotesk', 'Barlow Condensed', 'Nunito',
         'Figtree', 'Playfair Display', 'VT323']
KEYS = ['bg', 'grain', 'paper', 'ink', 'grey', 'rule', 'card', 'border', 'dark', 'accent', 'mark', 'onMark', 'line', 'chip', 'bar', 'screen',
        'head', 'headWt', 'headCase', 'acc', 'accIt', 'accWt', 'accScale', 'accHighlight', 'note', 'noteIt']


def die(m): sys.exit('look: ' + m)
def hexc(c): return '#%02X%02X%02X' % tuple(int(round(v)) for v in c[:3])


def palette(files):
    px, edge = [], []
    for f in files:
        im = Image.open(f).convert('RGB'); im.thumbnail((360, 640)); a = np.asarray(im).reshape(-1, 3); px.append(a)
        b = np.asarray(im); edge.append(np.concatenate([b[:6].reshape(-1, 3), b[-6:].reshape(-1, 3), b[:, :6].reshape(-1, 3), b[:, -6:].reshape(-1, 3)]))
    allp = np.concatenate(px)
    q = Image.fromarray(allp.reshape(1, -1, 3).astype(np.uint8)).quantize(colors=12, method=Image.Quantize.MEDIANCUT)
    pal = np.array(q.getpalette()[:36]).reshape(-1, 3); cnt = np.bincount(np.asarray(q).ravel(), minlength=12)[:len(pal)]
    order = np.argsort(-cnt); share = cnt / cnt.sum()
    bg = np.median(np.concatenate(edge), axis=0)
    info = []
    for i in order:
        c = pal[i]; h, l, s = colorsys.rgb_to_hls(*(c / 255))
        info.append({'hex': hexc(c), 'share': round(float(share[i]), 3), 'light': round(l, 2), 'sat': round(s, 2)})
    bgl = colorsys.rgb_to_hls(*(bg / 255))[1]; mode = 'dark' if bgl < 0.35 else 'light'
    big = [x for x in info if x['share'] > 0.01] or info
    f = allp.astype(np.float32) / 255; mx, mn = f.max(1), f.min(1); l = (mx + mn) / 2
    txt = allp[(l > 0.8) & (mx - mn < 0.15)] if mode == 'dark' else allp[(l < 0.22) & (mx - mn < 0.2)]   # text: near-white on dark, near-black on light
    ink = hexc(np.median(txt, axis=0)) if len(txt) > len(allp) * 0.001 else (max(big, key=lambda x: x['light']) if mode == 'dark' else min(big, key=lambda x: x['light']))['hex']
    sat = np.where(mx - mn > 0, (mx - mn) / np.maximum(1e-6, 1 - np.abs(2 * l - 1)), 0)
    vivid = allp[(sat > 0.45) & (l > 0.25) & (l < 0.8)]          # thin accent strokes count too: they are rare but vivid
    accent, second = max(info, key=lambda x: x['sat'])['hex'], None
    if len(vivid) > len(allp) * 0.002:                          # group vivid pixels by hue: the biggest group is the accent
        hue = np.array([colorsys.rgb_to_hls(*(c / 255))[0] for c in vivid[:: max(1, len(vivid) // 4000)]])
        sample = vivid[:: max(1, len(vivid) // 4000)]; bins = (hue * 12).astype(int) % 12; cnt = np.bincount(bins, minlength=12)
        top = np.argsort(-cnt); accent = hexc(np.median(sample[bins == top[0]], axis=0))
        if cnt[top[1]] > cnt[top[0]] * 0.25: second = hexc(np.median(sample[bins == top[1]], axis=0))
    roles = {'paper (background)': hexc(bg), 'ink (text)': ink, 'accent (most vivid)': accent, 'second colour': second, 'mode': mode,
             'vivid share': round(len(vivid) / len(allp), 4)}
    sw = Image.new('RGB', (110 * len(info), 150), 'white'); d = ImageDraw.Draw(sw)
    try: fnt = ImageFont.truetype(str(SKILL / 'fonts' / 'JetBrainsMono-500-normal.woff2'), 14)
    except Exception: fnt = None
    for k, x in enumerate(info):
        d.rectangle((k * 110, 0, k * 110 + 108, 108), fill=x['hex']); d.text((k * 110 + 4, 114), x['hex'], fill='black', font=fnt)
        d.text((k * 110 + 4, 132), f"{x['share'] * 100:.0f}%", fill='black', font=fnt)
    out = Path(files[0]).with_name('palette.png'); sw.save(out)
    print(json.dumps({'roles': roles, 'colours': info}, indent=1)); print('swatch:', out, '(look at it next to the reference)')


def frames(video, n=6):
    v = Path(video); out = v.with_name(v.stem + '_frames'); out.mkdir(exist_ok=True)
    dur = float(subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', str(v)], capture_output=True, text=True).stdout or 0)
    if not dur: die('could not read the video duration')
    for k in range(n):
        t = dur * (k + 0.5) / n
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', f'{t:.2f}', '-i', str(v), '-frames:v', '1', str(out / f'f{k + 1:02d}.jpg')], check=True)
    print('frames:', ' '.join(str(p) for p in sorted(out.glob('f*.jpg'))))


def save(name, src):
    L = json.loads(Path(src).read_text())
    if L.get('base') and L['base'] not in BUILTIN: die(f'"base" must be one of {BUILTIN}')
    bad = [k for k in (L.get('carousel') or {}) if k not in KEYS]
    if bad: die(f'unknown carousel keys {bad} (have: {", ".join(KEYS)})')
    used = [v for k, v in (L.get('carousel') or {}).items() if k in ('head', 'acc', 'note')]
    miss = [f for f in used if f.strip('"') not in FONTS]
    if miss: die(f'fonts {miss} are not bundled; use one of: {", ".join(FONTS)} (wrap in double quotes, e.g. "\\"Anton\\"")')
    L['name'] = name; LOOKS.mkdir(parents=True, exist_ok=True); (LOOKS / f'{name}.json').write_text(json.dumps(L, indent=2, ensure_ascii=False))
    print(f'saved look "{name}" → {LOOKS / (name + ".json")}. Use it: reel new <dir> --style carousel --look {name}')


def preview(name):
    if name not in BUILTIN and not (LOOKS / f'{name}.json').exists(): die(f'no look "{name}"')
    out = Path(sys.argv[sys.argv.index('--out') + 1]) if '--out' in sys.argv else Path(tempfile.mkdtemp()) / f'look-{name}'
    if out.exists(): shutil.rmtree(out)
    reel = SKILL / 'tools' / 'reel.mjs'
    subprocess.run(['node', str(reel), 'new', str(out), '--style', 'carousel', '--look', name], check=True, capture_output=True)
    r = subprocess.run(['node', str(reel), 'stills', str(out), '0.3', '5.6', '10.6'], capture_output=True, text=True)
    print((r.stdout + r.stderr).strip().splitlines()[-1]); print('preview sheet:', out / 'stills' / 'sheet.jpg')


def main():
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    if '--out' in sys.argv: a = [x for x in a if x != sys.argv[sys.argv.index('--out') + 1]]
    if not a: print(__doc__); sys.exit(1)
    c = a[0]
    if c == 'palette' and len(a) >= 2: palette(a[1:])
    elif c == 'frames' and len(a) in (2, 3): frames(a[1], int(a[2]) if len(a) == 3 else 6)
    elif c == 'save' and len(a) == 3: save(a[1], a[2])
    elif c == 'list':
        print('built-in (carousel):', ', '.join(BUILTIN))
        for f in sorted(LOOKS.glob('*.json')) if LOOKS.exists() else []: print('yours:', f.stem, '·', json.loads(f.read_text()).get('notes', '')[:70])
    elif c == 'show' and len(a) == 2:
        f = LOOKS / f'{a[1]}.json'; print(f.read_text() if f.exists() else die(f'no look "{a[1]}"'))
    elif c == 'preview' and len(a) == 2: preview(a[1])
    else: print(__doc__); sys.exit(1)


if __name__ == '__main__': main()
