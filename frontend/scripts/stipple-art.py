#!/usr/bin/env python3
"""Convierte las obras de art-src/ al look Hermes: tramado de puntos lima sobre negro.

Uso (desde frontend/):  python3 scripts/stipple-art.py
Requiere Pillow.  Salida: public/art/<deporte>.png (2 colores, muy liviano).
Para cambiar una obra, reemplaza art-src/<deporte>.jpg y vuelve a ejecutar.
"""
from pathlib import Path
from PIL import Image, ImageFilter, ImageOps

LIME = (212, 255, 63)      # #D4FF3F
BG = (10, 10, 10)          # #0A0A0A
WIDTH = 960                # px de la imagen final (las tarjetas son < 700px)
GAMMA = 0.85               # <1 aclara medios tonos; >1 los oscurece
CROP = {}                  # {'deporte': (izq, arriba, der, abajo)} para recortar bordes
INVERT = {'tennis'}         # grabados de línea (fondo blanco): trazo lima sobre negro
GAMMA_BY = {'home-prudence': 0.6, 'home-cardsharps': 0.8, 'home-moneylender': 1.0, 'home-hercules': 0.75, 'esports': 1.3, 'tennis': 1.2, 'basketball': 0.7, 'boxing': 0.9}  # ajuste por obra

root = Path(__file__).resolve().parent.parent
src, out = root / 'art-src', root / 'public' / 'art'
out.mkdir(parents=True, exist_ok=True)

for path in sorted(src.glob('*.jpg')):
    if path.stem.startswith('spare-'):  # obras guardadas sin usar
        continue
    gamma = GAMMA_BY.get(path.stem, GAMMA)
    im = Image.open(path).convert('L')
    if path.stem in CROP:
        im = im.crop(CROP[path.stem])
    im = im.resize((WIDTH, round(im.height * WIDTH / im.width)), Image.LANCZOS)
    im = ImageOps.autocontrast(im, cutoff=1.5)
    if path.stem in INVERT:
        im = ImageOps.invert(im)
    im = im.point(lambda v: int(255 * (v / 255) ** gamma))
    im = im.filter(ImageFilter.UnsharpMask(radius=2, percent=90, threshold=2))
    bw = im.convert('1')  # Floyd-Steinberg: la trama de puntos
    pal = Image.new('P', bw.size)
    pal.putpalette(list(BG) + list(LIME) + [0] * 762)
    pal.putdata([1 if p else 0 for p in list(bw.tobytes())] if False else [1 if bw.getpixel((x, y)) else 0 for y in range(bw.height) for x in range(bw.width)])
    pal.save(out / f'{path.stem}.png', optimize=True)
    print(path.stem, (out / f'{path.stem}.png').stat().st_size // 1024, 'KB')
