#!/usr/bin/env python3
"""Your own mascot: an image presenter that replaces the drawn one (classic reels) and can host carousel slides.

  python3 tools/mascot.py sheet <name> "<what it looks like>" [--style "<art style>"] [--ref art_style.png] [--variants 3]
        → character reference sheets (front, 3/4, side, back) → ~/.config/ai-video/mascots/<name>/sheet_1.png ... + sheets.jpg
  python3 tools/mascot.py pick <name> <n | image.png>   keep sheet n (or a sheet you made elsewhere) as the mascot's ID (sheet.png)
  python3 tools/mascot.py poses <name> [--poses explain,point-side,...] [--fix "<what to correct>"]
        → one image per pose from the sheet, cut out (transparent PNG) → <name>/<pose>.png + poses.jpg (dark contact sheet)
  python3 tools/mascot.py add <name> <pose> <image.png>  use your own image for a pose (it is cut out the same way)
  python3 tools/mascot.py recut <name> [pose]            cut the saved raw images again (after tuning --tol / --shadow)
  python3 tools/mascot.py cut <image> [out.png]          cut any image on a flat background
  python3 tools/mascot.py use <name> | drawn             new classic reels use this mascot (or the drawn presenter again)
  python3 tools/mascot.py install <project> [--name n]   copy the mascot into a project (reel new does it when a mascot is in use)
  python3 tools/mascot.py list | show <name>

Every image generation is ONE paid request. Provider (--provider auto|gemini|openrouter, default auto): Gemini API
(GEMINI_API_KEY or ~/.config/gemini/api.key; its free tier allows NO image models: billing must be on), else OpenRouter
(OPENROUTER_API_KEY or ~/.config/openrouter/.env; needs credit). Say what it costs before running a batch.
Free route: make the poses yourself in the Gemini app (gemini.google.com) with the prompts this tool prints (--print-prompts),
then add each image with `add`: the cut-out and everything after it is the same. Images are generated on a flat light-grey background (#E9E9EE) and cut out locally (numpy + Pillow).
"""
import base64, json, os, shutil, sys, urllib.error, urllib.request
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

CFG = Path.home() / '.config' / 'ai-video'
HOME = CFG / 'mascots'
BG = '#E9E9EE'
MODELS = ['gemini-3.1-flash-image', 'gemini-3-pro-image', 'gemini-2.5-flash-image']

# Poses the engines know (classic maps the presenter's acting onto these; carousel slides pick one by name).
# Pointing poses point to the VIEWER'S LEFT: the mascot docks bottom-right, so the content is to its left (the engine mirrors them).
POSES = {
    'explain':    'talking to the viewer, both hands open in front of the chest in a friendly explaining gesture, mouth slightly open',
    'point-side': 'pointing with one arm stretched straight out toward the LEFT edge of the image (the viewer\'s left), looking that way, confident smile',
    'point-up':   'pointing up and to the LEFT, toward the top-left corner of the image, with one arm raised high, looking up at it',
    'point-down': 'pointing down with one hand toward the bottom of the image, excited, inviting the viewer to comment',
    'think':      'thinking, one hand on the chin, eyes looking up, slightly puzzled',
    'shrug':      'shrugging with both palms up, eyebrows raised, a playful "who knows?" expression',
    'thumbsup':   'big smile, giving a thumbs up toward the viewer',
    'wave':       'waving hello at the viewer with one open hand raised, big friendly smile',
    'phone':      'holding a smartphone up beside the face with the screen facing the viewer; the screen is plain white',
    'cheer':      'celebrating, both fists raised in the air, very happy',
    'shock':      'surprised, mouth wide open, both hands up near the face',
}
DEFAULT_POSES = ['explain', 'point-side', 'point-up', 'point-down', 'think', 'shrug', 'thumbsup', 'wave']
DEFAULT_STYLE = 'clean 2D cartoon illustration, bold smooth outlines, flat colours with soft cel shading, friendly proportions'


def die(msg): sys.exit('mascot: ' + msg)
def arg(name, default=None):
    if f'--{name}' in sys.argv:
        i = sys.argv.index(f'--{name}')
        return sys.argv[i + 1] if i + 1 < len(sys.argv) and not sys.argv[i + 1].startswith('--') else True
    return default
def pos_args():
    out, skip = [], False
    for a in sys.argv[1:]:
        if skip: skip = False; continue
        if a.startswith('--'): skip = a[2:] not in ('shadow', 'print-prompts'); continue
        out.append(a)
    return out


