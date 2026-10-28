"""Convierte ilustraciones en tinta (negro/blanco) en máscaras de tinta con alfa.

La salida es un WebP con alfa = cantidad de tinta; el color lo pone la interfaz
(lima, crema…) con CSS mask, igual que el efecto «Hermes ink».
Uso (desde frontend/):  python3 -W ignore scripts/ink-animals.py
"""
from pathlib import Path
from PIL import Image, ImageFilter, ImageOps

SRC = Path('art-src/animals')
OUT = Path('public/art/animals')
MAX = 900

# invert=True: tinta oscura sobre fondo claro. lo/hi: niveles; crop: fracciones (l, t, r, b).
CFG = {
    'lobo':    dict(invert=True, lo=95, hi=185, blur=1.1),
    'aguila':  dict(invert=False, lo=40, hi=190, crop=(0, 0.12, 1, 1)),
    'oso':     dict(invert=True, lo=70, hi=200),
    'canguro': dict(invert=True, lo=90, hi=200),
    'camello': dict(invert=True, lo=80, hi=175, blur=0.8),
    'leon':    dict(invert=False, lo=60, hi=200, crop=(0, 0, 0.8, 1)),
    'jaguar':  dict(invert=True, lo=90, hi=200),
}

OUT.mkdir(parents=True, exist_ok=True)
for name, c in CFG.items():
    im = Image.open(SRC / f'{name}.jpg').convert('L')
    if 'crop' in c:
        w, h = im.size
        l, t, r, b = c['crop']
        im = im.crop((int(w * l), int(h * t), int(w * r), int(h * b)))
    if c.get('blur'):
        im = im.filter(ImageFilter.GaussianBlur(c['blur']))
    if c['invert']:
        im = ImageOps.invert(im)
    lo, hi = c['lo'], c['hi']
    if c['invert']:
        lo, hi = 255 - c['hi'], 255 - c['lo']
    alpha = im.point(lambda v: 0 if v <= lo else 255 if v >= hi else int((v - lo) * 255 / (hi - lo)))
    # recorta a la caja de la tinta para que encuadre centrado
    box = alpha.point(lambda v: 255 if v > 24 else 0).getbbox()
    if box:
        pad = 12
        box = (max(0, box[0] - pad), max(0, box[1] - pad), min(alpha.width, box[2] + pad), min(alpha.height, box[3] + pad))
        alpha = alpha.crop(box)
    alpha.thumbnail((MAX, MAX), Image.LANCZOS)
    out = Image.new('RGBA', alpha.size, (212, 255, 63, 0))
    out.putalpha(alpha)
    out.save(OUT / f'{name}.webp', quality=82, alpha_quality=92, method=6)
    print(name, alpha.size, (OUT / f'{name}.webp').stat().st_size // 1024, 'KB')
