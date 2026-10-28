#!/usr/bin/env python3
"""Convierte las obras de art-src/ al look Hermes: puntillismo lima sobre negro.

Uso (desde frontend/):  python3 scripts/stipple-art.py
Requiere Pillow.

Dos modos, según la obra:
  * Duro (por defecto): 1 bit, solo puntos lima sobre negro -> public/art/<obra>.png
  * Suave (SOFT):       tono continuo lima + una fracción de puntos (SOFT[obra]
                        = 0..1; 1 = todo puntos). Evita el moiré en imágenes con
                        fondos lisos y deja ver mejor la pintura -> public/art/<obra>.webp
Para cambiar una obra, reemplaza art-src/<obra>.jpg y vuelve a ejecutar.
"""
from pathlib import Path
from PIL import Image, ImageFilter, ImageOps

LIME = (212, 255, 63)      # #D4FF3F
BG = (10, 10, 10)          # #0A0A0A
WIDTH = 960                # px de la imagen final
GAMMA = 0.85               # <1 aclara medios tonos; >1 los oscurece
CROP = {}                  # {'obra': (izq, arriba, der, abajo)} para recortar bordes
INVERT = {'tennis'}        # grabados de línea (fondo blanco): trazo lima sobre negro
GAMMA_BY = {'home-prudence': 0.7, 'home-cardsharps': 0.85, 'home-moneylender': 1.0,
            'home-hercules': 0.8, 'esports': 1.3, 'tennis': 1.2, 'basketball': 0.7,
            'boxing': 0.9}  # ajuste por obra
SOFT = {'home-cardsharps': 0.6, 'home-hercules': 0.6,
        'home-prudence': 0.6, 'home-moneylender': 0.6}  # fracción de puntillismo

root = Path(__file__).resolve().parent.parent
src, out = root / 'art-src', root / 'public' / 'art'
out.mkdir(parents=True, exist_ok=True)

for path in sorted(src.glob('*.jpg')):
    stem = path.stem
    if stem.startswith('spare-'):  # obras guardadas sin usar
        continue
    gamma = GAMMA_BY.get(stem, GAMMA)
    im = Image.open(path).convert('L')
    if stem in CROP:
        im = im.crop(CROP[stem])
    width = 800 if stem in SOFT else WIDTH  # las suaves pesan más: menos píxeles
    im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im = ImageOps.autocontrast(im, cutoff=1.5)
    if stem in INVERT:
        im = ImageOps.invert(im)
    im = im.point(lambda v: int(255 * (v / 255) ** gamma))

    if stem in SOFT:
        dots = im.convert('1').convert('L').filter(ImageFilter.GaussianBlur(0.6))
        mixed = Image.blend(im, dots, SOFT[stem])
        dest = out / f'{stem}.webp'
        ImageOps.colorize(mixed, black=BG, white=LIME).save(dest, quality=78, method=6)
    else:
        im = im.filter(ImageFilter.UnsharpMask(radius=2, percent=90, threshold=2))
        bw = im.convert('1')  # Floyd-Steinberg: la trama de puntos
        pal = Image.new('P', bw.size)
        pal.putpalette(list(BG) + list(LIME) + [0] * 762)
        pal.putdata([1 if bw.getpixel((x, y)) else 0 for y in range(bw.height) for x in range(bw.width)])
        dest = out / f'{stem}.png'
        pal.save(dest, optimize=True)
    print(stem, dest.suffix, dest.stat().st_size // 1024, 'KB')