def key():
    if os.environ.get('GEMINI_API_KEY'): return os.environ['GEMINI_API_KEY'].strip()
    for f in [Path.home() / '.config' / 'gemini' / 'api.key', CFG / 'gemini.key']:
        if f.exists(): return f.read_text().strip()
    die('no Gemini key: set GEMINI_API_KEY or save it (one line) to ~/.config/gemini/api.key')


def or_key():
    if os.environ.get('OPENROUTER_API_KEY'): return os.environ['OPENROUTER_API_KEY'].strip()
    f = Path.home() / '.config' / 'openrouter' / '.env'
    if f.exists():
        for line in f.read_text().splitlines():
            if line.startswith('OPENROUTER_API_KEY='): return line.split('=', 1)[1].strip().strip('"\'')
    return None


class Quota(Exception): pass


def openrouter_image(prompt, refs, out, aspect):
    k = or_key()
    if not k: raise Quota('no OpenRouter key')
    content = [{'type': 'text', 'text': prompt}]
    for r in refs:
        r = Path(r); mime = 'image/png' if r.suffix.lower() == '.png' else 'image/jpeg'
        content.append({'type': 'image_url', 'image_url': {'url': f'data:{mime};base64,' + base64.b64encode(r.read_bytes()).decode()}})
    m = arg('or-model') if isinstance(arg('or-model'), str) else 'google/gemini-3.1-flash-image'
    body = {'model': m, 'messages': [{'role': 'user', 'content': content}], 'modalities': ['image', 'text'], 'image_config': {'aspect_ratio': aspect}}
    req = urllib.request.Request('https://openrouter.ai/api/v1/chat/completions', data=json.dumps(body).encode(),
                                 headers={'Authorization': 'Bearer ' + k, 'Content-Type': 'application/json'})
    try: data = json.load(urllib.request.urlopen(req, timeout=300))
    except urllib.error.HTTPError as e:
        msg = e.read().decode()[:300]
        if e.code == 402: raise Quota('OpenRouter: no credit left (add credit at openrouter.ai/settings/credits)')
        die(f'OpenRouter HTTP {e.code}: {msg}')
    except urllib.error.URLError as e: die(f'network error: {e.reason}')
    for ch in data.get('choices', []):
        for im in (ch.get('message') or {}).get('images', []) or []:
            url = (im.get('image_url') or {}).get('url', '')
            if url.startswith('data:image'):
                tmp = out.with_suffix('.tmp'); tmp.write_bytes(base64.b64decode(url.split(',', 1)[1]))
                Image.open(tmp).convert('RGB').save(out); tmp.unlink(); return 'openrouter:' + m
    die(f'OpenRouter {m} returned no image. Rephrase and try again.')


def gen_image(prompt, refs, out, aspect):
    prov = arg('provider', 'auto'); errs = []
    if prov in ('auto', 'gemini', True):
        try: return gemini_image(prompt, refs, out, aspect)
        except Quota as e:
            errs.append(str(e))
            if prov == 'gemini': die(str(e))
    try: return openrouter_image(prompt, refs, out, aspect)
    except Quota as e: errs.append(str(e))
    die('no provider can generate images right now:\n  - ' + '\n  - '.join(errs) +
        '\n  Fix one: turn on billing for the Gemini API key (aistudio.google.com → your project → Billing), or add OpenRouter credit.'
        '\n  Free route: run with --print-prompts, make the images in the Gemini app, then  mascot.py add <name> <pose> <image>.')


def gemini_image(prompt, refs, out, aspect):
    """One image request. refs = image paths sent as references. Writes out (PNG). Never retried blindly: a failure stops."""
    parts = [{'text': prompt}]
    for r in refs:
        r = Path(r); mime = 'image/png' if r.suffix.lower() == '.png' else 'image/jpeg'
        parts.append({'inlineData': {'mimeType': mime, 'data': base64.b64encode(r.read_bytes()).decode()}})
    models = [arg('model')] if isinstance(arg('model'), str) else MODELS
    last = ''
    for m in models:
        for cfg in ({'responseModalities': ['TEXT', 'IMAGE'], 'imageConfig': {'aspectRatio': aspect}}, {'responseModalities': ['TEXT', 'IMAGE']}):
            body = {'contents': [{'role': 'user', 'parts': parts}], 'generationConfig': cfg}
            req = urllib.request.Request(f'https://generativelanguage.googleapis.com/v1beta/models/{m}:generateContent',
                                         data=json.dumps(body).encode(), headers={'x-goog-api-key': key(), 'Content-Type': 'application/json'})
            try: data = json.load(urllib.request.urlopen(req, timeout=300))
            except urllib.error.HTTPError as e:
                full = e.read().decode(); last = f'{m}: HTTP {e.code} {full[:300]}'
                if e.code == 404: break                       # model not on this account: next model
                if e.code == 429 and ('free_tier' in full.lower() or 'limit: 0' in full): raise Quota('Gemini API: free tier, image models have a limit of 0 (billing is off)')
                if e.code == 429: raise Quota('Gemini API: rate limit reached, try again in a minute')
                if e.code == 400 and ('imageConfig' in last or 'aspect' in last.lower()): continue   # no aspect support: retry without it
                die(last)
            except urllib.error.URLError as e: die(f'network error: {e.reason}')
            for c in data.get('candidates', []):
                for p in (c.get('content') or {}).get('parts', []):
                    d = p.get('inlineData') or p.get('inline_data')
                    if d and str(d.get('mimeType', '')).startswith('image/'):
                        tmp = out.with_suffix('.tmp')
                        tmp.write_bytes(base64.b64decode(d['data']))
                        Image.open(tmp).convert('RGB').save(out); tmp.unlink()
                        return m
            fb = (data.get('promptFeedback') or {}).get('blockReason') or [c.get('finishReason') for c in data.get('candidates', [])]
            die(f'{m} returned no image ({fb}). Rephrase the description and try again.')
    die('no image model worked: ' + last)


# ── cut-out: remove only the flat background, keep every part of the character ──
def label(mask):
    """Connected regions (4-neighbour) of a bool array via run-length union-find: fast with numpy + plain Python, no scipy."""
    h, w = mask.shape
    par = []
    def find(x):
        while par[x] != x: par[x] = par[par[x]]; x = par[x]
        return x
    rows, prev = [], []
    for y in range(h):
        r = np.concatenate([[0], mask[y].view(np.int8), [0]]); d = np.diff(r)
        st, en = np.nonzero(d == 1)[0], np.nonzero(d == -1)[0]
        cur = []
        for s0, e0 in zip(st.tolist(), en.tolist()):
            lid = len(par); par.append(lid)
            for ps, pe, pl in prev:
                if ps < e0 and s0 < pe:
                    a, b = find(lid), find(pl)
                    if a != b: par[max(a, b)] = min(a, b)
            cur.append((s0, e0, lid))
        rows.append(cur); prev = cur
    out = np.zeros((h, w), np.int32); roots = {}
    for y, cur in enumerate(rows):
        for s0, e0, lid in cur:
            r = find(lid); out[y, s0:e0] = roots.setdefault(r, len(roots) + 1)
    return out, len(roots)


def cut(src, dst, tol=None, shadow=None):
    tol = float(tol if tol is not None else arg('tol', 16)); shadow = has_flag('shadow') if shadow is None else shadow
    img = Image.open(src).convert('RGB'); a = np.asarray(img).astype(np.float32); h, w, _ = a.shape
    edge = np.concatenate([a[0], a[-1], a[:, 0], a[:, -1]])
    bg = np.median(edge, axis=0)
    dist = np.abs(a - bg).max(axis=2)
    m = dist < tol
    if shadow:                                                 # soft grey floor shadows: low saturation, a little darker than the background
        sat = a.max(axis=2) - a.min(axis=2)
        m |= (sat < 10) & (a.mean(axis=2) < bg.mean()) & (a.mean(axis=2) > bg.mean() - 55)
    mi = Image.fromarray(np.where(m, 255, 0).astype(np.uint8), 'L').filter(ImageFilter.MinFilter(3)).filter(ImageFilter.MaxFilter(3))
    m = np.asarray(mi) > 127
    lab, n = label(m)
    area = np.bincount(lab.ravel(), minlength=n + 1)
    edge_ids = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    big = h * w * 0.0012                                       # enclosed background (the gap between an arm and the body) goes too
    flat = np.bincount(lab.ravel(), weights=dist.ravel(), minlength=n + 1) / np.maximum(area, 1)
    isbg = np.zeros(n + 1, bool); isbg[edge_ids] = True
    isbg |= (area >= big) & (flat < tol * 0.6); isbg[0] = False
    bgm = isbg[lab]
    flab, fn = label(~bgm)                                     # keep the character and its props, drop specks
    farea = np.bincount(flab.ravel(), minlength=fn + 1); farea[0] = 0
    keepid = farea >= max(400, (~bgm).sum() * 0.004); keepid[0] = False
    fg = keepid[flab]
    near = np.asarray(Image.fromarray(np.where(fg, 0, 255).astype(np.uint8), 'L').filter(ImageFilter.MaxFilter(5))) > 127
    soft = np.clip((dist - tol * 0.5) / (tol * 1.6), 0, 1)
    alpha = np.where(fg, np.where(near, np.maximum(soft, 0.0), 1.0), 0.0)
    alpha = np.asarray(Image.fromarray((alpha * 255).astype(np.uint8), 'L').filter(ImageFilter.GaussianBlur(0.6))).astype(np.float32) / 255
    alpha = np.where(fg & ~near, 1.0, alpha) * fg
    au = np.clip(alpha, 1e-3, 1)[..., None]
    rgb = np.clip((a - (1 - au) * bg) / au, 0, 255)            # remove the grey halo on soft edges
    out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
    ys, xs = np.nonzero(alpha > 0.05)
    if not len(xs): die(f'{src}: nothing left after removing the background (is it a flat background?)')
    pad = 24; x0, x1, y0, y1 = max(0, xs.min() - pad), min(w, xs.max() + pad + 1), max(0, ys.min() - pad), min(h, ys.max() + pad + 1)
    touches = xs.min() < 3 or ys.min() < 3 or xs.max() > w - 4 or ys.max() > h - 4
    Image.fromarray(out[y0:y1, x0:x1], 'RGBA').save(dst)
    cov = float((alpha > 0.5).mean())
    note = '  ⚠ touches the image edge: part of the character may be cut off' if touches else ''
    print(f'cut: {dst}  {x1 - x0}x{y1 - y0}  subject {cov * 100:.0f}% of the frame{note}')
    return dst


def has_flag(n): return f'--{n}' in sys.argv


def contact(files, out, labels=None, bg=(30, 30, 34), cell=360):
    ims = [Image.open(f).convert('RGBA') for f in files]
    cols = min(4, len(ims)); rows = (len(ims) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cell, rows * (cell + 34)), bg); d = ImageDraw.Draw(sheet)
    try: font = ImageFont.truetype(str(Path(__file__).resolve().parent.parent / 'fonts' / 'Inter-Medium.ttf'), 20)
    except Exception: font = None
    for i, im in enumerate(ims):
        im.thumbnail((cell - 20, cell - 20)); x = (i % cols) * cell; y = (i // cols) * (cell + 34)
        sheet.paste(im, (x + (cell - im.width) // 2, y + (cell - im.height) // 2), im)
        if labels: d.text((x + 10, y + cell + 6), labels[i], fill=(220, 220, 225), font=font)
    sheet.save(out, quality=90); return out


def load(name):
    d = HOME / name
    if not d.exists(): die(f'no mascot "{name}" yet (python3 tools/mascot.py sheet {name} "<description>")')
    meta = json.loads((d / 'mascot.json').read_text()) if (d / 'mascot.json').exists() else {'name': name, 'poses': {}}
    return d, meta
def save(d, meta): (d / 'mascot.json').write_text(json.dumps(meta, indent=2, ensure_ascii=False))


def cmd_sheet(name, desc):
    d = HOME / name; d.mkdir(parents=True, exist_ok=True)
    ref = arg('ref'); style = arg('style') if isinstance(arg('style'), str) else None
    look = f'in the same art style as the uploaded reference image (do not copy the character itself)' if isinstance(ref, str) else f'art style: {style or DEFAULT_STYLE}'
    if isinstance(ref, str) and style: look += f'; {style}'
    prompt = (f'Create a character reference sheet of ONE original mascot character, {look}.\n'
              f'Character: {desc}.\n'
              'Sheet: the same character shown 4 times in a row: front view, 3/4 view, side view and back view, full body, neutral standing pose, '
              'evenly spaced with clear space between them.\n'
              f'Background: plain flat light grey ({BG}), perfectly uniform: no gradient, no floor, no shadow.\n'
              'Avoid light-grey clothing so the character separates cleanly from the background. No text, no labels, nothing else in the image. Format: 16:9.')
    if has_flag('print-prompts'): print('--- character sheet (Gemini app' + (', upload your style image' if isinstance(ref, str) else '') + ') ---\n' + prompt); return
    n = int(arg('variants', 3)); files = []
    for i in range(1, n + 1):
        f = d / f'sheet_{i}.png'; m = gen_image(prompt, [ref] if isinstance(ref, str) else [], f, '16:9'); files.append(f); print(f'sheet {i}: {f}  ({m})')
    if isinstance(ref, str): shutil.copy(ref, d / ('style_ref' + Path(ref).suffix.lower()))
    meta = {'name': name, 'description': desc, 'style': style or (None if isinstance(ref, str) else DEFAULT_STYLE), 'poses': {}}
    if (d / 'mascot.json').exists(): meta = {**json.loads((d / 'mascot.json').read_text()), **{k: v for k, v in meta.items() if k != 'poses'}}
    save(d, meta)
    sheets = []
    for f in files:
        im = Image.open(f); im.thumbnail((1200, 700)); t = d / (f.stem + '_thumb.jpg'); im.convert('RGB').save(t); sheets.append(t)
    col = Image.new('RGB', (max(Image.open(t).width for t in sheets), sum(Image.open(t).height + 10 for t in sheets)), 'white'); y = 0
    for t in sheets: im = Image.open(t); col.paste(im, (0, y)); y += im.height + 10; t.unlink()
    col.save(d / 'sheets.jpg', quality=88)
    print(f'look at {d / "sheets.jpg"}, then: python3 tools/mascot.py pick {name} <1-{n}>')


def cmd_pick(name, n):
    if Path(n).is_file():                                      # a sheet made elsewhere (Gemini app): becomes the ID as it is
        (HOME / name).mkdir(parents=True, exist_ok=True)
        if not (HOME / name / 'mascot.json').exists(): save(HOME / name, {'name': name, 'description': '', 'poses': {}})
        Image.open(n).convert('RGB').save(HOME / name / 'sheet_own.png'); n = 'own'
    d, meta = load(name); src = d / f'sheet_{n}.png'
    if not src.exists(): die(f'no {src.name}')
    shutil.copy(src, d / 'sheet.png'); meta['sheet'] = 'sheet.png'; save(d, meta); print(f'{name}: sheet {n} is the ID now → {d / "sheet.png"}')


def cmd_poses(name):
    d, meta = load(name)
    if not (d / 'sheet.png').exists() and not has_flag('print-prompts'): die(f'pick a sheet first: python3 tools/mascot.py pick {name} <n | sheet image>')
    want = arg('poses'); poses = want.split(',') if isinstance(want, str) else DEFAULT_POSES
    unknown = [p for p in poses if p not in POSES and ':' not in p]
    if unknown: die(f'unknown pose(s) {unknown}. Known: {", ".join(POSES)} (or a custom one as name:"description")')
    fix = arg('fix'); (d / 'raw').mkdir(exist_ok=True)
    refs = [d / 'sheet.png'] + ([next(d.glob('style_ref.*'))] if list(d.glob('style_ref.*')) else [])
    for p in poses:
        pname, pdesc = (p.split(':', 1) + [None])[:2] if ':' in p else (p, POSES[p])
        prompt = ('Using the uploaded character sheet, create the EXACT same character (same face, hair, clothes, colours, proportions and art style) in this pose:\n'
                  f'Pose: {pdesc}.\n' + (f'Correction: {fix}.\n' if isinstance(fix, str) else '') +
                  'Full body, fully visible with some empty space around it (nothing touches the edges), centred, facing the camera.\n'
                  f'Background: plain flat light grey ({BG}), perfectly uniform: no floor, no shadow, no gradient. No text, nothing else in the image. Format: 3:4.')
        raw = d / 'raw' / f'{pname}.png'
        if has_flag('print-prompts'): print(f'--- {pname} (Gemini app: upload sheet.png, paste) ---\n{prompt}\n'); continue
        m = gen_image(prompt, refs, raw, '3:4')
        cut(raw, d / f'{pname}.png'); meta['poses'][pname] = {'file': f'{pname}.png', 'prompt': pdesc}
        save(d, meta)
    show_sheet(d, meta)


def show_sheet(d, meta):
    names = [p for p in meta['poses'] if (d / f'{p}.png').exists()]
    if names: print('poses sheet:', contact([d / f'{p}.png' for p in names], d / 'poses.jpg', names), ' (dark background: check every edge, hand and prop)')


def cmd_add(name, pose, img):
    if not (HOME / name).exists():                              # own images only (no generated sheet): start the mascot here
        (HOME / name).mkdir(parents=True); save(HOME / name, {'name': name, 'description': 'own images', 'poses': {}})
    d, meta = load(name); (d / 'raw').mkdir(exist_ok=True)
    raw = d / 'raw' / f'{pose}.png'; Image.open(img).convert('RGB').save(raw)
    cut(raw, d / f'{pose}.png'); meta['poses'][pose] = {'file': f'{pose}.png', 'prompt': 'own image'}; save(d, meta); show_sheet(d, meta)


def cmd_recut(name, pose=None):
    d, meta = load(name)
    for p in ([pose] if pose else list(meta['poses'])):
        raw = d / 'raw' / f'{p}.png'
        if raw.exists(): cut(raw, d / f'{p}.png')
    show_sheet(d, meta)


def cfg_rw(fn):
    f = CFG / 'config.json'; c = json.loads(f.read_text()) if f.exists() else {}; fn(c); CFG.mkdir(parents=True, exist_ok=True); f.write_text(json.dumps(c, indent=2, ensure_ascii=False))


def cmd_use(name):
    if name in ('drawn', 'none', 'off'):
        cfg_rw(lambda c: c.update({'presenter_mode': 'drawn'})); print('new classic reels use the drawn presenter again'); return
    d, meta = load(name)
    if not meta['poses']: die(f'{name} has no poses yet: python3 tools/mascot.py poses {name}')
    cfg_rw(lambda c: c.update({'mascot': name, 'presenter_mode': 'mascot'}))
    print(f'new classic reels and carousels use the mascot "{name}" ({len(meta["poses"])} poses). Back to the drawn presenter: mascot.py use drawn')


def install(project, name=None):
    proj = Path(project).resolve(); rj = proj / 'reel.json'
    if not rj.exists(): die(f'{proj} is not a project (no reel.json)')
    if not name:
        c = json.loads((CFG / 'config.json').read_text()) if (CFG / 'config.json').exists() else {}
        name = c.get('mascot') or die('no mascot chosen: python3 tools/mascot.py use <name>  (or pass --name)')
    d, meta = load(name); dst = proj / 'assets' / 'mascot'; dst.mkdir(parents=True, exist_ok=True)
    poses = [p for p in meta['poses'] if (d / f'{p}.png').exists()]
    for p in poses: shutil.copy(d / f'{p}.png', dst / f'{p}.png')
    r = json.loads(rj.read_text()); old = r.get('mascot') if isinstance(r.get('mascot'), dict) else {}
    r['mascot'] = {**old, 'name': name, 'poses': poses}
    rj.write_text(json.dumps(r, indent=2, ensure_ascii=False))
    print(f'mascot "{name}" installed in {proj.name}: {len(poses)} poses → assets/mascot/  (reel.json "mascot")')


def main():
    a = pos_args()
    if not a: print(__doc__); sys.exit(1)
    c = a[0]
    if c == 'sheet' and len(a) >= 3: cmd_sheet(a[1], ' '.join(a[2:]))
    elif c == 'pick' and len(a) == 3: cmd_pick(a[1], a[2])
    elif c == 'poses' and len(a) == 2: cmd_poses(a[1])
    elif c == 'add' and len(a) == 4: cmd_add(a[1], a[2], a[3])
    elif c == 'recut' and len(a) in (2, 3): cmd_recut(a[1], a[2] if len(a) == 3 else None)
    elif c == 'cut' and len(a) in (2, 3): cut(a[1], a[2] if len(a) == 3 else str(Path(a[1]).with_name(Path(a[1]).stem + '_cut.png')))
    elif c == 'use' and len(a) == 2: cmd_use(a[1])
    elif c == 'install' and len(a) == 2: install(a[1], arg('name') if isinstance(arg('name'), str) else None)
    elif c == 'list':
        for d in sorted(HOME.glob('*/')) if HOME.exists() else []:
            m = json.loads((d / 'mascot.json').read_text()) if (d / 'mascot.json').exists() else {}
            print(f'{d.name}: {len(m.get("poses", {}))} poses · {m.get("description", "")[:70]}')
    elif c == 'show' and len(a) == 2:
        d, meta = load(a[1]); print(json.dumps(meta, indent=2, ensure_ascii=False)); show_sheet(d, meta)
    else: print(__doc__); sys.exit(1)


if __name__ == '__main__': main()
